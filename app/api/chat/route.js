import { GoogleGenerativeAI } from '@google/generative-ai';
import { AVAILABLE_MODELS } from '../../../constants/models';
import { normalizeResponseSettings } from '../../../constants/chatSettings';
import { buildSystemInstruction } from '../../../lib/prompt';
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
    } = await req.json();

    const { key: activeKey, error: keyError } = resolveApiKey(apiKey);
    if (keyError) return keyError;

    const genAI = new GoogleGenerativeAI(activeKey);

    const { length, temperature } = normalizeResponseSettings(responseSettings);
    const systemInstruction = buildSystemInstruction({ persona, userProfile, length, scene, memory });

    // Ensure chat history conforms to Gemini SDK requirements:
    // 1. First message must be from 'user'
    // 2. Roles must strictly alternate between 'user' and 'model'
    let rawHistory = (history || []).filter((h) => h.text && h.text.trim().length > 0);
    while (rawHistory.length > 0 && rawHistory[0].role !== 'user') {
      rawHistory.shift();
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
    let outgoingMessage = message;
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
      run: (mName) =>
        genAI
          .getGenerativeModel({ model: mName, systemInstruction })
          .startChat({ history: formattedHistory, generationConfig: { temperature } })
          .sendMessageStream(outgoingMessage),
    });
    if (errorResponse) return errorResponse;

    // Stream text chunks directly using ReadableStream
    const encoder = new TextEncoder();
    const customStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of resultStream.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
              controller.enqueue(encoder.encode(chunkText));
            }
          }
          controller.close();
        } catch (streamError) {
          console.error('Streaming error during chunk generation:', streamError);
          controller.error(streamError);
        }
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