export const LENGTH_OPTIONS = [
  { id: 'short', label: 'สั้น', hint: '1-3 บรรทัด' },
  { id: 'medium', label: 'กลาง', hint: '3-6 บรรทัด' },
  { id: 'long', label: 'ยาว', hint: 'แบบนิยาย 8+ บรรทัด' },
];

export const TEMPERATURE_MIN = 0.3;
export const TEMPERATURE_MAX = 1.2;

// What happens when the model flags a key moment (see lib/journal.js)
export const JOURNAL_MODES = [
  { id: 'ask', label: 'ถามก่อนทุกครั้ง', hint: 'เด้งการ์ดถามว่าจะบันทึกไหม' },
  { id: 'auto', label: 'บันทึกอัตโนมัติ', hint: 'บันทึกให้เลย กดเลิกทำได้' },
  { id: 'off', label: 'ปิด', hint: 'ไม่ต้องจับช่วงเวลาสำคัญ (ยังบันทึกเองได้)' },
];

// `suggestions`: reply buttons under the last reply; `relationship`: bond/trust/mood meters in the chat
export const DEFAULT_RESPONSE_SETTINGS = {
  length: 'medium',
  temperature: 0.95,
  journal: 'ask',
  suggestions: true,
  relationship: true,
};

// Per chat: novel-style roleplay or short messaging-app chat
export const CHAT_STYLES = ['novel', 'dm'];
export const chatStyleKey = (charId) => `chat_style_${charId}`;

// Characters of recent chat sent to the model, counted back from the newest message.
export const HISTORY_CHAR_BUDGET = 12000;

/**
 * Coerce untrusted input (localStorage, backup file, request body) into valid response settings.
 */
export function normalizeResponseSettings(raw) {
  const length = LENGTH_OPTIONS.some((o) => o.id === raw?.length)
    ? raw.length
    : DEFAULT_RESPONSE_SETTINGS.length;
  const temp = Number(raw?.temperature);
  const temperature = Number.isFinite(temp)
    ? Math.min(TEMPERATURE_MAX, Math.max(TEMPERATURE_MIN, temp))
    : DEFAULT_RESPONSE_SETTINGS.temperature;
  const journal = JOURNAL_MODES.some((m) => m.id === raw?.journal) ? raw.journal : DEFAULT_RESPONSE_SETTINGS.journal;
  const suggestions = typeof raw?.suggestions === 'boolean' ? raw.suggestions : DEFAULT_RESPONSE_SETTINGS.suggestions;
  const relationship = typeof raw?.relationship === 'boolean' ? raw.relationship : DEFAULT_RESPONSE_SETTINGS.relationship;
  return { length, temperature, journal, suggestions, relationship };
}

// Client-side watchdogs. The server already waits up to 20s per model, so the first-response limit
// must exceed the worst case across all fallback models.
export const FIRST_RESPONSE_CLIENT_TIMEOUT_MS = 90000;
export const STALL_TIMEOUT_MS = 30000;
