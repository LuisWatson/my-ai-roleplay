// Finds the phrases the character keeps reusing across its latest replies, so the prompt can ban them by name.
// Models copy the wording of their own recent replies (the raw history is full of it), and a generic "don't repeat
// phrases" rule is not enough for Lite models. Thai has no spaces between words, so this compares character runs.

const GRAM = 12; // shortest run that counts as "the same wording"
const MIN_PHRASE = 14; // shorter ones are everyday words and place names, not a habit worth banning
const WINDOW = 12; // how many of the latest replies are compared
const NEWEST = 4; // runs are taken from the newest replies (what the model is copying right now)
const MIN_REPLIES = 3; // a run must appear in at least this many of the WINDOW replies
const MAX_PHRASES = 10;
const MAX_PHRASE_LEN = 40;

// Emoji tags, *, quotes and line breaks end a phrase; the names would otherwise be banned along with it
function pieces(text, names) {
  let t = String(text || '').replace(/\{[^}]*\}/g, '|').replace(/[*"“”'‘’\n\r]+/g, '|');
  for (const name of names) if (name) t = t.split(name).join('|');
  return t.split('|').map((p) => p.replace(/\s+/g, '')).filter((p) => p.length >= GRAM);
}

// p.slice(start, end) cut back to whole words, so a phrase never starts or ends in the middle of one
const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'word' }) : null;
function wholeWords(p, start, end) {
  if (!segmenter) return p.slice(start, end);
  let from = -1;
  let to = -1;
  for (const { index, segment } of segmenter.segment(p)) {
    if (from < 0 && index >= start) from = index;
    if (index + segment.length <= end) to = index + segment.length;
  }
  return from >= 0 && to > from ? p.slice(from, to) : '';
}

/**
 * `messages`: [{ role, text }] oldest first. Returns up to 10 phrases (10–40 characters) used in three or more of the
 * last 12 character replies, most repeated first. `names`: character/player names to keep out of the phrases.
 */
export function overusedPhrases(messages, { names = [] } = {}) {
  // "เซเรน่า (Serena)" appears in the story as "เซเรน่า" or "Serena": keep each part out of the phrases
  names = names.flatMap((n) => String(n || '').split(/[()\s]+/)).filter((n) => n.length >= 2);
  const replies = (messages || []).filter((m) => m && m.role !== 'user' && m.text).slice(-WINDOW);
  if (replies.length < MIN_REPLIES) return [];
  const parts = replies.map((m) => pieces(m.text, names));

  const seen = new Map(); // gram → number of replies containing it
  for (const ps of parts) {
    const own = new Set();
    for (const p of ps) for (let i = 0; i + GRAM <= p.length; i += 1) own.add(p.slice(i, i + GRAM));
    for (const g of own) seen.set(g, (seen.get(g) || 0) + 1);
  }

  const found = new Map(); // phrase → replies
  for (const ps of parts.slice(-NEWEST)) {
    for (const p of ps) {
      let start = -1;
      let top = 0;
      const flush = (end) => {
        if (start < 0) return;
        const phrase = wholeWords(p, start, Math.min(end, start + MAX_PHRASE_LEN));
        if (phrase.length >= MIN_PHRASE) found.set(phrase, Math.max(found.get(phrase) || 0, top));
        start = -1;
        top = 0;
      };
      for (let i = 0; i + GRAM <= p.length; i += 1) {
        const n = seen.get(p.slice(i, i + GRAM)) || 0;
        if (n >= MIN_REPLIES) {
          if (start < 0) start = i;
          top = Math.max(top, n);
        } else flush(i - 1 + GRAM);
      }
      flush(p.length);
    }
  }

  const list = [...found.entries()].sort((a, b) => b[1] * b[0].length - a[1] * a[0].length);
  const out = [];
  for (const [phrase] of list) {
    if (out.some((o) => o.includes(phrase) || phrase.includes(o))) continue;
    out.push(phrase);
    if (out.length >= MAX_PHRASES) break;
  }
  return out;
}
