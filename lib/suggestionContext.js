export const SUGGEST_MAX_MESSAGES = 40;
export const SUGGEST_MAX_MESSAGE_CHARS = 1500;
export const SUGGEST_HISTORY_CHARS = 12000;

export function suggestionContext(messages, covered = 0) {
  const start = Number.isInteger(covered) && covered >= 0 && covered <= messages.length ? covered : 0;
  const selected = [];
  let chars = 0;
  let truncated = false;
  for (let i = messages.length - 1; i >= start; i--) {
    const message = messages[i];
    if (typeof message?.text !== 'string' || !message.text.trim()) continue;
    if (selected.length >= SUGGEST_MAX_MESSAGES) {
      truncated = true;
      break;
    }
    const text = message.text.slice(-SUGGEST_MAX_MESSAGE_CHARS);
    if (selected.length && chars + text.length > SUGGEST_HISTORY_CHARS) {
      truncated = true;
      break;
    }
    if (text.length !== message.text.length) truncated = true;
    selected.unshift({ role: message.role === 'user' ? 'user' : 'model', text });
    chars += text.length;
  }
  return { messages: selected, truncated };
}
