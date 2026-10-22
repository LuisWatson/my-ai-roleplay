import { GoogleGenerativeAI } from '@google/generative-ai';
import { AVAILABLE_MODELS } from '../../../constants/models';
import { normalizeResponseSettings } from '../../../constants/chatSettings';
import { buildSystemInstruction, CONTINUE_MESSAGE } from '../../../lib/prompt';
import { authorize, resolveApiKey, tryModels } from '../../../lib/geminiServer';

const CANDIDATE_MODELS = AVAILABLE_MODELS.map((m) => m.id);

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
      // Waits for the first words, so a reply Google blocks (or an empty one) counts as this model failing
      // and the page gets an error it can explain, instead of a stream that breaks after the 200
      run: async (mName) => {
        const { stream } = await genAI
          .getGenerativeModel({ model: mName, systemInstruction })
          .startChat({ history: formattedHistory, generationConfig: { temperature } })
          .sendMessageStream(outgoingMessage);
        const iterator = stream[Symbol.asyncIterator]();
        let firstText = '';
        while (!firstText) {
          const { value, done } = await iterator.next();
          if (done) break;
          firstText = value.text(); // throws when the reply was blocked
        }
        if (!firstText) throw new Error('Empty reply');
        return { iterator, firstText };
      },
    });
    if (errorResponse) return errorResponse;

    // Stream the rest of the reply. If Google blocks it midway, end quietly: the page keeps what arrived.
    const encoder = new TextEncoder();
    const customStream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(resultStream.firstText));
        try {
          while (true) {
            const { value, done } = await resultStream.iterator.next();
            if (done) break;
            const chunkText = value.text();
            if (chunkText) controller.enqueue(encoder.encode(chunkText));
          }
        } catch (streamError) {
          console.error(`Reply from ${usedModel} stopped midway:`, streamError.message);
        }
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