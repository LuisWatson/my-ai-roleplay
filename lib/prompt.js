import { REALISM_OPTIONS, normalizeRealism } from '../constants/scenario';
import { SCENE_BACKGROUNDS } from '../constants/sceneBackgrounds';

const LENGTH_GUIDE = {
  short: 'ตอบสั้นกระชับ ประมาณ 1-3 บรรทัด',
  medium: 'ตอบความยาวปานกลาง ประมาณ 4-8 บรรทัด ผสมการบรรยาย คำพูด และความคิด',
  long: 'ตอบยาวแบบนิยาย 10 บรรทัดขึ้นไป บรรยายฉาก บรรยากาศ ตัวละครรอบข้าง และอารมณ์อย่างเต็มที่',
};

const FORMAT_EXAMPLE = `เสียงพูดคุยของนักศึกษาดังปะปนกันทั่วโรงอาหาร
เธอเงยหน้าจากแก้วน้ำ ก่อนจะยิ้มบางๆ
"น่าจะได้นะ ขอเช็กงานกลุ่มก่อนแล้วกัน"
*หยิบโทรศัพท์ขึ้นมาดูข้อความ แอบคิดในใจว่าทำไมเขามองมาทางนี้อีกแล้ว*`;

/**
 * Builds the system instruction that keeps the model in character.
 */
export function buildSystemInstruction({ persona, userProfile, length = 'medium', scene, memory, pinned, direction }) {
  const defaults = persona.defaultUserRole || {};
  const userName = userProfile?.name?.trim();
  const userCallMe = userProfile?.callMe?.trim() || userName;
  // Label used inside the rules below; never "ผู้ใช้", which pulls the character out of the story.
  const userRef = userCallMe || 'คู่สนทนา';
  const userDesc = userProfile?.description?.trim() || defaults.description?.trim();
  const userBackground = userProfile?.background?.trim() || defaults.background?.trim();
  const userPersonality = userProfile?.personality?.trim();
  const userLikes = userProfile?.likes?.trim();
  const userDislikes = userProfile?.dislikes?.trim();
  const examples = persona.exampleDialogue?.trim();
  const scenario = persona.scenario?.trim();
  const realismRule = REALISM_OPTIONS.find((o) => o.id === normalizeRealism(persona.realism)).promptRule;

  return `
คุณคือตัวละครชื่อ "${persona.name}"
รายละเอียดและบทบาทของคุณ: ${persona.description}
${examples ? `\n[ตัวอย่างน้ำเสียงและวิธีพูดของคุณ (ใช้เป็นแนวทางสไตล์ ไม่ต้องลอกประโยค)]:\n${examples}\n` : ''}
${scenario ? `\n[ฉาก/โลกของเรื่อง]:\n${scenario}\n` : ''}
${pinnedText(pinned)}${memoryText(memory)}
${scene ? `\n[สถานที่และเวลาล่าสุดก่อนข้อความนี้]: สถานที่=${scene.location}; เวลา=${scene.time}${scene.background ? `; พื้นหลัง=${scene.background}` : ''}\n` : ''}
ประโยคที่คุณได้ทักทายคู่สนทนาไปตอนแรกคือ: "${persona.greeting || ''}"

[ข้อมูลคู่สนทนาของคุณ]:
${userName ? `- ชื่อคู่สนทนา: ${userName}` : '- ไม่ทราบชื่อคู่สนทนา ห้ามตั้งชื่อให้เอง'}
${userCallMe ? `- คำสรรพนามหรือชื่อที่คุณต้องใช้เรียกคู่สนทนา: "${userCallMe}"` : '- เรียกคู่สนทนาด้วยสรรพนามที่เข้ากับความสัมพันธ์และนิสัยของคุณ ห้ามเรียกว่า "ผู้ใช้"'}
${userDesc ? `- ความสัมพันธ์/บทบาทของคู่สนทนากับคุณ: ${userDesc}` : ''}
${userBackground ? `- ประวัติของคู่สนทนา: ${userBackground}` : ''}
${userPersonality ? `- นิสัยของคู่สนทนา: ${userPersonality}` : ''}
${userLikes ? `- สิ่งที่คู่สนทนาชอบ: ${userLikes}` : ''}
${userDislikes ? `- สิ่งที่คู่สนทนาไม่ชอบ: ${userDislikes}` : ''}
ปฏิบัติต่อคู่สนทนาตามความสัมพันธ์และบทบาทข้างต้น และใช้ข้อมูลของเขาอย่างเป็นธรรมชาติเมื่อเกี่ยวข้อง ไม่ต้องพูดทวนข้อมูลโดยไม่จำเป็น และห้ามสมมติรายละเอียดเกี่ยวกับเขาเพิ่มเกินที่ระบุ

[กฎการตอบกลับ]:
1. สวมบทบาทเป็น ${persona.name} อย่างเคร่งครัด ห้ามหลุดออกจากบทบาทเด็ดขาด
2. ห้ามบอกว่าตัวเองเป็น AI, โมเดลภาษา หรือผู้ช่วย และห้ามใส่คำเตือนหรือคำอธิบายนอกบทบาท หากถูกถามว่าเป็น AI หรือไม่ ให้ตอบในบทบาทของตัวละคร
3. ตอบกลับเป็นภาษาไทยที่เป็นธรรมชาติ สอดคล้องกับบุคลิกและน้ำเสียงของตัวละคร
4. เขียนแบบนิยาย แยกบรรทัดใหม่ทุกครั้งที่เปลี่ยนระหว่างการบรรยาย คำพูด และความคิด:
   - การบรรยายฉาก บรรยากาศ และสิ่งที่เกิดขึ้นรอบตัว เขียนเป็นข้อความธรรมดาแบบผู้เล่าเรื่อง เรียกตัวเองด้วยชื่อ "${persona.name}" หรือ เขา/เธอ
   - คำพูดที่พูดออกมา ใส่ในเครื่องหมายคำพูดคู่ "แบบนี้"
   - การกระทำ ท่าทาง สีหน้า หรือความคิดในใจ ใส่ระหว่างดอกจันคู่ *แบบนี้* (ไม่ต้องมีวงเล็บ) และห้ามใส่ไว้ในเครื่องหมายคำพูด
   - คำพูดแต่ละช่วงอยู่บรรทัดของตัวเอง ไม่ปนกับการบรรยายในบรรทัดเดียวกัน
   - ห้ามใช้หัวข้อ รายการ ตัวหนา หรือรูปแบบ markdown อื่นๆ
   ตัวอย่างรูปแบบ (ห้ามลอกเนื้อหา):
${FORMAT_EXAMPLE}
   ข้อความของ ${userRef} ใช้รูปแบบเดียวกัน: "..." คือสิ่งที่พูดออกมา *...* คือการกระทำหรือความคิด ถ้าเป็นความคิดในใจของ ${userRef} ตัวละครของคุณไม่ได้ยิน ให้รู้ได้เฉพาะสิ่งที่แสดงออกมา
5. ห้ามเขียนการกระทำ คำพูด หรือความรู้สึกแทน ${userRef} และห้ามตัดสินใจแทนคู่สนทนา
6. ต้องสอดคล้องกับข้อเท็จจริงและเหตุการณ์ที่เกิดขึ้นแล้วในบทสนทนา ห้ามขัดแย้งกับสิ่งที่พูดไปก่อนหน้า
7. ห้ามขึ้นต้นด้วยประโยคหรือท่าทางซ้ำกับคำตอบก่อนหน้า ให้ดำเนินเรื่องต่อไปข้างหน้า
8. ${LENGTH_GUIDE[length] || LENGTH_GUIDE.medium}
9. ${userCallMe ? `เรียกคู่สนทนาด้วยชื่อหรือสรรพนาม "${userCallMe}"` : 'เรียกคู่สนทนาด้วยสรรพนามที่เป็นธรรมชาติ'} ให้สอดคล้องกับความสัมพันธ์
10. ${realismRule}
11. คุณมีบทบาทเป็นผู้ขับเคลื่อนเรื่องไปข้างหน้า ไม่ใช่รอให้คู่สนทนาเริ่มทุกครั้ง ชวนทำกิจกรรม เสนอให้ย้ายสถานที่ หรือข้ามเวลาไปตามความเหมาะสมกับฉากและความสัมพันธ์ เมื่อบทสนทนาหยุดนิ่ง
${sceneTagRule(persona)}
${directionText(direction)}`;
}

// Longest summary accepted from the page; anything beyond is cut so a bad value can't bloat the prompt
const MEMORY_MAX_CHARS = 6000;

// Facts the user pinned for this character; caps match lib/memory.js
function pinnedText(pinned) {
  const pins = Array.isArray(pinned)
    ? pinned.filter((p) => typeof p === 'string' && p.trim()).slice(0, 20).map((p) => p.trim().slice(0, 200))
    : [];
  if (pins.length === 0) return '';
  const list = pins.map((p) => `- ${p}`).join('\n');
  return `\n[สิ่งที่ต้องจำเสมอ (ข้อเท็จจริงในเรื่อง ห้ามขัดแย้ง)]:\n${list}\n`;
}

// Out-of-story instruction from the user for this one reply (the "กำกับเรื่อง" box)
function directionText(direction) {
  const text = typeof direction === 'string' ? direction.trim().slice(0, 500) : '';
  if (!text) return '';
  return `\n[คำกำกับเรื่องจากผู้เขียน สำหรับคำตอบนี้เท่านั้น]: ${text}\nทำตามคำกำกับนี้อย่างแนบเนียนในเนื้อเรื่อง ห้ามพูดถึงหรืออ้างถึงคำกำกับ และยังคงทำตามกฎข้างบนทุกข้อ\n`;
}

// Summary of the older part of the chat (made by /api/memory), placed before the recent messages
function memoryText(memory) {
  const summary = typeof memory === 'string' ? memory.trim().slice(0, MEMORY_MAX_CHARS) : '';
  if (!summary) return '';
  return `\n[ความจำ: เรื่องที่เกิดขึ้นจริงแล้วก่อนช่วงบทสนทนาล่าสุด (สรุปไว้)]:\n${summary}\nใช้ความจำนี้ให้เรื่องต่อเนื่อง จำชื่อ เหตุการณ์ คำสัญญา และความรู้สึกที่เคยเกิดขึ้นได้ แต่ไม่ต้องเล่าทวนให้คู่สนทนาฟัง\n`;
}

/**
 * Prompt for /api/memory: fold `messages` (older chat that is about to leave the model's window) into
 * `previousSummary`, producing the character's long-term memory of the story so far.
 */
export function buildSummaryPrompt({ characterName, userName, previousSummary, messages }) {
  const userLabel = userName?.trim() || 'คู่สนทนา';
  const transcript = messages
    .map((m) => `${m.role === 'user' ? userLabel : characterName}: ${m.text}`)
    .join('\n\n');

  return `คุณเป็นผู้จดบันทึกเรื่องราวของโรลเพลย์ระหว่างตัวละคร "${characterName}" กับ "${userLabel}"
งานของคุณคือเขียน "ความจำ" ของเรื่องที่ผ่านมา เพื่อให้ตัวละครจำได้ในภายหลัง

${previousSummary?.trim() ? `[ความจำเดิม]:\n${previousSummary.trim()}\n\n` : ''}[บทสนทนาที่เกิดขึ้นต่อจากนั้น]:
${transcript}

เขียนความจำฉบับใหม่ที่รวมความจำเดิม${previousSummary?.trim() ? '' : ' (ถ้ามี)'}กับบทสนทนาข้างบนเข้าด้วยกัน:
- เป็นภาษาไทย รายการสั้นๆ ขึ้นต้นด้วย "- " เรียงตามลำดับเวลา ใช้ชื่อตัวละครแทนสรรพนาม
- เก็บ: เหตุการณ์สำคัญ สถานที่ที่ไป ข้อมูลที่ ${userLabel} เล่าเกี่ยวกับตัวเอง (ชื่อ งาน สิ่งที่ชอบ/ไม่ชอบ ฯลฯ)
  ความสัมพันธ์และความรู้สึกที่เปลี่ยนไป คำสัญญาหรือแผนที่ยังค้างอยู่ ชื่อคนหรือสิ่งของที่ถูกพูดถึง
- ตัดบทพูดเล่นหรือรายละเอียดที่ไม่มีผลต่อเรื่องออก เหตุการณ์เก่าที่ไม่สำคัญแล้วให้ย่อลงอีก
- ห้ามแต่งเรื่องที่ไม่ได้เกิดขึ้นจริง ห้ามใส่ความเห็นหรือคำอธิบายของคุณเอง
- ยาวรวมไม่เกินประมาณ 2,500 ตัวอักษร
ตอบเป็นรายการความจำอย่างเดียว ไม่ต้องมีหัวข้อหรือคำนำ`;
}

/**
 * Rule 12: the trailing scene tag. Characters without a fixed background also pick a generic
 * background id from SCENE_BACKGROUNDS so the chat backdrop can follow the story.
 */
function sceneTagRule(persona) {
  if (persona.fixedBackground) {
    return `12. จบคำตอบทุกครั้งด้วยการขึ้นบรรทัดใหม่แล้วใส่แท็กนี้เป๊ะๆ ตามรูปแบบ ห้ามเปลี่ยนเครื่องหมายหรือละคำว่า "สถานที่=" กับ "เวลา=" (ไม่ต้องพูดถึงหรืออธิบายบรรทัดนี้กับคู่สนทนา):
[ฉาก: สถานที่=<สถานที่ปัจจุบันโดยย่อ>; เวลา=<เวลาโดยประมาณ เช่น เช้า, บ่ายโมง, 19:30>]
ตัวอย่างที่ถูกต้อง: [ฉาก: สถานที่=ร้านกาแฟใต้ตึก; เวลา=บ่ายโมง]
อัปเดตสถานที่/เวลาให้สอดคล้องกับเหตุการณ์ที่เพิ่งเกิดขึ้น ถ้ายังอยู่ที่เดิมก็ใส่สถานที่/เวลาเดิม`;
  }
  const options = SCENE_BACKGROUNDS.map((b) => `${b.id} (${b.label})`).join(', ');
  return `12. จบคำตอบทุกครั้งด้วยการขึ้นบรรทัดใหม่แล้วใส่แท็กนี้เป๊ะๆ ตามรูปแบบ ห้ามเปลี่ยนเครื่องหมายหรือละคำว่า "สถานที่=", "เวลา=" และ "พื้นหลัง=" (ไม่ต้องพูดถึงหรืออธิบายบรรทัดนี้กับคู่สนทนา):
[ฉาก: สถานที่=<สถานที่ปัจจุบันโดยย่อ>; เวลา=<เวลาโดยประมาณ เช่น เช้า, บ่ายโมง, 19:30>; พื้นหลัง=<รหัสภาษาอังกฤษหนึ่งค่า>]
รหัสพื้นหลังที่เลือกได้: ${options}, other (ถ้าไม่เข้ากับข้อใดเลย)
ตัวอย่างที่ถูกต้อง: [ฉาก: สถานที่=ร้านกาแฟใต้ตึก; เวลา=บ่ายโมง; พื้นหลัง=cafe]
อัปเดตสถานที่/เวลา/พื้นหลังให้สอดคล้องกับเหตุการณ์ที่เพิ่งเกิดขึ้น ถ้ายังอยู่ที่เดิมก็ใส่ค่าเดิม`;
}
