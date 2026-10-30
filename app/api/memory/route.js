import { GoogleGenerativeAI } from '@google/generative-ai';
import { AVAILABLE_MODELS } from '../../../constants/models';
import { buildSummaryPrompt, buildCompressPrompt } from '../../../lib/prompt';
import { mergeSummaries } from '../../../lib/memory';
import { authorize, resolveApiKey, tryModels, jsonResponse, SAFETY_SETTINGS } from '../../../lib/geminiServer';

// Summaries run in the background, so they use the Lite models first: their free quota is far larger
// and the newer Flash models (20 requests a day) are kept for the chat itself.
const SUMMARY_MODELS = [
  ...AVAILABLE_MODELS.filter((m) => m.id.includes('lite')),
  ...AVAILABLE_MODELS.filter((m) => !m.id.includes('lite')),
].map((m) => m.id);

// Several model calls may run in one request (summary, retry, shortening); stay inside the function time limit
export const maxDuration = 60;
const PER_MODEL_MS = 25000;
const TOTAL_MS = 30000;

// A summary longer than this is shortened once (Lite models ignore the length asked for, and it kept growing)
const LONG_SUMMARY_CHARS = 7000;
const SHORT_SUMMARY_CHARS = 5000;

// Upper bound on what one request may ask to summarize (the page sends at most ~30k characters)
const MAX_TRANSCRIPT_CHARS = 40000;

/**
 * Folds older chat messages into the character's long-term memory and returns the new summary.
 * Body: { characterName, userName, previousSummary, messages: [{ role, text }], apiKey? }
 */
export async function POST(req) {
  try {
    const startedAt = Date.now();
    const denied = await authorize(req);
    if (denied) return denied;

    const { characterName, userName, previousSummary, messages, characterAge, apiKey } = await req.json();
    if (!characterName || !Array.isArray(messages) || messages.length === 0) {
      return jsonResponse({ error: 'ข้อมูลไม่ครบ' }, 400);
    }
    const cleanMessages = messages
      .filter((m) => typeof m?.text === 'string' && m.text.trim())
      .map((m) => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text }));
    const totalChars = cleanMessages.reduce((sum, m) => sum + m.text.length, 0);
    if (cleanMessages.length === 0 || totalChars > MAX_TRANSCRIPT_CHARS) {
      return jsonResponse({ error: 'ข้อความยาวเกินไป' }, 400);
    }

    const { keys, error: keyError } = resolveApiKey(apiKey);
    if (keyError) return keyError;

    const previous = typeof previousSummary === 'string' ? previousSummary.trim() : '';
    const age = Number.isFinite(characterAge) ? characterAge : null;
    const generate = (prompt) =>
      tryModels({
        apiKeys: keys,
        models: SUMMARY_MODELS,
        perModelMs: PER_MODEL_MS,
        totalMs: TOTAL_MS,
        // Reading the text inside the attempt makes a blocked or empty summary count as a failed model
        run: async (model, key) => {
          const genAI = new GoogleGenerativeAI(key);
          const { response } = await genAI.getGenerativeModel({ model, safetySettings: SAFETY_SETTINGS }).generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3 },
          });
          const text = response.text().trim(); // throws when blocked
          if (!text) throw new Error('Empty summary');
          return text;
        },
      });
    const summarize = (prev) =>
      generate(buildSummaryPrompt({ characterName, userName, previousSummary: prev, messages: cleanMessages, characterAge: age }));

    let { result, usedModel, errorResponse } = await summarize(previous);
    // Refused: the old summary may be what Google objects to. Summarize the new messages alone and append them,
    // before the page falls back to smaller batches.
    if (errorResponse && previous) {
      const kind = await errorResponse.clone().json().then((b) => b.kind).catch(() => null);
      if (kind === 'blocked') {
        const fresh = await summarize('');
        if (!fresh.errorResponse) {
          ({ usedModel, errorResponse } = fresh);
          result = mergeSummaries(previous, fresh.result);
        }
      }
    }
    if (errorResponse) return errorResponse;

    // Too long: shorten once, keeping the newest part. If that fails, the long one is still kept.
    // (skipped when little time is left; the next summary will shorten it)
    if (result.length > LONG_SUMMARY_CHARS && Date.now() - startedAt < 25000) {
      const short = await generate(
        buildCompressPrompt({ characterName, userName, summary: result, maxChars: SHORT_SUMMARY_CHARS })
      );
      if (!short.errorResponse && short.result.length >= 500 && short.result.length < result.length) {
        result = short.result;
      }
    }

    return jsonResponse({ summary: result, model: usedModel }, 200);
  } catch (error) {
    console.error('Memory API Error:', error);
    return jsonResponse({ error: error.message || 'เกิดข้อผิดพลาดในการประมวลผล' }, 500);
  }
}
