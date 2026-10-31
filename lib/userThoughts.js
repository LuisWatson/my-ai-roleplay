// The player's inner thoughts, written in single quotes: 'แอบคิดว่าเธอน่ารักจัง'. They are shown in the chat but
// never sent to the model (chat, suggestions, memory), so the character cannot react to what the player only thinks.
// A quote only opens after a non-letter (so "don't" and "dogs' bone" are left alone) and only closes before one.
const THOUGHT_REGEX = /(^|[^A-Za-z0-9'’‘])['‘]([^'’‘\n]+)['’](?![A-Za-z0-9])/g;

/** Remove the player's thoughts from a message before it goes to the model. */
export function stripUserThoughts(text) {
  return String(text ?? '')
    .replace(THOUGHT_REGEX, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Cut a text into plain pieces and thoughts, for display.
 * @returns {{ thought: boolean, text: string }[]}
 */
export function splitUserThoughts(text) {
  const pieces = [];
  let last = 0;
  for (const m of String(text ?? '').matchAll(THOUGHT_REGEX)) {
    const start = m.index + m[1].length;
    if (start > last) pieces.push({ thought: false, text: text.slice(last, start) });
    pieces.push({ thought: true, text: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) pieces.push({ thought: false, text: text.slice(last) });
  return pieces;
}

/** Messages as the model should see them: the user's turns without their thoughts (a turn that was only thought is dropped). */
export function withoutUserThoughts(messages) {
  return (messages || [])
    .map((m) => (m?.role === 'user' && typeof m.text === 'string' ? { ...m, text: stripUserThoughts(m.text) } : m))
    .filter((m) => typeof m?.text !== 'string' || m.role !== 'user' || m.text);
}
