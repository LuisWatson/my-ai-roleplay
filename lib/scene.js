// The model is instructed (see lib/prompt.js) to end every reply with this exact tag,
// which we parse out and display as the current location/time instead of showing it as text.
const TAG_MARKER = '[ฉาก:';
// The whole tag at the very end of a reply: [ฉาก: part; part; ...]
const TAG_REGEX = /\[ฉาก:([^\]]*)\]\s*$/;

// Parts are "label=value". Lenient on purpose: the model sometimes drops a label or uses ":" instead
// of "=", so unlabeled parts fill location, time, background in that order. "พื้นหลัง=" and
// "ความทรงจำ=" are optional (older replies, fixed-background characters, and most replies have no moment).
const LABELS = [
  ['location', /^สถานที่\s*[:=]\s*/],
  ['time', /^เวลา\s*[:=]\s*/],
  ['background', /^พื้นหลัง\s*[:=]\s*/],
  ['moment', /^ความทรงจำ\s*[:=]\s*/],
];
const POSITIONAL = ['location', 'time', 'background'];
// Values the model writes when it means "no moment"
const NO_MOMENT = /^(-|ไม่มี|none|null|ว่าง)?$/i;

function parseTagParts(inner) {
  const fields = {};
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

/**
 * Splits a finished reply into its visible text, the scene it reports, and the key moment it flags.
 * Returns `{ cleanText, scene, moment }`; `scene` is undefined when there is no usable tag, `moment`
 * (a short title) only when the model marked this reply as a moment worth keeping.
 */
export function parseSceneTag(fullText) {
  const match = fullText.match(TAG_REGEX);
  if (!match) return { cleanText: fullText, scene: undefined, moment: undefined };
  const fields = parseTagParts(match[1]);
  const cleanText = fullText.slice(0, match.index).replace(/\s+$/, '');
  if (!fields.location || !fields.time) return { cleanText, scene: undefined, moment: undefined };
  const moment = fields.moment && !NO_MOMENT.test(fields.moment) ? fields.moment.slice(0, 120) : undefined;
  return {
    cleanText,
    scene: {
      location: fields.location,
      time: fields.time,
      ...(fields.background ? { background: fields.background.toLowerCase() } : {}),
    },
    moment,
  };
}

/**
 * Hides the scene tag from a reply while it is still streaming in, including a tag that has
 * only partially arrived (e.g. the chunk boundary lands mid-tag).
 */
export function stripTrailingPartialTag(text) {
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
  return { cleanText: stripTrailingPartialTag(parsed.cleanText), scene: undefined, moment: undefined };
}

/** The most recent scene reported by any message, newest first. */
export function latestScene(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].scene) return messages[i].scene;
  }
  return null;
}
