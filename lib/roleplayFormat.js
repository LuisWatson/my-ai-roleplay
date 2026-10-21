// Novel-style roleplay text: "spoken words" in double quotes, *action or inner thought* in asterisks
// (older chats wrote *(action)*), anything else is narration. Actions read as narration, like a novel.
const ACTION_REGEX = /\*[^*\n]+\*/g;
const SPEECH_REGEX = /"[^"\n]+"|“[^”\n]+”/g;
const QUOTE_CHARS = /["“”]/g;

/**
 * Split text into paragraphs: each spoken line and each run of narration becomes its own paragraph.
 * @param {string} text
 * @returns {{type: 'speech'|'narration', text: string}[]}
 */
export function parseRoleplayText(text) {
  if (!text) return [];
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap(parseLine);
}

function parseLine(line) {
  const paragraphs = [];
  const push = (type, raw) => {
    const value = raw.replace(/\s+/g, ' ').trim();
    if (!value.replace(QUOTE_CHARS, '').trim()) return;
    const prev = paragraphs[paragraphs.length - 1];
    if (type === 'narration' && prev?.type === 'narration') prev.text += ` ${value}`;
    else paragraphs.push({ type, text: value });
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

// Text with only one quote mark is half of a quote that an action split, or speech still streaming in
function pushLeftover(push, raw) {
  const text = raw.replace(/^\s*[•-]\s+/, '').replace(/\*/g, '').trim();
  if (/^["“]|["”]$/.test(text)) push('speech', `"${text.replace(QUOTE_CHARS, '').trim()}"`);
  else push('narration', text);
}
