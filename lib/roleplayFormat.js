// Novel-style roleplay text: "spoken words" in double quotes, *action or inner thought* in asterisks
// (older chats wrote *(action)*), anything else is narration. Actions read as narration, like a novel.
// A line starting with a name and a colon before the speech (แม่ของเอวา: "...") is someone else talking;
// its speech carries that `speaker`.
import { moodOfEmoji, emojiOfThought } from './expressions';

const ACTION_REGEX = /\*[^*\n]+\*/g;
// A spoken line may start with the face she makes while saying it: {😳} "..." (rule 16 in lib/prompt.js)
const MOOD_MARK = '\\{([^{}\\n]{1,8})\\}\\s*';
const SPEECH_REGEX = new RegExp(`(?:${MOOD_MARK})?("[^"\\n]+"|“[^”\\n]+”)`, 'g');
const MOOD_MARK_REGEX = /\{[^{}\n]{1,8}\}\s*|\{[^{}\n]{0,8}$/g;
const SPEECH_START = new RegExp(`^(?:${MOOD_MARK})?["“]`);
const QUOTE_CHARS = /["“”]/g;
// "name:" (or a full-width colon) at the start of a line, with a quote somewhere after it
const SPEAKER_REGEX = /^([^"“”*:：\n]{1,30}?)\s*[:：]\s*(?=.*["“])/;

/**
 * Split text into paragraphs: each spoken line and each run of narration becomes its own paragraph.
 * @param {string} text
 * @returns {{type: 'speech'|'narration', text: string, speaker?: string}[]}
 */
export function parseRoleplayText(text) {
  if (!text) return [];
  const paragraphs = [];
  let pending; // a name written alone on its line ("พิม:"), for the speech on the next line
  for (const raw of text.split('\n')) {
    // The model sometimes bolds the name: "**พิม:** "..."" → "พิม: "...""
    const line = raw.trim().replace(/^\*\*([^*"“”\n]{1,30}?)\s*([:：])\s*\*\*/, '$1$2').replace(/^\*\*([^*"“”\n]{1,30}?)\*\*\s*([:：])/, '$1$2');
    if (!line) continue;
    const speech = SPEECH_START.test(line);
    if (pending && !speech) paragraphs.push(...parseLine(pending.line)); // not a name after all: keep the line
    if (pending && speech) {
      paragraphs.push(...parseLine(`${pending.name}: ${line}`));
      pending = undefined;
      continue;
    }
    // "เธอพูดว่า:" is narration leading into her own speech, not a name
    const alone = /ว่า\s*[:：]\s*$/.test(line) ? null : line.match(NAME_ALONE_REGEX);
    pending = alone ? { name: alone[1].trim(), line } : undefined;
    if (!alone) paragraphs.push(...parseLine(line));
  }
  if (pending) paragraphs.push(...parseLine(pending.line));
  return paragraphs;
}

// "เอวา (Ava)" → also matches a label written as "เอวา" or "Ava"
export function isMainCharacter(speaker, characterName) {
  if (!characterName) return false;
  const names = [characterName, ...characterName.split(/[()]/)].map((n) => n.trim()).filter(Boolean);
  return names.includes(speaker.trim());
}

/**
 * The expression key on each paragraph (null for narration and other people's speech): the face marked on the
 * line, else the one before it, else the one the reply's thought shows.
 * @param {ReturnType<typeof parseRoleplayText>} paragraphs
 * @param {string} characterName
 * @param {string} [thought]
 */
export function speechMoods(paragraphs, characterName, thought) {
  let current = moodOfEmoji(emojiOfThought(thought));
  return paragraphs.map((p) => {
    if (p.type !== 'speech' || (p.speaker && !isMainCharacter(p.speaker, characterName))) return null;
    current = p.mood || current;
    return current;
  });
}

// "พิม:" alone on a line (its speech follows on the next line)
const NAME_ALONE_REGEX = /^([^"“”*:：\n]{1,30}?)\s*[:：]\s*$/;

function parseLine(fullLine) {
  const label = fullLine.match(SPEAKER_REGEX);
  const speaker = label ? label[1].trim() : undefined;
  const line = label ? fullLine.slice(label[0].length) : fullLine;

  const paragraphs = [];
  const push = (type, raw, emoji) => {
    const value = raw.replace(/\s+/g, ' ').trim();
    if (!value.replace(QUOTE_CHARS, '').trim()) return;
    const prev = paragraphs[paragraphs.length - 1];
    const mood = type === 'speech' && emoji ? moodOfEmoji(emoji) : null;
    if (type === 'narration' && prev?.type === 'narration') prev.text += ` ${value}`;
    else paragraphs.push({ type, text: value, ...(type === 'speech' && speaker && { speaker }), ...(mood && { mood }) });
  };

  // Actions first, so an action written inside a quote ("... *(laughs)*") is still split out
  let last = 0;
  for (const match of line.matchAll(ACTION_REGEX)) {
    pushSpeechAndNarration(push, line.slice(last, match.index));
    push('narration', match[0].replace(/^\*\s*\(?|\)?\s*\*$/g, ''));
    last = match.index + match[0].length;
  }
  pushSpeechAndNarration(push, line.slice(last));
  return paragraphs;
}

function pushSpeechAndNarration(push, piece) {
  let last = 0;
  for (const match of piece.matchAll(SPEECH_REGEX)) {
    pushLeftover(push, piece.slice(last, match.index));
    push('speech', match[2], match[1]);
    last = match.index + match[0].length;
  }
  pushLeftover(push, piece.slice(last));
}

// Honorifics the model may put before a name ("คุณอรอนงค์", "Dr. Thorne"); cast names may carry them too
const TITLE_REGEX = /^(คุณ|นางสาว|นาง|นาย|หมอ|ดร\.?|Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Miss)\s*/i;

// Every way a cast name may be written: "พิมพ์ชนก (พิม)" → พิมพ์ชนก, พิม; "Dr. Elias Thorne" → elias, thorne, ...
function nameKeys(name) {
  const keys = new Set();
  for (const part of [name, ...name.split(/[()]/)]) {
    const clean = part.trim().replace(TITLE_REGEX, '').toLowerCase();
    if (!clean) continue;
    keys.add(clean);
    for (const word of clean.split(/\s+/)) if (word.length >= 2) keys.add(word);
  }
  return keys;
}

/**
 * Who a "name:" speaker is to the character, from the character's `cast`: the first phrase of their
 * `relation` plus a following Latin name ("ผู้ช่วยส่วนตัวของ Lucien อายุ 30" → "ผู้ช่วยส่วนตัวของ Lucien"),
 * or null for someone not in the cast.
 * @param {string} speaker
 * @param {{name: string, relation?: string}[]} [cast]
 * @returns {string|null}
 */
export function castRoleFor(speaker, cast) {
  if (!speaker || !Array.isArray(cast)) return null;
  const said = speaker.trim().replace(TITLE_REGEX, '').toLowerCase();
  if (!said) return null;
  const named = cast.filter((p) => typeof p?.name === 'string' && p.name.trim());
  const person =
    named.find((p) => nameKeys(p.name).has(said)) ||
    (said.length >= 2 && named.find((p) => p.name.toLowerCase().includes(said)));
  const words = person?.relation?.trim().split(/\s+/) || [];
  if (!words[0]) return null;
  return /^[A-Za-z]/.test(words[1] || '') ? `${words[0]} ${words[1]}` : words[0];
}

// Text with only one quote mark is half of a quote that an action split, or speech still streaming in
function pushLeftover(push, raw) {
  const text = raw.replace(MOOD_MARK_REGEX, '').replace(/^\s*[•-]\s+/, '').replace(/\*/g, '').trim();
  if (/^["“]|["”]$/.test(text)) push('speech', `"${text.replace(QUOTE_CHARS, '').trim()}"`);
  else push('narration', text);
}
