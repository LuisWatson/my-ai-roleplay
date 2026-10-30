import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { AVAILABLE_MODELS } from '../../../constants/models';
import {
  buildSummaryPrompt,
  buildCompressPrompt,
  buildLedgerPrompt,
  buildChapterMergePrompt,
  buildFactsMergePrompt,
} from '../../../lib/prompt';
import { mergeSummaries } from '../../../lib/memory';
import {
  CHAPTERS_MAX_CHARS,
  FACTS_MAX_CHARS,
  applyCompaction,
  applyDelta,
  applyFactsCompaction,
  applySpeakers,
  chaptersToCompact,
  emptyMemoryData,
  factsToCompact,
  parseDelta,
  renderMemory,
} from '../../../lib/ledger';
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

// Shape of what the model reports for one batch (merged by lib/ledger.js applyDelta)
const strings = { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } };
const LEDGER_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    chapter: { type: SchemaType.STRING },
    status: strings,
    relationship: strings,
    people: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          role: { type: SchemaType.STRING },
          knows: { type: SchemaType.STRING },
          meetings: strings,
          told: strings,
        },
        required: ['name', 'role', 'knows', 'meetings'],
      },
    },
    facts: strings,
    removeFacts: strings,
  },
  required: ['chapter', 'status', 'people'],
};

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

    const { characterName, userName, previousSummary, messages, characterAge, apiKey, data, cast } = await req.json();
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
    // `json`: the reply must be a usable JSON object (read inside the attempt, so a broken one moves on to the next model)
    const generate = (prompt, { json = false } = {}) =>
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
            generationConfig: json
              ? { temperature: 0.2, responseMimeType: 'application/json', responseSchema: LEDGER_SCHEMA }
              : { temperature: 0.3 },
          });
          const text = response.text().trim(); // throws when blocked
          if (!text) throw new Error('Empty summary');
          if (!json) return text;
          const delta = parseDelta(text);
          if (!delta) throw new Error('Memory reply was not usable JSON');
          return delta;
        },
      });

    // Structured memory (lib/ledger.js): the model reports what the new messages add, this code merges it
    if (data && typeof data === 'object') {
      const castInfo = Array.isArray(cast)
        ? cast.filter((c) => typeof c?.name === 'string').slice(0, 12).map((c) => ({ name: c.name, relation: typeof c.relation === 'string' ? c.relation : '' }))
        : [];
      const castList = castInfo.map((c) => c.name);
      const skipNames = [characterName, userName].filter(Boolean);
      const options = { castNames: castList, skipNames };
      const base = { ...emptyMemoryData(), ...data };
      const ask = (known) =>
        generate(buildLedgerPrompt({ characterName, userName, data: known, castNames: castList, messages: cleanMessages, characterAge: age }), { json: true });

      let reported = await ask(base);
      // Refused: the remembered text may be what Google objects to. Report the new messages alone; they merge the same way.
      if (reported.errorResponse) {
        const kind = await reported.errorResponse.clone().json().then((b) => b.kind).catch(() => null);
        if (kind === 'blocked') reported = await ask(emptyMemoryData());
      }
      if (reported.errorResponse) return reported.errorResponse;

      let merged = applySpeakers(applyDelta(base, reported.result, options), cleanMessages, { cast: castInfo, skipNames });
      // Event notes or facts over budget: fold the two oldest notes into one, or the facts into fewer lines (skipped
      // when little time is left; the next batch retries). A failed fold leaves the data exactly as it was.
      for (let i = 0; i < 3 && Date.now() - startedAt < 22000; i++) {
        const pair = chaptersToCompact(merged);
        const facts = factsToCompact(merged);
        if (!pair && !facts) break;
        const folded = await generate(
          pair
            ? buildChapterMergePrompt({ characterName, userName, chapters: pair, maxChars: Math.floor(CHAPTERS_MAX_CHARS / 5) })
            : buildFactsMergePrompt({ characterName, userName, facts, maxChars: Math.floor(FACTS_MAX_CHARS * 0.7) })
        );
        if (folded.errorResponse) break;
        const next = pair ? applyCompaction(merged, folded.result) : applyFactsCompaction(merged, folded.result);
        if (next === merged) break;
        merged = next;
      }
      return jsonResponse({ summary: renderMemory(merged), data: merged, model: reported.usedModel }, 200);
    }
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
