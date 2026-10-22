// The model is instructed (see lib/prompt.js) to end every reply with this exact tag,
// which we parse out and display as the current location/time instead of showing it as text.
const TAG_MARKER = '[ฉาก:';

// /api/chat ends the stream with this plus a reason (e.g. SAFETY) when Google stopped the reply partway.
// A control character, so model text never contains it.
export const CUT_MARKER = '\u0001CUT:';

/** Splits the cut marker off a streamed reply: { text, cut } where cut is the reason or null. */
export function splitCut(raw) {
  const at = raw.indexOf(CUT_MARKER);
  if (at === -1) return { text: raw, cut: null };
  return { text: raw.slice(0, at), cut: raw.slice(at + CUT_MARKER.length).trim() || 'OTHER' };
}
// The choices part runs to the end of the tag unless another labeled part follows it; its text may contain
// "]" or ";" (the model is told not to, but does), so it is cut out before the rest is split on ";".
const CHOICES_START = /(?:^|;)\s*ตัวเลือก\s*[:=]\s*/;
const NEXT_LABEL = /;\s*(?=(?:สถานที่|เวลา|พื้นหลัง|ความทรงจำ|ความสัมพันธ์)\s*[:=])/;

// Parts are "label=value". Lenient on purpose: the model sometimes drops a label or uses ":" instead
// of "=", so unlabeled parts fill location, time, background in that order. Everything after "เวลา="
// is optional (older replies, fixed-background characters, features turned off, most replies have no moment).
const LABELS = [
  ['location', /^สถานที่\s*[:=]\s*/],
  ['time', /^เวลา\s*[:=]\s*/],
  ['background', /^พื้นหลัง\s*[:=]\s*/],
  ['moment', /^ความทรงจำ\s*[:=]\s*/],
  ['relation', /^ความสัมพันธ์\s*[:=]\s*/],
  ['choices', /^ตัวเลือก\s*[:=]\s*/],
];
const POSITIONAL = ['location', 'time', 'background'];
// Values the model writes when it means "no moment"
const NO_MOMENT = /^(-|ไม่มี|none|null|ว่าง)?$/i;

function parseTagParts(tagInner) {
  const fields = {};
  let inner = tagInner;
  const start = inner.match(CHOICES_START);
  if (start) {
    const after = inner.slice(start.index + start[0].length);
    const end = after.search(NEXT_LABEL);
    fields.choices = (end === -1 ? after : after.slice(0, end)).trim();
    inner = inner.slice(0, start.index) + (end === -1 ? '' : after.slice(end));
  }
  let next = 0;
  for (const raw of inner.split(';')) {
    const part = raw.trim();
    if (!part) continue;
    const labeled = LABELS.find(([, re]) => re.test(part));
    if (labeled) {
      fields[labeled[0]] = part.replace(labeled[1], '').trim();
    } else {
      while (next < POSITIONAL.length && fields[POSITIONAL[next]] !== undefined) next++;
      if (next < POSITIONAL.length) fields[POSITIONAL[next++]] = part;
    }
  }
  return fields;
}

// "ผูกพัน +2, ไว้ใจ 0, อารมณ์ เขินๆ" → { bond: { n: 2, signed: true }, trust: { n: 0, signed: false },
// mood: 'เขินๆ' }; lib/relation.js decides whether a number is a change or a starting value.
// Missing parts are left out.
export function parseRelation(value) {
  if (!value) return undefined;
  const number = (re) => {
    const m = value.match(re);
    if (!m) return undefined;
    const sign = m[1] === '-' || m[1] === '−' || m[1] === '–' ? -1 : 1;
    return { n: sign * Number(m[2]), signed: Boolean(m[1]) };
  };
  const bond = number(/ผูกพัน\s*[:=]?\s*([+\-−–])?\s*(\d{1,3})/);
  const trust = number(/ไว้ใจ\s*[:=]?\s*([+\-−–])?\s*(\d{1,3})/);
  const mood = value.match(/อารมณ์\s*[:=]?\s*([^,]+)/)?.[1].trim().slice(0, 30);
  const relation = {
    ...(bond !== undefined && { bond }),
    ...(trust !== undefined && { trust }),
    ...(mood && { mood }),
  };
  return Object.keys(relation).length > 0 ? relation : undefined;
}

// "a | b | c" → up to 3 short suggested replies for the user (";" as separator when there is no "|")
function parseChoices(value) {
  if (!value) return undefined;
  const choices = value
    .split(value.includes('|') ? '|' : ';')
    .map((c) => c.replace(/^[\s;]+|[\s;]+$/g, '').slice(0, 150))
    .filter((c) => c && !NO_MOMENT.test(c))
    .slice(0, 3);
  return choices.length > 0 ? choices : undefined;
}

/**
 * Splits a finished reply into its visible text and what its tag reports: `scene` (undefined when there is
 * no usable tag), `moment` (a short title, only when the model marked a moment worth keeping), `relation`
 * ({ bond, trust, mood } as reported, not yet clamped) and `choices` (suggested replies for the user).
 */
export function parseSceneTag(fullText) {
  // The tag is the last "[ฉาก:" and must close with "]" at the very end (a reply cut off mid-tag has no "]")
  const at = fullText.lastIndexOf(TAG_MARKER);
  if (at === -1) return { cleanText: fullText };
  const tail = fullText.slice(at + TAG_MARKER.length).replace(/\s+$/, '');
  if (!tail.endsWith(']')) return { cleanText: fullText };
  const fields = parseTagParts(tail.slice(0, -1));
  const cleanText = fullText.slice(0, at).replace(/\s+$/, '');
  if (!fields.location || !fields.time) return { cleanText };
  const moment = fields.moment && !NO_MOMENT.test(fields.moment) ? fields.moment.slice(0, 120) : undefined;
  return {
    cleanText,
    scene: {
      location: fields.location,
      time: fields.time,
      ...(fields.background ? { background: fields.background.toLowerCase() } : {}),
    },
    moment,
    relation: parseRelation(fields.relation),
    // What the model wrote, kept on the reply so an odd change can be traced later
    relationRaw: fields.relation ? fields.relation.slice(0, 80) : undefined,
    choices: parseChoices(fields.choices),
  };
}

/**
 * Hides the scene tag from a reply while it is still streaming in, including a tag that has
 * only partially arrived (e.g. the chunk boundary lands mid-tag).
 */
export function stripTrailingPartialTag(text) {
  // A started tag hides everything after it, even a "[" or "]" inside the choices
  const marker = text.lastIndexOf(TAG_MARKER);
  if (marker !== -1) return text.slice(0, marker).replace(/\s+$/, '');
  const idx = text.lastIndexOf('[');
  if (idx === -1) return text;
  const tail = text.slice(idx);
  if (TAG_MARKER.startsWith(tail) || tail.startsWith(TAG_MARKER)) {
    return text.slice(0, idx).replace(/\s+$/, '');
  }
  return text;
}

/**
 * Settles a reply once streaming stops, whether it finished normally or was cut off mid-tag:
 * strips the scene tag (complete or partial) from the text and returns the parsed scene and moment, if any.
 */
export function finalizeReply(raw) {
  const parsed = parseSceneTag(raw);
  if (parsed.scene) return parsed;
  return { cleanText: stripTrailingPartialTag(parsed.cleanText) };
}

/** The most recent scene reported by any message, newest first. */
export function latestScene(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].scene) return messages[i].scene;
  }
  return null;
}
