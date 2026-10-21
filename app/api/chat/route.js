import { GoogleGenerativeAI } from '@google/generative-ai';
import { AVAILABLE_MODELS } from '../../../constants/models';
import { normalizeResponseSettings } from '../../../constants/chatSettings';
import { buildSystemInstruction } from '../../../lib/prompt';
import { withTimeout } from '../../../lib/withTimeout';

const CANDIDATE_MODELS = AVAILABLE_MODELS.map((m) => m.id);

// How long to wait for a model to start replying before falling back to the next one.
const FIRST_RESPONSE_TIMEOUT_MS = 20000;

/**
 * Handles incoming chat messages and streams responses back from Google Gemini.
 */
export async function POST(req) {
  try {
    const { message, history, persona, apiKey, model: requestedModel, userProfile, responseSettings } = await req.json();

    const activeKey = apiKey?.trim() || process.env.GEMINI_API_KEY;

    if (!activeKey) {
      return new Response(
        JSON.stringify({ error: 'ไม่พบ Gemini API Key กรุณาตั้งค่าใน .env.local หรือหน้า Settings' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const genAI = new GoogleGenerativeAI(activeKey);

    const { length, temperature } = normalizeResponseSettings(responseSettings);
    const systemInstruction = buildSystemInstruction({ persona, userProfile, length });

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

    // Try primary requested model or fallback through available fast models
    const modelsToTry = requestedModel
      ? [requestedModel, ...CANDIDATE_MODELS.filter((m) => m !== requestedModel)]
      : CANDIDATE_MODELS;

    let resultStream = null;
    let lastError = null;
    let usedModel = null;
    const failedModels = [];

    for (const mName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({
          model: mName,
          systemInstruction: systemInstruction,
        });

        const chat = model.startChat({
          history: formattedHistory,
          generationConfig: {
            temperature,
          },
        });

        resultStream = await withTimeout(
          chat.sendMessageStream(outgoingMessage),
          FIRST_RESPONSE_TIMEOUT_MS,
          `โมเดล ${mName} ไม่ตอบสนองภายใน ${FIRST_RESPONSE_TIMEOUT_MS / 1000} วินาที`
        );
        usedModel = mName;
        break; // Successfully initiated stream
      } catch (err) {
        lastError = err;
        failedModels.push(mName);
        console.warn(`Model ${mName} failed, trying fallback:`, err.message);
      }
    }

    if (!resultStream) {
      // Every model failed: report all of them, not just the last one tried
      const detail = failedModels.length > 0 ? ` (ลองแล้ว: ${failedModels.join(', ')})` : '';
      throw new Error(`ไม่สามารถเชื่อมต่อโมเดล AI ได้ในขณะนี้${detail} ลองใหม่อีกครั้งในอีกสักครู่ — ${lastError?.message ?? ''}`);
    }

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
        'X-Models-Failed': failedModels.join(','),
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