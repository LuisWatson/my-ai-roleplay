export function validateChatRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'รูปแบบคำขอไม่ถูกต้อง';
  }
  if (typeof body.message !== 'string') {
    return 'ไม่พบข้อความที่ต้องการส่ง';
  }
  if (
    !Array.isArray(body.history) ||
    body.history.some((item) => !item || typeof item !== 'object' || typeof item.text !== 'string' || typeof item.role !== 'string')
  ) {
    return 'ประวัติแชทไม่ถูกต้อง';
  }
  if (
    !body.persona ||
    typeof body.persona !== 'object' ||
    Array.isArray(body.persona) ||
    typeof body.persona.name !== 'string' ||
    !body.persona.name.trim()
  ) {
    return 'ไม่พบข้อมูลตัวละคร';
  }
  if (body.continueStory !== undefined && typeof body.continueStory !== 'boolean') {
    return 'รูปแบบคำขอเล่าเรื่องต่อไม่ถูกต้อง';
  }
  return null;
}
