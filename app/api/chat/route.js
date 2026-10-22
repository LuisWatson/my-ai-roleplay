import { GoogleGenerativeAI } from '@google/generative-ai';
import { AVAILABLE_MODELS } from '../../../constants/models';
import { normalizeResponseSettings } from '../../../constants/chatSettings';
import { buildSystemInstruction, CONTINUE_MESSAGE } from '../../../lib/prompt';
import { authorize, resolveApiKey, tryModels, SAFETY_SETTINGS } from '../../../lib/geminiServer';
import { CUT_MARKER } from '../../../lib/scene';

// Finish reasons that mean the reply ended normally
const NORMAL_FINISH = new Set(['STOP', 'FINISH_REASON_UNSPECIFIED']);

const CANDIDATE_MODELS = AVAILABLE_MODELS.map((m) => m.id);

// Models that finish a reply Google cut short (big free quota, so the Flash quota stays for real replies)
const LITE_MODELS = CANDIDATE_MODELS.filter((m) => m.includes('lite'));
// Each Lite try, and all of them (under the page's 30 s wait between chunks)
const CONTINUE_CUT_MS = 12000;
const CONTINUE_CUT_TOTAL_MS = 24000;
const CONTINUE_CUT_MESSAGE =
  '(ข้อความล่าสุดของคุณถูกตัดกลางคัน ให้เขียนต่อจากคำสุดท้ายที่ค้างไว้ทันที ห้ามทวนหรือเริ่มข้อความเดิมใหม่ ' +
  'ห้ามพูดถึงการถูกตัด เขียนให้จบฉากสั้นๆ แล้วปิดท้ายด้วยแท็กฉากตามกฎ)';
const SCENE_TAG_MARKER = '[ฉาก:';

// How long to wait for a model to start replying before falling back to the next one.
const FIRST_RESPONSE_TIMEOUT_MS = 20000;

// Stop falling back after this long so the reply (or the error) arrives before the page gives up at 90 s.
const TOTAL_BUDGET_MS = 70000;

/**
 * Handles incoming chat messages and streams responses back from Google Gemini.
 */
export async function POST(req) {
  try {
    const denied = await authorize(req);
    if (denied) return denied;

    const {
      message,
      history,
      persona,
      apiKey,
      model: requestedModel,
      userProfile,
      responseSettings,
      scene,
      memory,
      pinned,
      journal,
      relation,
      chatStyle,
      direction,
      continueStory,
    } = await req.json();

    const { key: activeKey, error: keyError } = resolveApiKey(apiKey);
    if (keyError) return keyError;

    const genAI = new GoogleGenerativeAI(activeKey);

    const {
      length,
      temperature,
      journal: journalMode,
      suggestions,
      relationship,
    } = normalizeResponseSettings(responseSettings);
    const systemInstruction = buildSystemInstruction({
      persona,
      userProfile,
      length,
      scene,
      memory,
      pinned,
      journal,
      askMoments: journalMode !== 'off',
      relation,
      showRelation: relationship,
      suggestChoices: suggestions,
      chatStyle: chatStyle === 'dm' ? 'dm' : 'novel',
      direction,
      continueStory: Boolean(continueStory),
    });

    // Ensure chat history conforms to Gemini SDK requirements:
    // 1. First message must be from 'user'
    // 2. Roles must strictly alternate between 'user' and 'model'
    let rawHistory = (history || []).filter((h) => h.text && h.text.trim().length > 0);
    // The greeting (and "continue" replies before the user's first message) come before any user turn;
    // keep them behind a stand-in opening turn instead of dropping them, so the model sees its own words
    if (rawHistory.length > 0 && rawHistory[0].role !== 'user') {
      rawHistory = [{ role: 'user', text: CONTINUE_MESSAGE }, ...rawHistory];
    }

    const formattedHistory = [];
    for (const item of rawHistory) {
      const role = item.role === 'user' ? 'user' : 'model';
      if (formattedHistory.length > 0 && formattedHistory[formattedHistory.length - 1].role === role) {
        formattedHistory[formattedHistory.length - 1].parts[0].text += `\n${item.text}`;
      } else {
        formattedHistory.push({
          role: role,
          parts: [{ text: item.text }],
        });
      }
    }

    // A failed or aborted send leaves history ending on a user turn; fold it into the outgoing message
    // so Gemini never sees two consecutive user turns.
    let outgoingMessage = continueStory ? CONTINUE_MESSAGE : message;
    if (formattedHistory.length > 0 && formattedHistory[formattedHistory.length - 1].role === 'user') {
      outgoingMessage = `${formattedHistory.pop().parts[0].text}
${message}`;
    }

    // Try the requested model first, then the others in order
    const ordered = requestedModel
      ? [requestedModel, ...CANDIDATE_MODELS.filter((m) => m !== requestedModel)]
      : CANDIDATE_MODELS;
    // Starts a streamed reply and waits for its first words, so a reply Google blocks (or an empty one)
    // counts as this model failing instead of a stream that breaks after the 200
    const openStream = (history, text) => async (mName) => {
      const { stream } = await genAI
        .getGenerativeModel({ model: mName, systemInstruction, safetySettings: SAFETY_SETTINGS })
        .startChat({ history, generationConfig: { temperature } })
        .sendMessageStream(text);
      const iterator = stream[Symbol.asyncIterator]();
      let firstText = '';
      while (!firstText) {
        const { value, done } = await iterator.next();
        if (done) break;
        firstText = value.text(); // throws when the reply was blocked
      }
      if (!firstText) throw new Error('Empty reply');
      return { iterator, firstText };
    };

    const {
      result: resultStream,
      usedModel,
      failures,
      errorResponse,
    } = await tryModels({
      apiKey: activeKey,
      models: ordered,
      perModelMs: FIRST_RESPONSE_TIMEOUT_MS,
      totalMs: TOTAL_BUDGET_MS,
      run: openStream(formattedHistory, outgoingMessage),
    });
    if (errorResponse) return errorResponse;

    // Sends the rest of a started reply; returns why Google stopped it partway, or null when it finished
    const pipe = async (started, model, onText) => {
      onText(started.firstText);
      let finish;
      try {
        while (true) {
          const { value, done } = await started.iterator.next();
          if (done) return null;
          finish = value.candidates?.[0]?.finishReason;
          const chunkText = value.text(); // throws when blocked
          if (chunkText) onText(chunkText);
          if (finish && !NORMAL_FINISH.has(finish)) return finish;
        }
      } catch (streamError) {
        console.error(`Reply from ${model} stopped midway:`, streamError.message);
        if (finish && !NORMAL_FINISH.has(finish)) return finish;
        return streamError.message.match(/\b(SAFETY|RECITATION|PROHIBITED_CONTENT|BLOCKLIST|SPII|OTHER|MAX_TOKENS)\b/)?.[1] || 'ERROR';
      }
    };

    // Stream the reply. If Google stops it in the middle of the story (its fixed filters cut harmless
    // romance often), a Lite model carries on from the last word inside the same message. If that fails too,
    // or the cut came inside the scene tag, end with CUT_MARKER + the reason: the page keeps what arrived.
    const encoder = new TextEncoder();
    const customStream = new ReadableStream({
      async start(controller) {
        let sent = '';
        const send = (text) => {
          sent += text;
          controller.enqueue(encoder.encode(text));
        };
        let cut = await pipe(resultStream, usedModel, send);
        if (cut) console.warn(`Reply from ${usedModel} was cut: ${cut}`);
        if (cut && !sent.includes(SCENE_TAG_MARKER)) {
          const { result: rest, usedModel: restModel } = await tryModels({
            apiKey: activeKey,
            models: LITE_MODELS,
            perModelMs: CONTINUE_CUT_MS,
            totalMs: CONTINUE_CUT_TOTAL_MS,
            run: openStream(
              [...formattedHistory, { role: 'user', parts: [{ text: outgoingMessage }] }, { role: 'model', parts: [{ text: sent }] }],
              CONTINUE_CUT_MESSAGE
            ),
          });
          if (rest) {
            cut = await pipe(rest, restModel, send);
            console.warn(`Cut reply continued by ${restModel}${cut ? `, cut again: ${cut}` : ''}`);
          }
        }
        if (cut) controller.enqueue(encoder.encode(`${CUT_MARKER}${cut}`));
        controller.close();
      },
    });

    return new Response(customStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Transfer-Encoding': 'chunked',
        'X-Model-Used': usedModel,
        'X-Models-Failed': failures.map((f) => f.model).join(','),
      },
    });
  } catch (error) {
    console.error('Chat API Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'เกิดข้อผิดพลาดในการประมวลผล' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}