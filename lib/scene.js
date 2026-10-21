// The model is instructed (see lib/prompt.js) to end every reply with this exact tag,
// which we parse out and display as the current location/time instead of showing it as text.
const TAG_MARKER = '[ฉาก:';
// Lenient on purpose: the model sometimes drops the "สถานที่=" label or uses ":" instead of "=".
// The third "พื้นหลัง=" part is optional so older replies (and fixed-background characters) still parse.
const TAG_REGEX =
  /\[ฉาก:\s*(?:สถานที่\s*[:=]\s*)?([^;]+?)\s*;\s*(?:เวลา\s*[:=]\s*)?([^;\]]+?)\s*(?:;\s*(?:พื้นหลัง\s*[:=]\s*)?([^\]]*?)\s*)?\]\s*$/;

/**
 * Splits a finished reply into its visible text and the scene it reports, if any.
 * Returns `{ cleanText, scene }`; `scene` is undefined when the model didn't include a tag.
 */
export function parseSceneTag(fullText) {
  const match = fullText.match(TAG_REGEX);
  if (!match) return { cleanText: fullText, scene: undefined };
  return {
    cleanText: fullText.slice(0, match.index).replace(/\s+$/, ''),
    scene: {
      location: match[1].trim(),
      time: match[2].trim(),
      ...(match[3]?.trim() ? { background: match[3].trim().toLowerCase() } : {}),
    },
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
 * strips the scene tag (complete or partial) from the text and returns the parsed scene, if any.
 */
export function finalizeReply(raw) {
  const { cleanText, scene } = parseSceneTag(raw);
  if (scene) return { cleanText, scene };
  return { cleanText: stripTrailingPartialTag(raw), scene: undefined };
}

/** The most recent scene reported by any message, newest first. */
export function latestScene(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].scene) return messages[i].scene;
  }
  return null;
}
