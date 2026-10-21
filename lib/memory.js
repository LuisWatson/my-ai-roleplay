import { HISTORY_CHAR_BUDGET } from '../constants/chatSettings';

// Long-term memory per chat, kept in the store under chat_memory_<characterId>:
//   { summary, covered, hash }
// `summary` (made by /api/memory) stands in for messages[0..covered). Messages after that are sent as-is.
// `hash` fingerprints those covered messages, so editing or deleting one of them drops the memory and
// it is rebuilt.

// Older chat is summarized once this much has piled up beyond the recent window, so a summary costs one
// request per several turns rather than one per turn.
export const MEMORY_CHUNK_CHARS = 6000;

// Most chat sent to /api/memory at once; a long chat from before this feature catches up over several replies.
export const MEMORY_MAX_BATCH_CHARS = 30000;

export const memoryKey = (charId) => `chat_memory_${charId}`;

// Facts the user pinned for a character ("never forget"): a JSON array of short strings under
// chat_pins_<id>. Always sent, never summarized away, and kept when the chat is cleared.
export const pinsKey = (charId) => `chat_pins_${charId}`;
export const MAX_PINS = 20;
export const MAX_PIN_CHARS = 200;

export function readPins(store, charId) {
  try {
    const pins = JSON.parse(store.getItem(pinsKey(charId)) || '[]');
    return Array.isArray(pins) ? cleanPins(pins) : [];
  } catch {
    return [];
  }
}

export function cleanPins(pins) {
  return pins
    .filter((p) => typeof p === 'string')
    .map((p) => p.trim().slice(0, MAX_PIN_CHARS))
    .filter(Boolean)
    .slice(0, MAX_PINS);
}

const textLength = (messages) => messages.reduce((sum, m) => sum + (m.text?.length || 0), 0);

// Newest messages that fit in `budget` characters; always keeps at least the latest message.
export function takeRecentMessages(messages, budget) {
  const recent = [];
  let used = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    used += messages[i].text.length;
    if (recent.length > 0 && used > budget) break;
    recent.unshift({ role: messages[i].role, text: messages[i].text });
  }
  return recent;
}

// Short fingerprint (djb2) of messages[0..count)
export function fingerprint(messages, count) {
  let h = 5381;
  for (let i = 0; i < count; i++) {
    const s = `${messages[i]?.role}\u0000${messages[i]?.text}\u0001`;
    for (let j = 0; j < s.length; j++) h = ((h * 33) ^ s.charCodeAt(j)) >>> 0;
  }
  return `${count}:${h.toString(36)}`;
}

// The saved memory for this chat, or null when there is none or it no longer matches `messages`
export function readMemory(store, charId, messages) {
  try {
    const memory = JSON.parse(store.getItem(memoryKey(charId)) || 'null');
    if (
      typeof memory?.summary !== 'string' ||
      !Number.isInteger(memory.covered) ||
      memory.covered < 1 ||
      memory.covered > messages.length ||
      memory.hash !== fingerprint(messages, memory.covered)
    ) {
      return null;
    }
    return memory;
  } catch {
    return null;
  }
}

// Messages to send with a request: everything after the summarized part, newest first, within a cap
export function chatWindow(messages, memory) {
  return takeRecentMessages(messages.slice(memory?.covered || 0), HISTORY_CHAR_BUDGET + MEMORY_CHUNK_CHARS);
}

/**
 * The next messages to fold into memory, or null when it's not time yet. Leaves HISTORY_CHAR_BUDGET of the
 * newest chat untouched and waits until at least MEMORY_CHUNK_CHARS of older chat has built up.
 * Returns { to, messages }: after summarizing, memory covers messages[0..to).
 */
export function nextMemoryBatch(messages, memory) {
  const start = memory?.covered || 0;
  const rest = messages.slice(start);
  const keep = takeRecentMessages(rest, HISTORY_CHAR_BUDGET).length;
  const older = rest.slice(0, rest.length - keep);
  if (textLength(older) < MEMORY_CHUNK_CHARS) return null;

  const batch = [];
  let used = 0;
  for (const m of older) {
    if (batch.length > 0 && used + m.text.length > MEMORY_MAX_BATCH_CHARS) break;
    batch.push({ role: m.role, text: m.text });
    used += m.text.length;
  }
  return { to: start + batch.length, messages: batch };
}
