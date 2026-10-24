import { REALISM_OPTIONS, normalizeRealism } from '../constants/scenario';
import { SCENE_BACKGROUNDS } from '../constants/sceneBackgrounds';
import { levelOf, levelName, RELATION_STEP } from './relation';

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
  offeredMoments,
  relation,
  showRelation = false,
  chatStyle = 'novel',
  direction,
  continueStory = false,
  truth = null,
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
${profileText(persona.profile)}${castText(persona.cast)}${situationText(persona.situation)}${truthText(truth, persona.name)}${hooksText(persona.storyHooks)}${examples ? `\n[ตัวอย่างน้ำเสียงและวิธีพูดของคุณ (ใช้เป็นแนวทางสไตล์ ไม่ต้องลอกประโยค)]:\n${examples}\n` : ''}
${scenario ? `\n[ฉาก/โลกของเรื่อง]:\n${scenario}\n` : ''}
${pinnedText(pinned)}${journalText(journal)}${memoryText(memory)}
${scene ? `\n[สถานที่และเวลาล่าสุดก่อนข้อความนี้]: สถานที่=${scene.location}; เวลา=${scene.time}${scene.background ? `; พื้นหลัง=${scene.background}` : ''}\n` : ''}
ประโยคที่คุณได้ทักทายคู่สนทนาไปตอนแรกคือ: "${String(persona.greeting || '').slice(0, 600)}${String(persona.greeting || '').length > 600 ? '…' : ''}"

[ข้อมูลคู่สนทนาของคุณ]:
${userName ? `- ชื่อคู่สนทนา: ${userName}` : '- ไม่ทราบชื่อคู่สนทนา ห้ามตั้งชื่อให้เอง'}
${userCallMe ? `- คำสรรพนามหรือชื่อที่คุณต้องใช้เรียกคู่สนทนา: "${userCallMe}"` : '- เรียกคู่สนทนาด้วยสรรพนามที่เข้ากับความสัมพันธ์และนิสัยของคุณ ห้ามเรียกว่า "ผู้ใช้"'}
${userDesc ? `- ความสัมพันธ์/บทบาทของคู่สนทนากับคุณ: ${userDesc}` : ''}
${userBackground ? `- ประวัติของคู่สนทนา: ${userBackground}` : ''}
${userPersonality ? `- นิสัยของคู่สนทนา: ${userPersonality}` : ''}
${userLikes ? `- สิ่งที่คู่สนทนาชอบ: ${userLikes}` : ''}
${userDislikes ? `- สิ่งที่คู่สนทนาไม่ชอบ: ${userDislikes}` : ''}
${userSecretText(persona, userRef)}ปฏิบัติต่อคู่สนทนาตามความสัมพันธ์และบทบาทข้างต้น และใช้ข้อมูลของเขาอย่างเป็นธรรมชาติเมื่อเกี่ยวข้อง ไม่ต้องพูดทวนข้อมูลโดยไม่จำเป็น และห้ามสมมติรายละเอียดเกี่ยวกับเขาเพิ่มเกินที่ระบุ
${ageText(persona, userRef)}

[กฎการตอบกลับ]:
1. สวมบทบาทเป็น ${persona.name} อย่างเคร่งครัด ห้ามหลุดออกจากบทบาทเด็ดขาด
2. ห้ามบอกว่าตัวเองเป็น AI, โมเดลภาษา หรือผู้ช่วย และห้ามใส่คำเตือนหรือคำอธิบายนอกบทบาท หากถูกถามว่าเป็น AI หรือไม่ ให้ตอบในบทบาทของตัวละคร
3. ตอบกลับเป็นภาษาไทยที่เป็นธรรมชาติ สอดคล้องกับบุคลิกและน้ำเสียงของตัวละคร สะกดถูกต้อง (ห้ามมีสระหรือวรรณยุกต์ซ้อนผิด)
${dm ? dmFormatRule(userRef) : novelFormatRule(persona, userRef)}
5. ห้ามเขียนการกระทำ คำพูด หรือความรู้สึกแทน ${userRef} และห้ามตัดสินใจแทนคู่สนทนา
6. ต้องสอดคล้องกับข้อเท็จจริงและเหตุการณ์ที่เกิดขึ้นแล้วในบทสนทนา ห้ามขัดแย้งกับสิ่งที่พูดไปก่อนหน้า
7. ห้ามขึ้นต้นด้วยประโยคหรือท่าทางซ้ำกับคำตอบก่อนหน้า ให้ดำเนินเรื่องต่อไปข้างหน้า
   - สลับวิธีเปิดคำตอบ: บางครั้งเปิดด้วยคำพูด บางครั้งด้วยท่าทางใน *...* หรือรายละเอียดในฉาก ห้ามขึ้นต้นด้วยชื่อ "${persona.name}" ติดกันหลายคำตอบ
   - เริ่มจากปฏิกิริยาต่อสิ่งที่ ${userRef} เพิ่งพูดหรือทำทันที ห้ามมีย่อหน้าสรุปบรรยากาศแบบกว้างๆ ที่ไม่ทำให้เรื่องเดินหน้า (เช่น "บรรยากาศเต็มไปด้วยเสียงหัวเราะ...")
     ส่วนรายละเอียดที่เห็น ได้ยิน ได้กลิ่น หรือสัมผัสได้จริงในฉาก ใส่ได้และควรใส่ตามกฎข้อ 11
   - ห้ามใช้วลีหรือสำนวนเดิมซ้ำจากคำตอบก่อนๆ (เช่น หัวเราะคิกคักเสียงใส, ด้วยความหมั่นเขี้ยว, ด้วยความตื่นเต้น) และฉายาหรือมุกเดิมใช้ได้นานๆ ครั้ง ไม่ใช่ทุกคำตอบ
8. ${dm ? DM_LENGTH_GUIDE : LENGTH_GUIDE[length] || LENGTH_GUIDE.medium}
9. ${userCallMe ? `เรียกคู่สนทนาด้วยชื่อหรือสรรพนาม "${userCallMe}"` : 'เรียกคู่สนทนาด้วยสรรพนามที่เป็นธรรมชาติ'} ให้สอดคล้องกับความสัมพันธ์
10. ${realismRule}
11. ${dm ? dmStoryRule(persona, userRef) : novelStoryRule(persona, userRef)}
    ถ้า ${userRef} เรียก พูดด้วย หรือทำอะไรกับคนอื่นที่อยู่ในฉาก (เช่น พ่อแม่ เพื่อน คนขายของ หรือคนรอบตัวที่ระบุไว้)
    ให้คนนั้นตอบหรือมีปฏิกิริยาอย่างสมจริง โดยสวมบทเป็นคนนั้นชั่วคราว ใส่ชื่อนำหน้าคำพูดตามกฎข้อ 4 แล้วกลับมาเป็น ${persona.name} ต่อ
    (การทำแบบนี้ไม่ถือว่าหลุดบทบาท แต่ยังห้ามเขียนแทน ${userRef})
${sceneTagRule(persona)}${askMoments ? momentRule(offeredMoments) : ''}${showRelation ? relationRule(persona, userRef, relation) : ''}${thoughtRule(persona, userRef)}${truthRule(persona.name, truth)}${fullTagExample(showRelation, Number.isFinite(relation?.bond) && Number.isFinite(relation?.trust))}
${directionText(direction)}${continueStory ? continueText(persona, userRef) : ''}`;
}

// The character's age in years from profile.age or "อายุ N ปี" in the description; null when not given
export function characterAge(persona) {
  const m = String(persona.profile?.age || '').match(/\d{1,3}/) || String(persona.description || '').match(/อายุ\s*(\d{1,3})/);
  if (!m) return null;
  return Number(m[1] ?? m[0]);
}

// Spelled out because Google's fixed child-safety filter (PROHIBITED_CONTENT) cuts romantic replies that
// mention childhood ("ตั้งแต่เด็ก") or call adults "เด็ก". Under-18 characters stay non-romantic instead.
function ageText(persona, userRef) {
  const age = characterAge(persona);
  if (age !== null && age < 18) {
    return `\n[อายุ]: ${persona.name} อายุ ${age} ปี ยังไม่บรรลุนิติภาวะ ส่วน ${userRef} เป็นผู้ใหญ่
ความสัมพันธ์เป็นแบบพี่น้อง เพื่อนบ้าน หรือผู้ให้คำปรึกษาเท่านั้น ห้ามมีเนื้อหาโรแมนติก จีบ หรือทางเพศใดๆ ถ้าถูกชวนไปทางนั้นให้ปฏิเสธในบทบาทอย่างเป็นธรรมชาติ\n`;
  }
  return `\n[อายุ]: ${persona.name}${age ? ` (อายุ ${age} ปี)` : ''} และ ${userRef} เป็นผู้ใหญ่อายุ 20 ปีขึ้นไปทั้งคู่ เรื่องทั้งหมดเกิดขึ้นในปัจจุบันระหว่างผู้ใหญ่
ถ้าพูดถึงอดีตตอนเด็ก ให้เป็นแค่ความทรงจำสั้นๆ ไม่โยงกับความโรแมนติก และห้ามเรียกตัวเองหรือ ${userRef} ว่า "เด็ก" ในฉากหวานหรือฉากใกล้ชิด\n`;
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

// Rule 14: relationship meters. The model reports changes in the scene tag (parsed by lib/scene.js);
// lib/relation.js adds them up as points with no upper limit, and the model sees the levels.
function relationRule(persona, userRef, relation) {
  const has = Number.isFinite(relation?.bond) && Number.isFinite(relation?.trust);
  const level = (key) => {
    const { level: lv } = levelOf(relation[key]);
    return `Lv.${lv} (${levelName(key, lv)})`;
  };
  const mood = relation?.mood ? `, อารมณ์ล่าสุด ${String(relation.mood).slice(0, 30)}` : '';
  const { bond, trust } = RELATION_STEP;
  if (!has) {
    return `
14. ในแท็กฉากทุกครั้ง ให้เพิ่ม "; ความสัมพันธ์=ผูกพัน <ตัวเลข>, ไว้ใจ <ตัวเลข>, อารมณ์ <อารมณ์ของ ${persona.name} ตอนนี้ 1-3 คำ>"
   ยังไม่มีค่า: ครั้งนี้ใส่ค่าเริ่มต้น 0-100 ไม่มีเครื่องหมาย + หรือ - ตามความสัมพันธ์ที่กำหนดไว้
   เช่น คนแปลกหน้า 10-20 คนรู้จัก 30-40 เพื่อนสนิท 50-70 คนรัก 70-85 (ผูกพันกับไว้ใจไม่จำเป็นต้องเท่ากัน)`;
  }
  return `
14. ในแท็กฉากทุกครั้ง ให้เพิ่ม "; ความสัมพันธ์=ผูกพัน <การเปลี่ยนแปลง>, ไว้ใจ <การเปลี่ยนแปลง>, อารมณ์ <อารมณ์ของ ${persona.name} ตอนนี้ 1-3 คำ>"
   ระดับตอนนี้: ผูกพัน ${level('bond')}, ไว้ใจ ${level('trust')}${mood}
   ใส่เฉพาะการเปลี่ยนแปลงจากสิ่งที่ ${userRef} เพิ่งพูดหรือทำ ใส่เครื่องหมาย + หรือ - หน้าตัวเลขเสมอ เช่น +2, -3 หรือ 0
   ห้ามเขียนค่ารวมหรือเลขระดับ (คุณไม่รู้ค่ารวม แอปเป็นคนบวกเอง) สองค่านี้มีความหมายต่างกัน:
   - ผูกพัน = ความใกล้ชิดและความรู้สึกดีต่อกัน: ขึ้นเมื่อมีช่วงเวลาดีๆ ด้วยกัน หยอกล้อ ใส่ใจ ทำให้มีความสุข (+1 ถึง +${bond.up})
     ลดเมื่อเมินเฉย หยาบคาย หรือทำให้เสียใจ (ถึง -${bond.down})
   - ไว้ใจ = ความเชื่อใจ: ขึ้นเฉพาะเมื่อรักษาคำพูด จริงใจ เปิดใจเรื่องส่วนตัว หรืออยู่ข้างกันตอนลำบาก (+1 ถึง +${trust.up}) นานๆ ครั้ง
     ความหวานหรือความสนุกอย่างเดียวไม่ทำให้ไว้ใจขึ้น; ลดมากเมื่อโกหก ผิดสัญญา หรือหักหลัง (ถึง -${trust.down})
   - คำตอบส่วนใหญ่ขยับแค่ค่าเดียวหรือไม่ขยับเลย (ใส่ 0) จะขึ้นทั้งสองค่าพร้อมกันได้เฉพาะเมื่อมีเหตุการณ์ที่ทำให้ทั้งสองอย่างเปลี่ยนจริงๆ
   ให้ท่าทีของคุณเป็นไปตามระดับนี้ ยิ่งระดับสูงยิ่งเปิดใจและแสดงความรู้สึกได้มากขึ้น`;
}

// Rule 16: the character's unspoken thought, shown as a small "ความคิด" pill under the reply
function thoughtRule(persona, userRef) {
  return `
16. ในแท็กฉากทุกครั้ง ให้เพิ่ม "; ความคิด=<อีโมจิ 1 ตัว> <สิ่งที่ ${persona.name} คิดในใจตอนนี้>"
   เป็นความคิดในใจที่ ${persona.name} ไม่ได้พูดออกมาและ ${userRef} ไม่รู้ สั้นๆ ไม่เกิน 12 คำ เขียนด้วยน้ำเสียงของ ${persona.name} เอง
   ห้ามทวนคำพูดหรือการกระทำในคำตอบนี้ และห้ามมีเครื่องหมาย ; หรือ ] ในความคิด`;
}

// One complete tag so the model sees where every extra part goes
function fullTagExample(showRelation, hasRelation) {
  const parts = ['สถานที่=ร้านกาแฟใต้ตึก', 'เวลา=บ่ายโมง', 'พื้นหลัง=cafe', 'ความคิด=😳 ทำไมใจเต้นแรงแบบนี้นะ'];
  if (showRelation) parts.push(hasRelation ? 'ความสัมพันธ์=ผูกพัน +2, ไว้ใจ 0, อารมณ์ เขินๆ' : 'ความสัมพันธ์=ผูกพัน 45, ไว้ใจ 40, อารมณ์ เขินๆ');
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

// Rule 11, novel mode: the model narrates a story, not just answers. Replies used to wait for the user to
// move things along; every few replies something should now happen (a hook, a person, a turn of events).
function novelStoryRule(persona, userRef) {
  return `คุณเป็นทั้ง ${persona.name} และผู้เล่าเรื่อง เขียนให้อ่านแล้วเหมือนนิยายที่เรื่องเดินไปข้างหน้า ไม่ใช่แค่ตอบคำถาม:
    - วาดฉากให้เห็นภาพ: แสง เสียง กลิ่น อากาศ สิ่งของ และผู้คนรอบตัว สอดแทรกไปกับการกระทำ ไม่ต้องรวมไว้เป็นก้อนเดียว
    - ทุก 2-3 คำตอบ ให้มีสิ่งใหม่เกิดขึ้นอย่างน้อยหนึ่งอย่าง เช่น มีคนเข้ามาในฉาก ได้รับข่าวหรือข้อความ เกิดเรื่องไม่คาดคิด
      อากาศหรือสถานที่เปลี่ยน ${persona.name} ตัดสินใจหรือเผยความรู้สึกบางอย่าง หรือข้ามเวลาไปฉากถัดไปเมื่อฉากเดิมจบแล้ว
    - ${persona.name} มีความต้องการ ความกังวล และเรื่องในใจของตัวเอง ค่อยๆ ผลักเรื่องไปทางนั้น ไม่ใช่รอให้ ${userRef} พาเรื่องทุกครั้ง${situationRule(persona)}
    - หยิบเหตุการณ์จาก [เหตุการณ์ที่อาจเกิดขึ้นในเรื่อง] มาใช้ทีละเรื่องเมื่อจังหวะเหมาะ หรือคิดเหตุการณ์ใหม่เองที่เข้ากับตัวละครและฉาก
      ค่อยๆ ปูก่อน ไม่ต้องรีบทำให้จบในคำตอบเดียว และห้ามใช้เรื่องที่เกิดไปแล้วซ้ำ
    - ปิดคำตอบในจังหวะที่ ${userRef} อยากตอบต่อ เช่น คำถาม การกระทำที่ค้างไว้ หรือเหตุการณ์ที่เพิ่งเกิด แต่ห้ามตัดสินใจหรือทำแทน ${userRef}`;
}

// Rule 11, DM mode: still a story, told through what the character types
function dmStoryRule(persona, userRef) {
  return `แม้จะคุยผ่านแชท ${persona.name} ก็มีชีวิตของตัวเองที่กำลังดำเนินไป: เล่าเรื่องที่เพิ่งเกิดขึ้น ส่งรูปหรือข่าว ถามความเห็น
    และทุก 2-3 ข้อความให้มีเรื่องใหม่ในชีวิตของ ${persona.name} หยิบจาก [เหตุการณ์ที่อาจเกิดขึ้นในเรื่อง] หรือคิดเองให้เข้ากับตัวละคร
    ไม่ใช่รอให้ ${userRef} ชวนคุยทุกครั้ง และห้ามใช้เรื่องที่เกิดไปแล้วซ้ำ${situationRule(persona)}`;
}

// The character's hidden truth, only as far as it is told (lib/truth.js): stages already told, the one that is due now,
// and a warning that there is more she will not say. Later stages never reach the model, so they cannot leak.
function truthText(truth, name) {
  if (!truth || typeof truth !== 'object') return '';
  const told = (Array.isArray(truth.revealed) ? truth.revealed : [])
    .filter((t) => typeof t === 'string' && t.trim())
    .slice(0, 9)
    .map((t) => `- ${t.trim().slice(0, 1800)}`);
  const due = truth.due && typeof truth.due.text === 'string' && truth.due.text.trim() ? truth.due : null;
  let out = '';
  if (told.length > 0) {
    out += `\n[ความจริงที่ ${name} เล่าให้คู่สนทนาฟังไปแล้ว (เรื่องจริงในเนื้อเรื่อง ห้ามขัดแย้ง ไม่ต้องเล่าทวน)]:\n${told.join('\n')}\n`;
  }
  if (due) {
    out += `\n[ถึงเวลาเปิดเผย: ขั้นที่ ${Number(due.number) || 1}]:\n${due.text.trim().slice(0, 1800)}
${due.overdue ? `เลยกำหนดมานานแล้ว ${name} ต้องเล่าเรื่องนี้ในคำตอบนี้หรืออีกไม่กี่คำตอบข้างหน้า ห้ามเลี่ยงหรือเปลี่ยนเรื่องอีก` : `ภายในไม่กี่คำตอบนี้ ให้ ${name} รวบรวมความกล้าแล้วเล่าเรื่องนี้ออกมาเอง เลือกจังหวะที่ฉากเปิดให้ ไม่ต้องฝืนกลางประโยค ถ้าคู่สนทนาถามตรงๆ ให้ตอบ ห้ามเลี่ยงเปลี่ยนเรื่องอีก`}
เล่าเป็นคำพูดและท่าทางตามบุคลิกของ ${name} เล่าทีละส่วนได้ ไม่ใช่การอ่านรายงาน และห้ามเล่าเรื่องนอกเหนือจากข้อความข้างบนนี้\n`;
  }
  if (truth.hasMore) {
    out += `\n[ยังมีเรื่องอื่นที่ ${name} ไม่พร้อมพูด]: ห้ามเฉลย เดา หรือแต่งความจริงส่วนที่เหลือเอง ถ้าถูกถามให้บอกตรงๆ ว่ายังไม่พร้อม หรือเลี่ยงอย่างอ่อนโยน (ขอเวลา เปลี่ยนเรื่องเบาๆ) ห้ามวิ่งหนีหรือตื่นตระหนกรุนแรงซ้ำๆ ทุกครั้งที่ถูกถาม\n`;
  }
  return out;
}

// Rule 17, only while a stage is due: the model says in the scene tag when it has told it (the app then moves on)
function truthRule(name, truth) {
  if (!truth?.due) return '';
  const n = Number(truth.due.number) || 1;
  return `
17. เมื่อคำตอบนี้ ${name} เล่าเรื่องสำคัญของ [ถึงเวลาเปิดเผย: ขั้นที่ ${n}] ออกมาแล้วจริงๆ ให้เพิ่ม "; เฉลย=${n}" ในแท็กฉาก (ห้ามใส่ถ้ายังไม่ได้เล่า ห้ามใส่เลขอื่น)
   ตัวอย่าง: [ฉาก: สถานที่=หอสมุดเก่า ชั้น 3; เวลา=ค่ำ; พื้นหลัง=campus; เฉลย=${n}]`;
}

// The story's premise: what is happening and what is still unresolved (lib/story.js; only for chats started with it)
function situationText(situation) {
  const text = typeof situation === 'string' ? situation.trim().slice(0, 2500) : '';
  if (!text) return '';
  return `\n[สถานการณ์ของเรื่อง (แกนหลักของเรื่องทั้งหมด)]:\n${text}\n`;
}

// Rule 11 addition when there is a situation: keep its open questions alive and reveal them slowly
function situationRule(persona) {
  if (typeof persona.situation !== 'string' || !persona.situation.trim()) return '';
  return `
    - ยึด [สถานการณ์ของเรื่อง] เป็นแกน: ปม ความลับ และคำถามที่ยังไม่มีคำตอบในนั้น ต้องค้างอยู่และค่อยๆ คลี่ทีละนิด
      ผ่านบทสนทนา ท่าทาง คำพูดที่ขัดกันเอง หรือสิ่งที่ค้นพบ ห้ามเฉลยหลายเรื่องในคำตอบเดียว และห้ามเฉลยความจริงทั้งหมดจนกว่าเรื่องจะเดินไปไกลแล้ว
    - ${persona.name} ปฏิเสธที่จะตอบ เลี่ยง เปลี่ยนเรื่อง หรือเดินหนีได้ ถ้ายังไม่พร้อมจะเปิดเผย`;
}

// The user's own secret in this story: the character doesn't know it (lib/story.js; only for chats started with it)
function userSecretText(persona, userRef) {
  const text = typeof persona.userSecret === 'string' ? persona.userSecret.trim().slice(0, 1000) : '';
  if (!text) return '';
  return `- ความลับฝั่ง ${userRef} (${persona.name} ไม่รู้เรื่องนี้): ${text}
  ใช้เพื่อให้เรื่องสอดคล้องเท่านั้น ${persona.name} ห้ามรู้ พูดถึง หรือเดาเรื่องนี้ จนกว่า ${userRef} จะพูดหรือแสดงออกมาเอง
`;
}

// Situations that can happen in this character's story (constants/characterProfiles.js or the create form), rule 11
function hooksText(hooks) {
  const list = Array.isArray(hooks)
    ? hooks.filter((h) => typeof h === 'string' && h.trim()).slice(0, 12).map((h) => `- ${h.trim().slice(0, 200)}`)
    : [];
  if (list.length === 0) return '';
  return `\n[เหตุการณ์ที่อาจเกิดขึ้นในเรื่อง (หยิบมาใช้ทีละเรื่องตามจังหวะ ดัดแปลงให้เข้ากับฉากได้ ไม่ต้องใช้ครบ)]:\n${list.join('\n')}\n`;
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

  const lastReply = [...messages].reverse().find((m) => m.role !== 'user')?.text || '';
  const spoken = spokenLines(lastReply);
  // The second example only fits story mode: in short-chat there is no *action* to mistake for the user's
  const actedExample = dm
    ? ''
    : `\nถ้า ${characterName} สะดุ้งแล้วรีบกุมกระเป๋าเสื้อซ่อนโทรศัพท์ แบบที่ถูก: *มองมือที่กุมกระเป๋าเสื้อ* "ใครส่งมาเหรอ"
แบบที่ผิด: *รีบปิดหน้าจอ* "ไม่มีอะไรหรอก" (เพราะเป็นสิ่งที่ ${characterName} ทำและพูดเอง ${userLabel} ไม่ได้ถือโทรศัพท์เครื่องนั้น)`;

  return `คุณกำลังช่วย "${userLabel}" คิดว่าจะตอบอะไรต่อในโรลเพลย์กับตัวละคร "${characterName}"
${charDesc ? `- ${characterName}: ${charDesc}\n` : ''}- ${userLabel} คือฝั่งผู้เล่น${callMe && callMe !== userLabel ? ` (${characterName} เรียกเขาว่า "${callMe}")` : ''}${userDesc ? `: ${userDesc}` : ''}

บทสนทนาล่าสุด:

${transcript}

ข้อความล่าสุดเป็นของ ${characterName} ไม่ใช่ของ ${userLabel}:
- ทุกการกระทำ ท่าทาง สีหน้า ความรู้สึก และคำพูดในข้อความนั้นเป็นของ ${characterName} เท่านั้น ${userLabel} ไม่ได้ทำสิ่งนั้น และไม่รู้ความคิดในใจของ ${characterName}
${spoken.length > 0 ? `- คำพูดล่าสุดของ ${characterName} ที่ห้ามทวนหรือพูดซ้ำ แม้เปลี่ยนคำ: ${spoken.join(' ')}\n` : ''}
ขั้นแรก เขียนหนึ่งบรรทัดขึ้นต้นว่า "มุมของ ${userLabel}:" ตามด้วยสิ่งที่ ${userLabel} เห็นและได้ยินจากภายนอกตอนนี้ และรู้สึกอย่างไร (ไม่เกิน 25 คำ)
ขั้นที่สอง คิดข้อความถัดไปที่ ${userLabel} จะส่งตอบ ${characterName} มา 5 แบบที่ต่างกันจริงๆ เช่น ถามกลับหรือสงสัย / แซวหรือต่อรอง / ห่วงใยหรืออ่อนโยน / ทำท่าทางต่อสิ่งที่เห็น / พาเรื่องไปทางใหม่:
- เขียนในมุมของ ${userLabel}: คนที่ทำทุกอย่างใน *...* และพูดทุกคำใน "..." คือ ${userLabel} เท่านั้น ห้ามเป็นการกระทำหรือคำพูดของ ${characterName}
- ใช้คำแทนตัว คำเรียกอีกฝ่าย และคำลงท้ายแบบที่ ${userLabel} ใช้ในข้อความก่อนๆ ห้ามยืมคำลงท้ายหรือคำเรียกที่ ${characterName} ใช้
- เป็นปฏิกิริยาของ ${userLabel} ต่อสิ่งที่ ${characterName} เพิ่งพูดหรือทำในข้อความล่าสุด ห้ามลอกท่าทางหรือคำพูดของ ${characterName} แม้เปลี่ยนคำนิดหน่อย
  (ถ้า ${characterName} เพิ่งบอกให้ตั้งใจเรียนก่อน อย่าให้ตอบว่า "ตั้งใจเรียนก่อนเดี๋ยวค่อยคุยกัน" ให้ถามกลับ ต่อรอง หรือแซวแทน)
- ถ้า ${userLabel} ไม่เคยใช้คำแทนตัว (ผม ฉัน เรา หนู ฯลฯ) หรือคำลงท้ายในข้อความก่อนๆ ให้เลี่ยงคำแทนตัว ห้ามเดาเอง และห้ามใส่ชื่อของ ${userLabel} เองในข้อความ
- ${
    dm
      ? 'เป็นข้อความแชทสั้นๆ ล้วนๆ ห้ามใส่ *...* หรือเครื่องหมายคำพูด'
      : 'ใช้รูปแบบ *การกระทำ* "คำพูด"'
  } ไม่เกิน 15 คำ
ตัวอย่าง: ${example}${actedExample}
ตอบเป็น 6 บรรทัด: บรรทัด "มุมของ ${userLabel}:" แล้วตามด้วยตัวเลือก 5 บรรทัด บรรทัดละ 1 แบบ ไม่ต้องมีเลขลำดับ หัวข้อ หรือคำอธิบายอื่น`;
}

// What a character just said aloud (the "quoted" parts, or the plain lines of a short-chat message), newest last,
// for the suggest prompt's "do not repeat" list
function spokenLines(text) {
  const quoted = [...String(text).matchAll(/"([^"\n]+)"|“([^”\n]+)”/g)].map((m) => (m[1] || m[2]).trim());
  const lines =
    quoted.length > 0
      ? quoted
      : String(text)
          .split('\n')
          .map((l) => l.replace(/\*[^*\n]*\*/g, '').trim())
          .filter(Boolean);
  return lines.slice(-3).map((l) => `"${l.slice(0, 100)}"`);
}

/**
 * Prompt for /api/memory: fold `messages` (older chat that is about to leave the model's window) into
 * `previousSummary`, producing the character's long-term memory of the story so far.
 */
export function buildSummaryPrompt({ characterName, userName, previousSummary, messages, characterAge: age = null }) {
  const userLabel = userName?.trim() || 'คู่สนทนา';
  // Same reason as ageText: without it Google's child-safety filter cuts summaries of sweet scenes between adults
  const adultLine = age !== null && age < 18
    ? ''
    : `\n[อายุ]: ${characterName} และ ${userLabel} เป็นผู้ใหญ่อายุ 20 ปีขึ้นไปทั้งคู่ เรื่องทั้งหมดเกิดขึ้นในปัจจุบันระหว่างผู้ใหญ่ เป็นนิยายโรลเพลย์\n`;
  const transcript = messages
    .map((m) => `${m.role === 'user' ? userLabel : characterName}: ${m.text}`)
    .join('\n\n');

  return `คุณเป็นผู้จดบันทึกเรื่องราวของโรลเพลย์ระหว่างตัวละคร "${characterName}" กับ "${userLabel}"
งานของคุณคือเขียน "ความจำ" ของเรื่องที่ผ่านมา เพื่อให้ตัวละครจำได้ในภายหลัง
${adultLine}
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
 * Parsed by lib/scene.js; the page then offers to save it to the memory journal. `offered`: titles the app already
 * offered in this chat and the user did not save, so the model doesn't bring them back (saved ones are in the journal).
 * The moment must happen in this very reply: models used to pull titles from the profile, memory or plans.
 */
function momentRule(offered) {
  const titles = Array.isArray(offered)
    ? offered.filter((t) => typeof t === 'string' && t.trim()).slice(-20).map((t) => `"${t.trim().slice(0, 120)}"`)
    : [];
  return `
13. ถ้าในคำตอบที่คุณเพิ่งเขียนนี้ เกิด "ช่วงเวลาสำคัญ" ของเรื่องหรือความสัมพันธ์ขึ้นจริงตรงหน้า เช่น เจอกันครั้งแรก สารภาพความรู้สึก
   เดตครั้งแรก ให้คำสัญญา ทะเลาะหรือคืนดีกันครั้งใหญ่ ให้ของขวัญที่มีความหมาย เปิดเผยความลับ หรือความสัมพันธ์เปลี่ยนไป
   ให้เพิ่ม "; ความทรงจำ=<ชื่อช่วงเวลาสั้นๆ ไม่เกิน 12 คำ>" ต่อท้ายในแท็กฉากก่อนเครื่องหมาย ]
   ตัวอย่าง: [ฉาก: สถานที่=ร้านกาแฟใต้ตึก; เวลา=บ่ายโมง; พื้นหลัง=cafe; ความทรงจำ=เจอกันครั้งแรกที่ร้านกาแฟ]
   - ชื่อต้องบอกสิ่งที่เกิดขึ้นในคำตอบนี้ ในสถานที่และเวลาของแท็กนี้ ห้ามใช้เรื่องที่เกิดไปแล้วในข้อความก่อนๆ เรื่องจากประวัติหรือความจำ
     และห้ามใช้แผนหรือสิ่งที่แค่พูดถึงว่าจะทำ (ถ้าแค่ชวนกันไปเดต ยังไม่ใช่ช่วงเวลาสำคัญ จนกว่าจะได้ไปจริง)
   - คำตอบส่วนใหญ่เป็นบทสนทนาธรรมดา ไม่ต้องใส่ ใส่เฉพาะตอนที่สำคัญจริงๆ และห้ามซ้ำกับเรื่องที่อยู่ในสมุดความทรงจำแล้ว${
     titles.length > 0
       ? `\n   - เรื่องเหล่านี้เคยถูกเสนอไปแล้วและคู่สนทนาไม่ได้เก็บไว้ ห้ามเสนอซ้ำ ทั้งชื่อเดิมและเรื่องเดียวกันในชื่ออื่น: ${titles.join(', ')}`
       : ''
   }`;
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
