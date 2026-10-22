import { GoogleGenerativeAI } from '@google/generative-ai';
import { AVAILABLE_MODELS } from '../../../constants/models';
import { buildSuggestPrompt } from '../../../lib/prompt';
import { authorize, resolveApiKey, tryModels, jsonResponse, SAFETY_SETTINGS } from '../../../lib/geminiServer';

// On-demand suggestions are small; Lite models first so the Flash quota (20 a day) stays for the chat
const SUGGEST_MODELS = [
  ...AVAILABLE_MODELS.filter((m) => m.id.includes('lite')),
  ...AVAILABLE_MODELS.filter((m) => !m.id.includes('lite')),
].map((m) => m.id);

const PER_MODEL_MS = 20000;
const TOTAL_MS = 40000;
const MAX_MESSAGES = 8;
const MAX_CHARS_PER_MESSAGE = 1500;

/**
 * Three suggested next messages for the user ("แนะนำคำตอบ" in the + menu).
 * Body: { characterName, userName, messages: [{ role, text }], chatStyle, apiKey? } → { choices: string[] }
 */
export async function POST(req) {
  try {
    const denied = await authorize(req);
    if (denied) return denied;

    const { characterName, characterDescription, userProfile, userName, messages, chatStyle, apiKey } =
      await req.json();
    if (!characterName || !Array.isArray(messages) || messages.length === 0) {
      return jsonResponse({ error: 'ข้อมูลไม่ครบ' }, 400);
    }
    const recent = messages
      .filter((m) => typeof m?.text === 'string' && m.text.trim())
      .slice(-MAX_MESSAGES)
      .map((m) => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text.slice(0, MAX_CHARS_PER_MESSAGE) }));
    if (recent.length === 0) return jsonResponse({ error: 'ข้อมูลไม่ครบ' }, 400);

    const { key, error: keyError } = resolveApiKey(apiKey);
    if (keyError) return keyError;

    const profile = userProfile && typeof userProfile === 'object' ? userProfile : { name: userName };
    const prompt = buildSuggestPrompt({
      characterName,
      characterDescription: typeof characterDescription === 'string' ? characterDescription : '',
      userProfile: {
        name: String(profile.name || '').slice(0, 100),
        callMe: String(profile.callMe || '').slice(0, 100),
        description: String(profile.description || '').slice(0, 600),
      },
      messages: recent,
      dm: chatStyle === 'dm',
    });
    const genAI = new GoogleGenerativeAI(key);
    const { result, errorResponse } = await tryModels({
      apiKey: key,
      models: SUGGEST_MODELS,
      perModelMs: PER_MODEL_MS,
      totalMs: TOTAL_MS,
      run: async (model) => {
        const res = await genAI.getGenerativeModel({ model, safetySettings: SAFETY_SETTINGS }).generateContent(prompt);
        return res.response.text();
      },
    });
    if (errorResponse) return errorResponse;

    const choices = result
      .split('\n')
      .map((line) => line.replace(/^\s*(?:[-•]|\d+[.)])\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 3);
    if (choices.length === 0) return jsonResponse({ error: 'ไม่ได้ตัวเลือกกลับมา ลองอีกครั้ง' }, 502);
    return jsonResponse({ choices }, 200);
  } catch (err) {
    console.error('Suggest error:', err);
    return jsonResponse({ error: err.message || 'เกิดข้อผิดพลาด' }, 500);
  }
}
