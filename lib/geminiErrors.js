const KIND_LABEL = {
  auth: 'API Key ใช้ไม่ได้',
  quota: 'โควต้าหมด',
  timeout: 'ไม่ตอบสนอง',
  unavailable: 'ระบบของ Google ไม่ว่าง',
  blocked: 'ระบบความปลอดภัยของ Google ไม่ยอมตอบ',
  other: 'เกิดข้อผิดพลาด',
};

/**
 * Sorts a Gemini SDK error into a kind the API route can act on:
 * `auth` and `blocked` stop the fallback chain (every model would fail the same way), the others let the
 * next model be tried. `blocked` is Google refusing the content (e.g. PROHIBITED_CONTENT, SAFETY), raised
 * when the reply's text is read.
 */
export function classifyGeminiError(err) {
  const status = err?.status;
  const message = String(err?.message || '');
  if (err?.code === 'TIMEOUT') return 'timeout';
  if (status === 401 || status === 403 || /API_KEY_INVALID|API key not valid/i.test(message)) return 'auth';
  if (status === 429) return 'quota';
  if (status === 500 || status === 503) return 'unavailable';
  if (/blocked due to|PROHIBITED_CONTENT|blockReason/i.test(message) || err?.response?.promptFeedback?.blockReason) {
    return 'blocked';
  }
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

// One word for the page to pick its message by: 'auth', 'blocked', 'quota' (every model out of quota) or 'busy'
export function failureKind(failures) {
  if (failures[0]?.kind === 'auth') return 'auth';
  if (failures.some((f) => f.kind === 'blocked')) return 'blocked';
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
  const kind = failureKind(failures);
  if (kind === 'auth') return 401;
  if (kind === 'blocked') return 422;
  if (kind === 'quota') return 429;
  return 502;
}
