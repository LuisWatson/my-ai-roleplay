import { GoogleGenerativeAI } from '@google/generative-ai';
import { AVAILABLE_MODELS } from '../../../constants/models';
import { buildSuggestPrompt, buildRevealCheckPrompt } from '../../../lib/prompt';
import { authorize, resolveApiKey, tryModels, jsonResponse, SAFETY_SETTINGS } from '../../../lib/geminiServer';
import { pickChoices } from '../../../lib/choices';
import { memoryExcerpt } from '../../../lib/memoryExcerpt';
import { suggestionContext } from '../../../lib/suggestionContext';
import { withoutUserThoughts } from '../../../lib/userThoughts';

// On-demand suggestions are small; Lite models first so the Flash quota (20 a day) stays for the chat
const SUGGEST_MODELS = [
  ...AVAILABLE_MODELS.filter((m) => m.id.includes('lite')),
  ...AVAILABLE_MODELS.filter((m) => !m.id.includes('lite')),
].map((m) => m.id);

// The automatic request after every reply must never touch the Flash quota; only the 💡 button the user presses may
const LITE_ONLY_MODELS = SUGGEST_MODELS.filter((m) => m.includes('lite'));

const PER_MODEL_MS = 20000;
const TOTAL_MS = 40000;
const MAX_MEMORY_CHARS = 1800;

/**
 * Three suggested next messages for the user ("แนะนำคำตอบ" in the + menu).
 * Body: { characterName, userName, messages: [{ role, text }], chatStyle, apiKey? } → { choices: string[] }
 */
export async function POST(req) {
  try {
    const denied = await authorize(req);
    if (denied) return denied;

    const {
      characterName,
      characterDescription,
      userProfile,
      userName,
      memorySummary,
      contextTruncated,
      messages,
      revealMessages,
      chatStyle,
      auto,
      revealCheck,
      apiKey,
    } = await req.json();
    if (!characterName || !Array.isArray(messages) || messages.length === 0) {
      return jsonResponse({ error: 'ข้อมูลไม่ครบ' }, 400);
    }
    const context = suggestionContext(withoutUserThoughts(messages));
    const recent = context.messages;
    if (recent.length === 0) return jsonResponse({ error: 'ข้อมูลไม่ครบ' }, 400);

    const { keys, error: keyError } = resolveApiKey(apiKey);
    if (keyError) return keyError;

    const profile = userProfile && typeof userProfile === 'object' ? userProfile : { name: userName };
    const prompt = buildSuggestPrompt({
      characterName,
      characterDescription: typeof characterDescription === 'string' ? characterDescription : '',
      userProfile: {
        name: String(profile.name || '').slice(0, 100),
        callMe: String(profile.callMe || '').slice(0, 100),
        description: String(profile.description || '').slice(0, 600),
        background: String(profile.background || '').slice(0, 600),
        personality: String(profile.personality || '').slice(0, 600),
        likes: String(profile.likes || '').slice(0, 600),
        dislikes: String(profile.dislikes || '').slice(0, 600),
      },
      memorySummary: memoryExcerpt(memorySummary, MAX_MEMORY_CHARS),
      contextTruncated: contextTruncated === true || context.truncated,
      messages: recent,
      dm: chatStyle === 'dm',
    });
    const generate = (models, text) =>
      tryModels({
        apiKeys: keys,
        models,
        perModelMs: PER_MODEL_MS,
        totalMs: TOTAL_MS,
        run: async (model, key) => {
          const res = await new GoogleGenerativeAI(key)
            .getGenerativeModel({ model, safetySettings: SAFETY_SETTINGS })
            .generateContent(text);
          return res.response.text();
        },
      });
    // Hidden stage due but not tagged by the chat model: a separate Lite question, run alongside (lib/truth.js)
    const stageText = typeof revealCheck?.text === 'string' ? revealCheck.text.trim() : '';
    const revealRecent = Array.isArray(revealMessages)
      ? withoutUserThoughts(revealMessages)
          .filter((m) => typeof m?.text === 'string' && m.text.trim())
          .slice(-8)
          .map((m) => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text.slice(0, 1500) }))
      : recent.slice(-8);
    const revealPromise = stageText
      ? generate(LITE_ONLY_MODELS, buildRevealCheckPrompt({ characterName, stageText, messages: revealRecent }))
          .then(({ result }) => (typeof result === 'string' ? /^\s*["'*]*ใช่/.test(result) : undefined))
          .catch(() => undefined)
      : Promise.resolve(undefined);
    const [{ result, errorResponse }, revealed] = await Promise.all([
      generate(auto === true ? LITE_ONLY_MODELS : SUGGEST_MODELS, prompt),
      revealPromise,
    ]);
    if (errorResponse) {
      if (revealed === undefined) return errorResponse;
      // Still pass the reveal check on, so the app's count is right even when the suggestions failed
      const body = await errorResponse.json().catch(() => ({}));
      return jsonResponse({ ...body, revealed }, errorResponse.status);
    }

    // Five candidates come back; the first three that read as the user's own words are kept
    const reply = [...recent].reverse().find((m) => m.role === 'model')?.text || '';
    const choices = pickChoices(result, { names: [String(profile.name || ''), String(profile.callMe || '')], reply }, 3);
    if (choices.length === 0) return jsonResponse({ error: 'ไม่ได้ตัวเลือกที่ใช้ได้ ลองอีกครั้ง', revealed }, 502);
    return jsonResponse({ choices, revealed }, 200);
  } catch (err) {
    console.error('Suggest error:', err);
    return jsonResponse({ error: err.message || 'เกิดข้อผิดพลาด' }, 500);
  }
}
