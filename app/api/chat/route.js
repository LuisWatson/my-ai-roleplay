import { createHash } from 'node:crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AVAILABLE_MODELS } from '../../../constants/models';
import { normalizeResponseSettings } from '../../../constants/chatSettings';
import { buildSystemInstruction } from '../../../lib/prompt';
import { withTimeout } from '../../../lib/withTimeout';
import {
  classifyGeminiError,
  describeFailures,
  failureKind,
  retryDelayMs,
  statusForFailures,
} from '../../../lib/geminiErrors';
import { isSupabaseConfigured, createSupabaseForToken } from '../../../lib/supabaseClient';

const CANDIDATE_MODELS = AVAILABLE_MODELS.map((m) => m.id);

// How long to wait for a model to start replying before falling back to the next one.
const FIRST_RESPONSE_TIMEOUT_MS = 20000;

// Stop falling back after this long so the reply (or the error) arrives before the page gives up at 90 s.
const TOTAL_BUDGET_MS = 70000;

// A 429 asking to retry this much later or more means the daily quota is gone, not a per-minute burst.
const DAILY_QUOTA_RETRY_MS = 10 * 60 * 1000;

// "<key hash>:<model>" → time its daily quota comes back. Lives as long as the server process.
const exhaustedUntil = new Map();
const quotaKey = (apiKey, model) => `${createHash('sha256').update(apiKey).digest('hex').slice(0, 12)}:${model}`;

// Returns an error message when the caller may not use the server's Gemini key, otherwise null.
async function authorize(req) {
  if (!isSupabaseConfigured) {
    // No login set up: fine on a dev machine, never on a deployed server
    return process.env.NODE_ENV === 'production' ? 'เซิร์ฟเวอร์ยังไม่ได้ตั้งค่าระบบเข้าสู่ระบบ' : null;
  }
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return 'กรุณาเข้าสู่ระบบก่อนใช้งาน';
  // PostgREST verifies the token; is_allowed() checks its email against the allowlist
  const { data: allowed, error } = await createSupabaseForToken(token).rpc('is_allowed');
  if (error || allowed !== true) return 'บัญชีนี้ไม่ได้รับอนุญาตให้ใช้งาน กรุณาเข้าสู่ระบบใหม่';
  return null;
}

/**
 * Handles incoming chat messages and streams responses back from Google Gemini.
 */
export async function POST(req) {
  try {
    const denied = await authorize(req);
    if (denied) {
      return new Response(JSON.stringify({ error: denied, kind: 'signin' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { message, history, persona, apiKey, model: requestedModel, userProfile, responseSettings, scene } = await req.json();

    const activeKey = apiKey?.trim() || process.env.GEMINI_API_KEY;

    if (!activeKey) {
      return new Response(
        JSON.stringify({ error: 'ไม่พบ Gemini API Key กรุณาตั้งค่าใน .env.local หรือหน้า Settings', kind: 'auth' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const genAI = new GoogleGenerativeAI(activeKey);

    const { length, temperature } = normalizeResponseSettings(responseSettings);
    const systemInstruction = buildSystemInstruction({ persona, userProfile, length, scene });

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

    // Try primary requested model or fallback through available fast models,
    // leaving out models whose daily quota is known to be used up
    const now = Date.now();
    const ordered = requestedModel
      ? [requestedModel, ...CANDIDATE_MODELS.filter((m) => m !== requestedModel)]
      : CANDIDATE_MODELS;
    const modelsToTry = ordered.filter((m) => !(exhaustedUntil.get(quotaKey(activeKey, m)) > now));

    let resultStream = null;
    let usedModel = null;
    const failures = ordered.filter((m) => !modelsToTry.includes(m)).map((model) => ({ model, kind: 'quota' }));
    const deadline = now + TOTAL_BUDGET_MS;

    for (const mName of modelsToTry) {
      const timeLeft = deadline - Date.now();
      if (timeLeft < 3000) break;
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
          Math.min(FIRST_RESPONSE_TIMEOUT_MS, timeLeft),
          `โมเดล ${mName} ไม่ตอบสนองภายใน ${FIRST_RESPONSE_TIMEOUT_MS / 1000} วินาที`
        );
        usedModel = mName;
        break; // Successfully initiated stream
      } catch (err) {
        const kind = classifyGeminiError(err);
        failures.push({ model: mName, kind });
        console.warn(`Model ${mName} failed (${kind}):`, err.message);
        const retryMs = kind === 'quota' ? retryDelayMs(err) : 0;
        if (retryMs >= DAILY_QUOTA_RETRY_MS) exhaustedUntil.set(quotaKey(activeKey, mName), Date.now() + retryMs);
        // A bad key fails identically on every model, so don't spend more requests on it
        if (kind === 'auth') break;
      }
    }

    if (!resultStream) {
      return new Response(JSON.stringify({ error: describeFailures(failures), kind: failureKind(failures) }), {
        status: statusForFailures(failures),
        headers: { 'Content-Type': 'application/json' },
      });
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