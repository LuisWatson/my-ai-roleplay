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

// The key typed into Settings wins over the server's; null (with an error Response) when there is none
export function resolveApiKey(requestKey) {
  const key = requestKey?.trim() || process.env.GEMINI_API_KEY;
  if (key) return { key, error: null };
  return {
    key: null,
    error: jsonResponse({ error: 'ไม่พบ Gemini API Key กรุณาตั้งค่าใน .env.local หรือหน้า Settings', kind: 'auth' }, 400),
  };
}

/**
 * Calls `run(model)` on each model in turn until one succeeds, skipping models whose daily quota is
 * known to be used up and remembering new ones. Each attempt gets at most `perModelMs`, all of them
 * together at most `totalMs`. Returns { result, usedModel, failures, errorResponse }; errorResponse is
 * set (and result null) when no model worked.
 */
export async function tryModels({ apiKey, models, run, perModelMs, totalMs }) {
  const start = Date.now();
  const toTry = models.filter((m) => !(exhaustedUntil.get(quotaKey(apiKey, m)) > start));
  const failures = models.filter((m) => !toTry.includes(m)).map((model) => ({ model, kind: 'quota' }));
  const deadline = start + totalMs;

  for (const model of toTry) {
    const timeLeft = deadline - Date.now();
    if (timeLeft < 3000) break;
    try {
      const result = await withTimeout(
        run(model),
        Math.min(perModelMs, timeLeft),
        `โมเดล ${model} ไม่ตอบสนองภายใน ${Math.round(perModelMs / 1000)} วินาที`
      );
      return { result, usedModel: model, failures, errorResponse: null };
    } catch (err) {
      const kind = classifyGeminiError(err);
      failures.push({ model, kind });
      console.warn(`Model ${model} failed (${kind}):`, err.message);
      const retryMs = kind === 'quota' ? retryDelayMs(err) : 0;
      if (retryMs >= DAILY_QUOTA_RETRY_MS) exhaustedUntil.set(quotaKey(apiKey, model), Date.now() + retryMs);
      // A bad key fails identically on every model, so don't spend more requests on it
      if (kind === 'auth') break;
    }
  }

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
