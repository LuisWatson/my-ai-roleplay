/**
 * How willing a character is to accept events the user introduces (a monster attack, magic, a sudden plot twist).
 * `promptRule` is injected into the system instruction; `label`/`hint` are shown in the UI.
 */
export const REALISM_OPTIONS = [
  {
    id: 'grounded',
    label: 'สมจริง',
    hint: 'ยึดโลกความจริง เหตุการณ์เหนือจริงจะถูกตั้งคำถามหรือไม่เชื่อทันที',
    promptRule:
      'โลกของเรื่องนี้เป็นโลกความจริง ถ้าคู่สนทนาพูดถึงเหตุการณ์ที่ไม่สมเหตุสมผลกับโลกความจริง (เช่น สัตว์ประหลาด เวทมนตร์ หรือเหตุการณ์ใหญ่ที่ไม่น่าเป็นไปได้) ' +
      'ให้ตอบสนองอย่างสมจริงตามบุคลิกของคุณ เช่น สงสัย ไม่เชื่อ ถามกลับ หรือคิดว่าเป็นเรื่องตลก ห้ามเชื่อและเล่นตามทันทีโดยไม่มีปฏิกิริยา',
  },
  {
    id: 'flexible',
    label: 'ยืดหยุ่น',
    hint: 'เล่นไปกับเรื่องที่ชวนคุย แต่ยังมีปฏิกิริยาตามธรรมชาติก่อน',
    promptRule:
      'คุณยืดหยุ่นกับเรื่องราวหรือเหตุการณ์ใหม่ที่คู่สนทนาเสนอ แต่ควรมีปฏิกิริยาที่เป็นธรรมชาติตามบุคลิกของคุณก่อนจะเล่นตาม (ตกใจ สงสัย ตื่นเต้น ฯลฯ) ' +
      'ไม่ใช่เชื่อและทำตามทันทีราวกับไม่มีอะไรเกิดขึ้น',
  },
  {
    id: 'open',
    label: 'ปล่อยเต็มที่',
    hint: 'เหมาะกับแฟนตาซี/ไซไฟ เล่นตามจินตนาการที่คู่สนทนาเสนอได้เต็มที่',
    promptRule:
      'คุณเปิดรับและเล่นไปกับเหตุการณ์หรือองค์ประกอบใหม่ที่คู่สนทนาเสนอได้อย่างเต็มที่ ตราบใดที่ไม่ขัดกับบุคลิกหรือตัวตนของคุณ',
  },
];

export const DEFAULT_REALISM = 'flexible';

/**
 * Coerce untrusted input (localStorage, backup file, form) into a valid realism id.
 */
export function normalizeRealism(raw) {
  return REALISM_OPTIONS.some((o) => o.id === raw) ? raw : DEFAULT_REALISM;
}
