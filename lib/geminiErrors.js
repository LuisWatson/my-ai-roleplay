const KIND_LABEL = {
  auth: 'API Key ใช้ไม่ได้',
  quota: 'โควต้าหมด',
  timeout: 'ไม่ตอบสนอง',
  unavailable: 'ระบบของ Google ไม่ว่าง',
  other: 'เกิดข้อผิดพลาด',
};

/**
 * Sorts a Gemini SDK error into a kind the API route can act on:
 * `auth` stops the fallback chain, the others let the next model be tried.
 */
export function classifyGeminiError(err) {
  const status = err?.status;
  const message = String(err?.message || '');
  if (err?.code === 'TIMEOUT') return 'timeout';
  if (status === 401 || status === 403 || /API_KEY_INVALID|API key not valid/i.test(message)) return 'auth';
  if (status === 429) return 'quota';
  if (status === 500 || status === 503) return 'unavailable';
  return 'other';
}

/**
 * Technical detail of why no model could answer (shown small under the friendly message).
 * `failures` is a list of { model, kind } in the order they were tried.
 */
export function describeFailures(failures) {
  if (failures.length > 0 && failures[0].kind === 'auth') {
    return 'API Key ไม่ถูกต้องหรือไม่มีสิทธิ์ใช้งาน กรุณาตรวจสอบใน Settings หรือไฟล์ .env.local';
  }
  return failures.map((f) => `${f.model}: ${KIND_LABEL[f.kind] || KIND_LABEL.other}`).join(' / ');
}

// One word for the page to pick its message by: 'auth', 'quota' (every model out of quota) or 'busy'
export function failureKind(failures) {
  if (failures[0]?.kind === 'auth') return 'auth';
  if (failures.length > 0 && failures.every((f) => f.kind === 'quota')) return 'quota';
  return 'busy';
}

// How long Google asks to wait before retrying (RetryInfo on a 429), in ms; 0 when not given
export function retryDelayMs(err) {
  const info = (err?.errorDetails || []).find((d) => d?.retryDelay);
  const seconds = parseFloat(info?.retryDelay);
  return Number.isFinite(seconds) ? seconds * 1000 : 0;
}

export function statusForFailures(failures) {
  if (failures[0]?.kind === 'auth') return 401;
  if (failures.length > 0 && failures.every((f) => f.kind === 'quota')) return 429;
  return 502;
}
