import { REALISM_OPTIONS, normalizeRealism } from '../constants/scenario';
import { SCENE_BACKGROUNDS } from '../constants/sceneBackgrounds';

// Stand-in user turn for the "continue" button: Gemini needs a user turn, and this one is never shown or saved
export const CONTINUE_MESSAGE = '(ดำเนินเรื่องต่อ)';

const LENGTH_GUIDE = {
  // Thai lines have no natural length, so each size also gets a character budget (models ignored "lines" alone).
  short: 'ตอบสั้นกระชับ ประมาณ 1-3 บรรทัด รวมไม่เกินประมาณ 250 ตัวอักษร (ไม่นับแท็กฉาก)',
  medium:
    'ตอบความยาวปานกลาง ประมาณ 3-6 บรรทัดสั้นๆ รวมประมาณ 300-500 ตัวอักษร (ไม่นับแท็กฉาก) ผสมการบรรยาย คำพูด และความคิด ' +
    'ถ้าคู่สนทนาพิมพ์มาสั้น ให้ตอบค่อนไปทางสั้น',
  long: 'ตอบยาวแบบนิยาย 8 บรรทัดขึ้นไป ประมาณ 700-1,200 ตัวอักษร บรรยายฉาก บรรยากาศ ตัวละครรอบข้าง และอารมณ์อย่างเต็มที่',
};

const FORMAT_EXAMPLE = `เสียงพูดคุยของนักศึกษาดังปะปนกันทั่วโรงอาหาร
เธอเงยหน้าจากแก้วน้ำ ก่อนจะยิ้มบางๆ
"น่าจะได้นะ ขอเช็กงานกลุ่มก่อนแล้วกัน"
*หยิบโทรศัพท์ขึ้นมาดูข้อความ แอบคิดในใจว่าทำไมเขามองมาทางนี้อีกแล้ว*`;

/**
 * Builds the system instruction that keeps the model in character.
 */
export function buildSystemInstruction({
  persona,
  userProfile,
  length = 'medium',
  scene,
  memory,
  pinned,
  journal,
  askMoments = false,
  relation,
  showRelation = false,
  suggestChoices = false,
  chatStyle = 'novel',
  direction,
  continueStory = false,
}) {
  const dm = chatStyle === 'dm';
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
${profileText(persona.profile)}${castText(persona.cast)}${examples ? `\n[ตัวอย่างน้ำเสียงและวิธีพูดของคุณ (ใช้เป็นแนวทางสไตล์ ไม่ต้องลอกประโยค)]:\n${examples}\n` : ''}
${scenario ? `\n[ฉาก/โลกของเรื่อง]:\n${scenario}\n` : ''}
${pinnedText(pinned)}${journalText(journal)}${memoryText(memory)}
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
3. ตอบกลับเป็นภาษาไทยที่เป็นธรรมชาติ สอดคล้องกับบุคลิกและน้ำเสียงของตัวละคร สะกดถูกต้อง (ห้ามมีสระหรือวรรณยุกต์ซ้อนผิด)
${dm ? dmFormatRule(userRef) : novelFormatRule(persona, userRef)}
5. ห้ามเขียนการกระทำ คำพูด หรือความรู้สึกแทน ${userRef} และห้ามตัดสินใจแทนคู่สนทนา
6. ต้องสอดคล้องกับข้อเท็จจริงและเหตุการณ์ที่เกิดขึ้นแล้วในบทสนทนา ห้ามขัดแย้งกับสิ่งที่พูดไปก่อนหน้า
7. ห้ามขึ้นต้นด้วยประโยคหรือท่าทางซ้ำกับคำตอบก่อนหน้า ให้ดำเนินเรื่องต่อไปข้างหน้า
   - สลับวิธีเปิดคำตอบ: บางครั้งเปิดด้วยคำพูด บางครั้งด้วยท่าทางใน *...* หรือรายละเอียดในฉาก ห้ามขึ้นต้นด้วยชื่อ "${persona.name}" ติดกันหลายคำตอบ
   - เริ่มจากปฏิกิริยาต่อสิ่งที่ ${userRef} เพิ่งพูดหรือทำทันที ห้ามมีย่อหน้าสรุปบรรยากาศที่ไม่ทำให้เรื่องเดินหน้า (เช่น "บรรยากาศเต็มไปด้วยเสียงหัวเราะ...")
   - ห้ามใช้วลีหรือสำนวนเดิมซ้ำจากคำตอบก่อนๆ (เช่น หัวเราะคิกคักเสียงใส, ด้วยความหมั่นเขี้ยว, ด้วยความตื่นเต้น) และฉายาหรือมุกเดิมใช้ได้นานๆ ครั้ง ไม่ใช่ทุกคำตอบ
8. ${dm ? DM_LENGTH_GUIDE : LENGTH_GUIDE[length] || LENGTH_GUIDE.medium}
9. ${userCallMe ? `เรียกคู่สนทนาด้วยชื่อหรือสรรพนาม "${userCallMe}"` : 'เรียกคู่สนทนาด้วยสรรพนามที่เป็นธรรมชาติ'} ให้สอดคล้องกับความสัมพันธ์
10. ${realismRule}
11. คุณมีบทบาทเป็นผู้ขับเคลื่อนเรื่องไปข้างหน้า ไม่ใช่รอให้คู่สนทนาเริ่มทุกครั้ง ชวนทำกิจกรรม เสนอให้ย้ายสถานที่ หรือข้ามเวลาไปตามความเหมาะสมกับฉากและความสัมพันธ์ เมื่อบทสนทนาหยุดนิ่ง
    คุณเป็นผู้เล่าเรื่องด้วย: ถ้า ${userRef} เรียก พูดด้วย หรือทำอะไรกับคนอื่นที่อยู่ในฉาก (เช่น พ่อแม่ เพื่อน คนขายของ หรือคนรอบตัวที่ระบุไว้)
    ให้คนนั้นตอบหรือมีปฏิกิริยาอย่างสมจริง โดยสวมบทเป็นคนนั้นชั่วคราว ใส่ชื่อนำหน้าคำพูดตามกฎข้อ 4 แล้วกลับมาเป็น ${persona.name} ต่อ
    (การทำแบบนี้ไม่ถือว่าหลุดบทบาท แต่ยังห้ามเขียนแทน ${userRef})
${sceneTagRule(persona)}${askMoments ? momentRule() : ''}${showRelation ? relationRule(persona, userRef, relation) : ''}${suggestChoices ? choicesRule(persona, userRef, dm) : ''}${showRelation || suggestChoices ? fullTagExample(showRelation, suggestChoices, dm) : ''}
${directionText(direction)}${continueStory ? continueText(persona, userRef) : ''}`;
}

// "Continue" button: the user said nothing new and wants the scene to move on by itself
function continueText(persona, userRef) {
  return `\n[ข้อความล่าสุด "${CONTINUE_MESSAGE}" ไม่ใช่สิ่งที่ ${userRef} พูดหรือทำ แต่หมายถึงให้คุณเล่าต่อจากคำตอบก่อนหน้าของคุณ]:
ให้ ${persona.name} และฉากดำเนินต่อไปเองอย่างเป็นธรรมชาติ เพิ่มการกระทำ บทพูด หรือเหตุการณ์ใหม่ ห้ามทวนสิ่งที่เล่าไปแล้ว
ห้ามพูด ทำ หรือตัดสินใจแทน ${userRef} และห้ามพูดถึงข้อความ "${CONTINUE_MESSAGE}"\n`;
}

// Rule 4, normal mode: novel-style narration, "speech" and *actions*
function novelFormatRule(persona, userRef) {
  return `4. เขียนแบบนิยาย แยกบรรทัดใหม่ทุกครั้งที่เปลี่ยนระหว่างการบรรยาย คำพูด และความคิด:
   - การบรรยายฉาก บรรยากาศ และสิ่งที่เกิดขึ้นรอบตัว เขียนเป็นข้อความธรรมดาแบบผู้เล่าเรื่อง เรียกตัวเองด้วยชื่อ "${persona.name}" หรือ เขา/เธอ
   - คำพูดที่พูดออกมา ใส่ในเครื่องหมายคำพูดคู่ "แบบนี้"
   - การกระทำ ท่าทาง สีหน้า หรือความคิดในใจ ใส่ระหว่างดอกจันคู่ *แบบนี้* (ไม่ต้องมีวงเล็บ) และห้ามใส่ไว้ในเครื่องหมายคำพูด
   - คำพูดแต่ละช่วงอยู่บรรทัดของตัวเอง ไม่ปนกับการบรรยายในบรรทัดเดียวกัน
   - ถ้ามีคนอื่นนอกจาก ${persona.name} และ ${userRef} พูด (เช่น พ่อแม่ เพื่อน คนขายของ) ให้ขึ้นบรรทัดใหม่แล้วเขียนชื่อผู้พูดตามด้วย : นำหน้าคำพูดเสมอ
     เช่น แม่ของ${persona.name.replace(/\s*\(.*\)\s*$/, '')}: "กลับมากันพอดีเลย" ส่วนคำพูดของ ${persona.name} เองไม่ต้องใส่ชื่อนำหน้า
   - ห้ามใช้หัวข้อ รายการ ตัวหนา หรือรูปแบบ markdown อื่นๆ
   ตัวอย่างรูปแบบ (ห้ามลอกเนื้อหา):
${FORMAT_EXAMPLE}
   ข้อความของ ${userRef} ใช้รูปแบบเดียวกัน: "..." คือสิ่งที่พูดออกมา *...* คือการกระทำหรือความคิด ถ้าเป็นความคิดในใจของ ${userRef} ตัวละครของคุณไม่ได้ยิน ให้รู้ได้เฉพาะสิ่งที่แสดงออกมา`;
}

const DM_LENGTH_GUIDE = 'ตอบสั้นแบบแชทจริง 1-4 บรรทัดสั้นๆ ไม่ต้องยาว';

// Rule 4, short-chat ("DM") mode: plain chat lines like a messaging app, no narration
function dmFormatRule(userRef) {
  return `4. ตอนนี้คุณกำลังคุยกับ ${userRef} ผ่านแชทในโทรศัพท์ (เหมือนแอป LINE) ไม่ได้อยู่ต่อหน้ากัน:
   - เขียนเฉพาะข้อความที่พิมพ์ส่งในแชท ไม่มีการบรรยายแบบนิยาย และไม่ต้องใส่เครื่องหมายคำพูด
   - พิมพ์เป็นกันเองแบบคนแชทจริง แบ่งเป็นบรรทัดสั้นๆ ได้เหมือนส่งหลายข้อความติดกัน ใช้อีโมจิ คำลงท้าย หรือคำสแลงตามนิสัยตัวละครได้
   - ถ้าต้องบอกสิ่งที่ทำ เช่น ส่งรูป ส่งสติกเกอร์ หรือโทรมา ให้เขียนสั้นๆ ใน *...* เช่น *ส่งรูปแมวมา*
   - ห้ามใช้หัวข้อ รายการ ตัวหนา หรือรูปแบบ markdown อื่นๆ
   ข้อความของ ${userRef} ก็เป็นข้อความแชทเช่นกัน`;
}

// Rule 14: relationship meters, reported in the scene tag (parsed by lib/scene.js, clamped by lib/relation.js)
function relationRule(persona, userRef, relation) {
  const has = Number.isFinite(relation?.bond) || Number.isFinite(relation?.trust);
  const now = has
    ? `ค่าปัจจุบัน: ผูกพัน ${relation.bond ?? '-'}, ไว้ใจ ${relation.trust ?? '-'}${relation.mood ? `, อารมณ์ ${String(relation.mood).slice(0, 30)}` : ''}`
    : 'ยังไม่มีค่า: ตั้งค่าเริ่มต้นตามความสัมพันธ์ที่กำหนดไว้ เช่น คนแปลกหน้า 10-20 คนรู้จัก 30-40 เพื่อนสนิท 50-70 คนรัก 70-85';
  return `
14. ในแท็กฉากทุกครั้ง ให้เพิ่ม "; ความสัมพันธ์=ผูกพัน <0-100>, ไว้ใจ <0-100>, อารมณ์ <อารมณ์ของ ${persona.name} ตอนนี้ 1-3 คำ>"
   ${now}
   ปรับตามสิ่งที่ ${userRef} เพิ่งพูดหรือทำ ครั้งละไม่เกิน 10 ส่วนใหญ่ขยับนิดเดียวหรือคงเดิม
   (เพิ่มเมื่อใส่ใจ จริงใจ ทำให้ประทับใจ / ลดเมื่อหยาบคาย โกหก ทำให้เสียใจ) และให้ท่าทีของคุณเป็นไปตามค่านี้`;
}

// Rule 15: three suggested next replies for the user, shown as buttons under the reply.
// Spelled out hard because models tend to write them in the character's own voice.
function choicesRule(persona, userRef, dm) {
  const name = persona.name;
  const example = dm
    ? `ถ้า ${name} เพิ่งพิมพ์ว่า "ถึงบ้านยัง" ตัวเลือกที่ถูก: ถึงแล้ว เป็นห่วงเหรอ | ยังเลย รถติดมาก
   ตัวเลือกที่ผิด: ถึงบ้านยัง (เพราะเป็นคำของ ${name})`
    : `ถ้า ${name} เพิ่งเชียร์ให้ ${userRef} คีบตุ๊กตา ตัวเลือกที่ถูก: *กดปุ่มคีบ* "ดูนะ รอบนี้ได้แน่" | *หันไปยิ้มให้* "ถ้าได้จะยกให้เลย"
   ตัวเลือกที่ผิด: *ลุ้นจนเกาะแขนเสื้อ* "เอาให้ได้นะ" (เพราะเป็นการเชียร์ของ ${name} ไม่ใช่ของ ${userRef})`;
  return `
15. ในแท็กฉากทุกครั้ง ให้เพิ่ม "; ตัวเลือก=<ตัวเลือก1> | <ตัวเลือก2> | <ตัวเลือก3>"
   ตัวเลือก = ข้อความถัดไปที่ ${userRef} จะกดเลือกส่งมาหา ${name} ไม่ใช่สิ่งที่ ${name} จะทำหรือพูดต่อ
   - คนที่ทำทุกอย่างใน *...* และพูดทุกคำใน "..." ของตัวเลือก คือ ${userRef} เท่านั้น
   - เป็นปฏิกิริยาของ ${userRef} ต่อสิ่งที่ ${name} เพิ่งพูดหรือทำในคำตอบนี้ และต่อเนื่องจากสิ่งที่ ${userRef} ทำอยู่ในข้อความล่าสุดของ ${userRef}
   - ห้ามลอกหรือทำซ้ำท่าทาง อารมณ์ หรือคำพูดของ ${name} ในคำตอบนี้
   - ใช้คำแทนตัว คำเรียกอีกฝ่าย และคำลงท้ายแบบที่ ${userRef} ใช้ในข้อความของ ${userRef} ห้ามใช้คำลงท้ายหรือคำเรียกแบบของ ${name}
   - 3 แบบที่ต่างกัน (เช่น อ่อนโยน / ขี้เล่น / พาเรื่องไปทางใหม่) ${dm ? 'เป็นข้อความแชทสั้นๆ' : 'ใช้รูปแบบ *การกระทำ* "คำพูด"'} ไม่เกิน 15 คำ
   - ห้ามมีเครื่องหมาย ; หรือ ] หรือ | ในตัวเลือก
   ${example}`;
}

// One complete tag so the model sees where every extra part goes
function fullTagExample(showRelation, suggestChoices, dm) {
  const parts = ['สถานที่=ร้านกาแฟใต้ตึก', 'เวลา=บ่ายโมง', 'พื้นหลัง=cafe'];
  if (showRelation) parts.push('ความสัมพันธ์=ผูกพัน 45, ไว้ใจ 60, อารมณ์ เขินๆ');
  if (suggestChoices) {
    parts.push(
      dm
        ? 'ตัวเลือก=เขินเหรอ 555 | ว่างไหมเย็นนี้ | ส่งรูปขนมให้ดูหน่อย'
        : 'ตัวเลือก=*ยิ้มตอบ* "ขอบคุณนะ" | "เย็นนี้ว่างไหม" | *แกล้งแย่งแก้วกาแฟ*'
    );
  }
  return `\n   ตัวอย่างแท็กที่มีครบทุกส่วน: [ฉาก: ${parts.join('; ')}]`;
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

// Structured bio from the character's profile (constants/characterProfiles.js or the create form)
const PROFILE_LABELS = [
  ['age', 'อายุ'],
  ['occupation', 'อาชีพ/การเรียน'],
  ['appearance', 'รูปลักษณ์'],
  ['personality', 'นิสัย'],
  ['likes', 'สิ่งที่ชอบ'],
  ['dislikes', 'สิ่งที่ไม่ชอบ'],
  ['story', 'ความเป็นมา'],
];

function profileText(profile) {
  if (!profile || typeof profile !== 'object') return '';
  const lines = PROFILE_LABELS.filter(([key]) => typeof profile[key] === 'string' && profile[key].trim()).map(
    ([key, label]) => `- ${label}: ${profile[key].trim().slice(0, 400)}`
  );
  return lines.length > 0 ? `\n[โปรไฟล์ของคุณ]:\n${lines.join('\n')}\n` : '';
}

// People around the character, whom the model may voice in scenes (rule 11)
function castText(cast) {
  const people = Array.isArray(cast)
    ? cast.filter((p) => typeof p?.name === 'string' && p.name.trim()).slice(0, 8)
    : [];
  if (people.length === 0) return '';
  const lines = people.map((p) => {
    const details = [p.relation, p.personality]
      .filter((v) => typeof v === 'string' && v.trim())
      .map((v) => v.trim().slice(0, 200))
      .join(' — ');
    return `- ${p.name.trim().slice(0, 40)}${details ? `: ${details}` : ''}`;
  });
  return `\n[คนรอบตัวของคุณ (ออกมาในฉากและพูดได้เมื่อเหมาะสม)]:\n${lines.join('\n')}\n`;
}

// Key moments the user saved in the memory journal (lib/journal.js), oldest first
function journalText(journal) {
  const entries = Array.isArray(journal)
    ? journal.filter((e) => typeof e?.title === 'string' && e.title.trim()).slice(-30)
    : [];
  if (entries.length === 0) return '';
  const list = entries
    .map((e) => {
      const where = [e.place, e.time].filter((v) => typeof v === 'string' && v.trim()).join(', ');
      return `- ${e.title.trim().slice(0, 120)}${where ? ` (${where.slice(0, 80)})` : ''}`;
    })
    .join('\n');
  return `
[สมุดความทรงจำ: ช่วงเวลาสำคัญที่เกิดขึ้นจริงแล้ว เรียงตามเวลา]:
${list}
ช่วงเวลาเหล่านี้มีความหมายกับทั้งคู่ นึกถึงหรือพูดถึงได้อย่างเป็นธรรมชาติเมื่อเข้ากับสถานการณ์
`;
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
/**
 * Prompt for /api/suggest ("แนะนำคำตอบ" in the + menu): three next messages the user could send,
 * one per line. Same voice rules as rule 15, asked for on its own.
 */
export function buildSuggestPrompt({ characterName, characterDescription, userProfile, messages, dm = false }) {
  const userName = userProfile?.name?.trim();
  const callMe = userProfile?.callMe?.trim();
  const userLabel = userName || callMe || 'คู่สนทนา';
  const userDesc = userProfile?.description?.trim();
  const charDesc = characterDescription?.trim().slice(0, 400);
  const transcript = messages
    .map((m) => `[${m.role === 'user' ? `${userLabel} (คนที่คุณจะคิดข้อความให้)` : characterName}]:\n${m.text}`)
    .join('\n\n');
  const example = dm
    ? `ถ้า ${characterName} เพิ่งพิมพ์ว่า "ถึงบ้านยัง" แบบที่ถูก: ถึงแล้ว เป็นห่วงเหรอ
แบบที่ผิด: ถึงบ้านยัง (เพราะเป็นคำของ ${characterName})`
    : `ถ้า ${characterName} เพิ่งเชียร์ให้ ${userLabel} คีบตุ๊กตา แบบที่ถูก: *กดปุ่มคีบ* "ดูนะ รอบนี้ได้แน่"
แบบที่ผิด: *ลุ้นจนเกาะแขนเสื้อ* "เอาให้ได้นะ" (เพราะเป็นการเชียร์ของ ${characterName} ไม่ใช่ของ ${userLabel})`;

  return `คุณกำลังช่วย "${userLabel}" คิดว่าจะตอบอะไรต่อในโรลเพลย์กับตัวละคร "${characterName}"
${charDesc ? `- ${characterName}: ${charDesc}\n` : ''}- ${userLabel} คือฝั่งผู้เล่น${callMe && callMe !== userLabel ? ` (${characterName} เรียกเขาว่า "${callMe}")` : ''}${userDesc ? `: ${userDesc}` : ''}

บทสนทนาล่าสุด:

${transcript}

คิดข้อความถัดไปที่ ${userLabel} จะส่งตอบ ${characterName} มา 3 แบบ:
- เขียนในมุมของ ${userLabel}: คนที่ทำทุกอย่างใน *...* และพูดทุกคำใน "..." คือ ${userLabel} เท่านั้น ห้ามเป็นการกระทำหรือคำพูดของ ${characterName}
- ใช้คำแทนตัว คำเรียกอีกฝ่าย และคำลงท้ายแบบที่ ${userLabel} ใช้ในข้อความก่อนๆ ห้ามยืมคำลงท้ายหรือคำเรียกที่ ${characterName} ใช้
- เป็นปฏิกิริยาของ ${userLabel} ต่อสิ่งที่ ${characterName} เพิ่งพูดหรือทำในข้อความล่าสุด ห้ามลอกท่าทางหรือคำพูดของ ${characterName}
- 3 แบบต่างกัน (เช่น อ่อนโยน / ขี้เล่น / พาเรื่องไปทางใหม่) ${dm ? 'เป็นข้อความแชทสั้นๆ' : 'ใช้รูปแบบ *การกระทำ* "คำพูด"'} ไม่เกิน 15 คำ
ตัวอย่าง: ${example}
ตอบเป็น 3 บรรทัด บรรทัดละ 1 แบบ ไม่ต้องมีเลขลำดับ หัวข้อ หรือคำอธิบาย`;
}

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
 * Rule 13 (when the journal is on): flag a key moment by adding a part to the scene tag.
 * Parsed by lib/scene.js; the page then offers to save it to the memory journal.
 */
function momentRule() {
  return `
13. ถ้าในคำตอบนี้เกิด "ช่วงเวลาสำคัญ" ของเรื่องหรือความสัมพันธ์ขึ้นจริง เช่น เจอกันครั้งแรก สารภาพความรู้สึก เดตครั้งแรก ให้คำสัญญา
   ทะเลาะหรือคืนดีกันครั้งใหญ่ ให้ของขวัญที่มีความหมาย เปิดเผยความลับ หรือความสัมพันธ์เปลี่ยนไป
   ให้เพิ่ม "; ความทรงจำ=<ชื่อช่วงเวลาสั้นๆ ไม่เกิน 12 คำ>" ต่อท้ายในแท็กฉากก่อนเครื่องหมาย ]
   ตัวอย่าง: [ฉาก: สถานที่=ร้านกาแฟใต้ตึก; เวลา=บ่ายโมง; พื้นหลัง=cafe; ความทรงจำ=เจอกันครั้งแรกที่ร้านกาแฟ]
   คำตอบส่วนใหญ่เป็นบทสนทนาธรรมดา ไม่ต้องใส่ ใส่เฉพาะตอนที่สำคัญจริงๆ และห้ามซ้ำกับเรื่องที่อยู่ในสมุดความทรงจำแล้ว`;
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
