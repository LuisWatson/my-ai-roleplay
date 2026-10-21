export const LENGTH_OPTIONS = [
  { id: 'short', label: 'สั้น', hint: '1-2 ประโยค' },
  { id: 'medium', label: 'กลาง', hint: '3-5 ประโยค' },
  { id: 'long', label: 'ยาว', hint: 'หลายย่อหน้า' },
];

export const TEMPERATURE_MIN = 0.3;
export const TEMPERATURE_MAX = 1.2;

export const DEFAULT_RESPONSE_SETTINGS = { length: 'medium', temperature: 0.95 };

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
  return { length, temperature };
}
