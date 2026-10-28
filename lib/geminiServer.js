import { createHash } from 'node:crypto';
import { withTimeout } from './withTimeout';
import { classifyGeminiError, describeFailures, failureKind, retryDelayMs, statusForFailures } from './geminiErrors';
import { isSupabaseConfigured, createSupabaseForToken } from './supabaseClient';

// Server-only helpers shared by the API routes that call Gemini.

// A 429 asking to retry this much later or more means the daily quota is gone, not a per-minute burst.
const DAILY_QUOTA_RETRY_MS = 10 * 60 * 1000;

// "<key hash>:<model>" → time its daily quota comes back. Lives as long as the server process
// and is shared by every route in it.
const exhaustedUntil = new Map();
const quotaKey = (apiKey, model) => `${createHash('sha256').update(apiKey).digest('hex').slice(0, 12)}:${model}`;

// Google's adjustable filters at their lowest setting: the default ones sometimes stop harmless couple
// roleplay mid-reply. Google's own non-adjustable checks still apply.
export const SAFETY_SETTINGS = [
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  'HARM_CATEGORY_DANGEROUS_CONTENT',
].map((category) => ({ category, threshold: 'BLOCK_NONE' }));

export function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Returns an error Response when the caller may not use the server's Gemini key, otherwise null.
export async function authorize(req) {
  let denied = null;
  if (!isSupabaseConfigured) {
    // No login set up: fine on a dev machine, never on a deployed server
    if (process.env.NODE_ENV === 'production') denied = 'เซิร์ฟเวอร์ยังไม่ได้ตั้งค่าระบบเข้าสู่ระบบ';
  } else {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) {
      denied = 'กรุณาเข้าสู่ระบบก่อนใช้งาน';
    } else {
      // PostgREST verifies the token; is_allowed() checks its email against the allowlist
      const { data: allowed, error } = await createSupabaseForToken(token).rpc('is_allowed');
      if (error || allowed !== true) denied = 'บัญชีนี้ไม่ได้รับอนุญาตให้ใช้งาน กรุณาเข้าสู่ระบบใหม่';
    }
  }
  return denied ? jsonResponse({ error: denied, kind: 'signin' }, 401) : null;
}

// The server's keys, in the order they are tried: GEMINI_API_KEY (which may hold several, comma-separated), then
// GEMINI_API_KEY_2 … GEMINI_API_KEY_9. Each Google project has its own free daily quota, so a second key from
// another project keeps chat going when the first one's quota is used up.
function serverKeys() {
  const raw = [process.env.GEMINI_API_KEY, ...[2, 3, 4, 5, 6, 7, 8, 9].map((n) => process.env[`GEMINI_API_KEY_${n}`])];
  const keys = raw.flatMap((v) => String(v || '').split(',')).map((k) => k.trim()).filter(Boolean);
  return [...new Set(keys)];
}

// The key typed into Settings wins over the server's (and is the only one used then). Returns { key, keys }:
// `key` is the first one, `keys` all of them; null (with an error Response) when there is none.
export function resolveApiKey(requestKey) {
  const keys = requestKey?.trim() ? [requestKey.trim()] : serverKeys();
  if (keys.length > 0) return { key: keys[0], keys, error: null };
  return {
    key: null,
    keys: [],
    error: jsonResponse({ error: 'ไม่พบ Gemini API Key กรุณาตั้งค่าใน .env.local หรือหน้า Settings', kind: 'auth' }, 400),
  };
}

/**
 * Calls `run(model, apiKey)` on each model in turn until one succeeds, skipping models whose daily quota is
 * known to be used up and remembering new ones. With several keys (`apiKeys`), every model of the first key is
 * tried before the next key. Each attempt gets at most `perModelMs`, all of them together at most `totalMs`.
 * Returns { result, usedModel, failures, errorResponse }; errorResponse is set (and result null) when nothing worked.
 */
export async function tryModels({ apiKey, apiKeys, models, run, perModelMs, totalMs }) {
  const keys = apiKeys?.length ? apiKeys : [apiKey];
  const start = Date.now();
  const deadline = start + totalMs;
  const failures = [];

  for (const [index, key] of keys.entries()) {
    // Failures of a second key are labelled so the details show which key ran out
    const label = (model) => (index === 0 ? model : `${model} (คีย์ ${index + 1})`);
    const toTry = models.filter((m) => !(exhaustedUntil.get(quotaKey(key, m)) > start));
    failures.push(...models.filter((m) => !toTry.includes(m)).map((model) => ({ model: label(model), kind: 'quota' })));

    for (const model of toTry) {
      const timeLeft = deadline - Date.now();
      if (timeLeft < 3000) break;
      try {
        const result = await withTimeout(
          run(model, key),
          Math.min(perModelMs, timeLeft),
          `โมเดล ${model} ไม่ตอบสนองภายใน ${Math.round(perModelMs / 1000)} วินาที`
        );
        return { result, usedModel: model, failures, errorResponse: null };
      } catch (err) {
        const kind = classifyGeminiError(err);
        failures.push({ model: label(model), kind });
        console.warn(`Model ${model} (key ${index + 1}) failed (${kind}):`, err.message);
        const retryMs = kind === 'quota' ? retryDelayMs(err) : 0;
        if (retryMs >= DAILY_QUOTA_RETRY_MS) exhaustedUntil.set(quotaKey(key, model), Date.now() + retryMs);
        // Content Google refuses fails the same way everywhere: don't spend more requests
        if (kind === 'blocked') return noModelWorked(failures);
        // A bad key fails on every model: go on to the next key
        if (kind === 'auth') break;
      }
    }
  }
  return noModelWorked(failures);
}

function noModelWorked(failures) {
  return {
    result: null,
    usedModel: null,
    failures,
    errorResponse: jsonResponse(
      { error: describeFailures(failures), kind: failureKind(failures) },
      statusForFailures(failures)
    ),
  };
}
