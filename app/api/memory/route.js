import { GoogleGenerativeAI } from '@google/generative-ai';
import { AVAILABLE_MODELS } from '../../../constants/models';
import { buildSummaryPrompt } from '../../../lib/prompt';
import { authorize, resolveApiKey, tryModels, jsonResponse, SAFETY_SETTINGS } from '../../../lib/geminiServer';

// Summaries run in the background, so they use the Lite models first: their free quota is far larger
// and the newer Flash models (20 requests a day) are kept for the chat itself.
const SUMMARY_MODELS = [
  ...AVAILABLE_MODELS.filter((m) => m.id.includes('lite')),
  ...AVAILABLE_MODELS.filter((m) => !m.id.includes('lite')),
].map((m) => m.id);

const PER_MODEL_MS = 45000;
const TOTAL_MS = 90000;

// Upper bound on what one request may ask to summarize (the page sends at most ~30k characters)
const MAX_TRANSCRIPT_CHARS = 40000;

/**
 * Folds older chat messages into the character's long-term memory and returns the new summary.
 * Body: { characterName, userName, previousSummary, messages: [{ role, text }], apiKey? }
 */
export async function POST(req) {
  try {
    const denied = await authorize(req);
    if (denied) return denied;

    const { characterName, userName, previousSummary, messages, apiKey } = await req.json();
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

    const { key, error: keyError } = resolveApiKey(apiKey);
    if (keyError) return keyError;

    const genAI = new GoogleGenerativeAI(key);
    const prompt = buildSummaryPrompt({
      characterName,
      userName,
      previousSummary: typeof previousSummary === 'string' ? previousSummary : '',
      messages: cleanMessages,
    });

    const { result, usedModel, errorResponse } = await tryModels({
      apiKey: key,
      models: SUMMARY_MODELS,
      perModelMs: PER_MODEL_MS,
      totalMs: TOTAL_MS,
      // Reading the text inside the attempt makes a blocked or empty summary count as a failed model
      run: async (model) => {
        const { response } = await genAI.getGenerativeModel({ model, safetySettings: SAFETY_SETTINGS }).generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3 },
        });
        const text = response.text().trim(); // throws when blocked
        if (!text) throw new Error('Empty summary');
        return text;
      },
    });
    if (errorResponse) return errorResponse;

    return jsonResponse({ summary: result, model: usedModel }, 200);
  } catch (error) {
    console.error('Memory API Error:', error);
    return jsonResponse({ error: error.message || 'เกิดข้อผิดพลาดในการประมวลผล' }, 500);
  }
}
