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
 * Builds the short Thai message shown to the user when no model could answer.
 * `failures` is a list of { model, kind } in the order they were tried.
 */
export function describeFailures(failures) {
  if (failures.length > 0 && failures[0].kind === 'auth') {
    return 'API Key ไม่ถูกต้องหรือไม่มีสิทธิ์ใช้งาน กรุณาตรวจสอบใน Settings หรือไฟล์ .env.local';
  }
  const tried = failures.map((f) => f.model).join(', ');
  if (failures.length > 0 && failures.every((f) => f.kind === 'quota')) {
    return `โควต้า Gemini ของทุกโมเดลที่ลองหมดแล้ว (${tried}) รอสักครู่หรือพรุ่งนี้ ลองเลือกโมเดล Flash Lite ใน Settings (โควต้าฟรีสูงกว่า) หรือเปลี่ยน API Key`;
  }
  const reasons = failures.map((f) => `${f.model}: ${KIND_LABEL[f.kind] || KIND_LABEL.other}`).join(' / ');
  return `ไม่สามารถเชื่อมต่อโมเดล AI ได้ในขณะนี้ (${reasons}) ลองใหม่อีกครั้งในอีกสักครู่`;
}

export function statusForFailures(failures) {
  if (failures[0]?.kind === 'auth') return 401;
  if (failures.length > 0 && failures.every((f) => f.kind === 'quota')) return 429;
  return 502;
}
