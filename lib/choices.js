// Safety net for suggested replies (the 3 buttons under a reply), whichever way they were made.
// They must read as something the USER says; models sometimes slip into the character's voice, copy the
// reply, add a lead-in line, or leave a stray letter from another script in a Thai word (Lite does this).
// Conservative on purpose: a good choice must never be dropped, so a bad one only goes on a clear sign.

const FOREIGN_SCRIPT = /[Ѐ-ӿ֐-ۿऀ-ॿ぀-ヿ㐀-鿿가-힯]/;
const LEAD_IN = /^(นี่คือ|ต่อไปนี้|ตัวเลือก|แบบที่|มุมของ|ข้อความ(?:ที่|ถัดไป))|[:：]\s*$/;
const GRAM = 4;
const SIMILAR_LIMIT = 0.6; // share of the choice's 4-grams that also appear in the character's reply
// Only the spoken parts compared: a choice that says again what the character just said, reworded a little
// ("ตั้งใจเรียนก่อนเถอะ" → "ตั้งใจเรียนก่อนเดี๋ยวค่อยคุยกัน"), scored 0.54; the closest good choice (answering by quoting the
// character back) 0.43. Dropping a good one costs a button, keeping an echo is the bug, so the limit sits between.
const ECHO_LIMIT = 0.5;
const MIN_COMPARE_LENGTH = 10; // shorter choices ("ขอบคุณครับ") say too little to compare

// The words of a choice without the *action* / "speech" markers and spaces
function bare(text) {
  return String(text).replace(/[*"“”'‘’\s]/g, '');
}

// What is said aloud: the "quoted" parts, or the whole text without *actions* when nothing is quoted (short-chat mode)
function speechOf(text) {
  const quoted = [...String(text).matchAll(/"([^"\n]+)"|“([^”\n]+)”/g)].map((m) => m[1] || m[2]);
  return quoted.length > 0 ? quoted.join(' ') : String(text).replace(/\*[^*\n]*\*/g, ' ');
}

function grams(text) {
  const set = new Set();
  for (let i = 0; i + GRAM <= text.length; i++) set.add(text.slice(i, i + GRAM));
  return set;
}

/** Share (0–1) of `choice`'s 4-character runs that also occur in `reply`. */
export function overlapWith(choice, reply) {
  const mine = grams(bare(choice));
  if (mine.size === 0) return 0;
  const theirs = grams(bare(reply));
  let shared = 0;
  for (const g of mine) if (theirs.has(g)) shared++;
  return shared / mine.size;
}

/**
 * Why a choice should not be shown, or null when it is fine.
 * `names`: what the character calls the user (name, nickname); the user never says their own name
 * `reply`: the character's reply the choices answer
 */
export function choiceProblem(choice, { names = [], reply = '' } = {}) {
  const text = String(choice || '').trim();
  if (!text) return 'empty';
  if (LEAD_IN.test(text)) return 'lead-in';
  if (FOREIGN_SCRIPT.test(text)) return 'foreign-script';
  for (const name of names) {
    if (name && name.length >= 2 && text.includes(name)) return 'own-name';
  }
  const said = speechOf(text);
  if (bare(said).length >= MIN_COMPARE_LENGTH && overlapWith(said, speechOf(reply)) >= ECHO_LIMIT) return 'echoes-reply';
  if (bare(text).length >= MIN_COMPARE_LENGTH && overlapWith(text, reply) >= SIMILAR_LIMIT) return 'copies-reply';
  return null;
}

/**
 * The model's raw answer to the suggest prompt (a "มุมของ ..." line, then 5 candidates) → the first `max` lines
 * that pass. Asking for more than are shown means dropping a bad one costs no button.
 */
export function pickChoices(raw, context, max = 3) {
  if (max <= 0) return [];
  const choices = [];
  for (const line of String(raw)
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-•]|\d+[.)])\s*/, '').trim())
  ) {
    if (!line || choiceProblem(line, context) !== null) continue;
    if (choices.some((existing) => isDuplicateChoice(line, existing))) continue;
    choices.push(line);
    if (choices.length >= max) break;
  }
  return choices;
}

/** The choices that pass, in order (undefined when none do). */
export function cleanChoices(choices, context) {
  if (!Array.isArray(choices)) return undefined;
  const kept = [];
  for (const choice of choices) {
    if (choiceProblem(choice, context) !== null) continue;
    if (kept.some((existing) => isDuplicateChoice(choice, existing))) continue;
    kept.push(choice);
  }
  return kept.length > 0 ? kept : undefined;
}

function isDuplicateChoice(a, b) {
  const normalize = (text) => bare(text).replace(/[.,!?！？…。，、:：;；]/g, '');
  return normalize(a) === normalize(b);
}
