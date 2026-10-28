// Novel-style roleplay text: "spoken words" in double quotes, *action or inner thought* in asterisks
// (older chats wrote *(action)*), anything else is narration. Actions read as narration, like a novel.
// A line starting with a name and a colon before the speech (แม่ของเอวา: "...") is someone else talking;
// its speech carries that `speaker`.
const ACTION_REGEX = /\*[^*\n]+\*/g;
const SPEECH_REGEX = /"[^"\n]+"|“[^”\n]+”/g;
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
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap(parseLine);
}

function parseLine(fullLine) {
  const label = fullLine.match(SPEAKER_REGEX);
  const speaker = label ? label[1].trim() : undefined;
  const line = label ? fullLine.slice(label[0].length) : fullLine;

  const paragraphs = [];
  const push = (type, raw) => {
    const value = raw.replace(/\s+/g, ' ').trim();
    if (!value.replace(QUOTE_CHARS, '').trim()) return;
    const prev = paragraphs[paragraphs.length - 1];
    if (type === 'narration' && prev?.type === 'narration') prev.text += ` ${value}`;
    else paragraphs.push({ type, text: value, ...(type === 'speech' && speaker && { speaker }) });
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
    push('speech', match[0]);
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
  const text = raw.replace(/^\s*[•-]\s+/, '').replace(/\*/g, '').trim();
  if (/^["“]|["”]$/.test(text)) push('speech', `"${text.replace(QUOTE_CHARS, '').trim()}"`);
  else push('narration', text);
}
