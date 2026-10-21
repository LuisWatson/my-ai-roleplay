/**
 * Generic, blurred-behind-the-chat backgrounds the model can pick for the current scene.
 * The model reports one of these ids in the scene tag (see lib/prompt.js); "other" or an
 * unknown id falls back to the character's own `background`.
 * Characters from other worlds (fantasy, sci-fi) set `fixedBackground: true` and skip this.
 */
export const SCENE_BACKGROUNDS = [
  { id: 'cafe', label: 'ร้านกาแฟ คาเฟ่ ร้านขนม' },
  { id: 'restaurant', label: 'ร้านอาหาร ร้านเหล้า บาร์' },
  { id: 'campus', label: 'มหาวิทยาลัย โรงเรียน ห้องเรียน ห้องสมุด' },
  { id: 'office', label: 'ออฟฟิศ ห้องประชุม ที่ทำงาน' },
  { id: 'home', label: 'บ้าน คอนโด ห้องนอน ห้องนั่งเล่น หอพัก' },
  { id: 'street_day', label: 'ข้างนอกตอนกลางวัน ถนน ตลาด ห้าง' },
  { id: 'street_night', label: 'ข้างนอกตอนกลางคืน ถนนยามค่ำ' },
  { id: 'nature', label: 'สวน ทะเล ภูเขา ธรรมชาติ' },
];

const BY_ID = Object.fromEntries(SCENE_BACKGROUNDS.map((b) => [b.id, b]));

/** Image path for a scene background id, or null when the id is "other"/unknown. */
export function sceneBackgroundSrc(id) {
  return BY_ID[id] ? `/characters/backgrounds/scenes/${id}.webp` : null;
}
