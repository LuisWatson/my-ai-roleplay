import { openingMessage } from './story';

export const STALL_TIMEOUT_MS = 25000;
export const FIRST_RESPONSE_CLIENT_TIMEOUT_MS = 35000;
export const SIDEBAR_COLLAPSED_KEY = 'botbaat_sidebar_collapsed';

// Last-activity time per character chat, for the sidebar's chat list. Histories saved before this
// existed have no entry, so they are picked up from storage with time 0 (listed as older chats).
export function readChatActivity(store) {
  let activity = {};
  try {
    activity = JSON.parse(store.getItem('user_chat_activity')) || {};
  } catch (err) {
    console.error('Failed to parse chat activity from storage:', err);
  }
  for (const key of store.keys()) {
    if (key.startsWith('chat_history_')) {
      const id = key.slice('chat_history_'.length);
      if (!(id in activity)) activity[id] = 0;
    }
  }
  return activity;
}

// One-line preview of a chat's last message, with *(action)* narration removed
export function lastMessagePreview(store, charId) {
  try {
    const history = JSON.parse(store.getItem(`chat_history_${charId}`) || '[]');
    const last = history[history.length - 1];
    if (!last?.text) return '';
    const text = last.text.replace(/\*\([^)]*\)\*/g, '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
    return last.role === 'user' ? `คุณ: ${text}` : text;
  } catch {
    return '';
  }
}

// What the chat shows when a reply can't be had, by the `kind` /api/chat returns (plus 'network' for a failed fetch)
export const REPLY_ERRORS = {
  busy: { kind: 'error', title: 'ส่งข้อความไม่สำเร็จ', text: 'ตอนนี้ระบบ AI ของ Google คนใช้เยอะ ลองส่งอีกครั้งในอีกสักครู่' },
  quota: {
    kind: 'error',
    title: 'วันนี้คุยกันจนโควต้าฟรีหมดแล้ว',
    text: 'โควต้าจะกลับมาประมาณบ่าย 2–3 โมง (เวลาไทย) หรือใส่ Gemini API Key อื่นในตั้งค่า',
    retry: false,
  },
  network: { kind: 'error', title: 'เชื่อมต่อไม่ได้', text: 'ตรวจอินเทอร์เน็ตแล้วลองส่งอีกครั้ง' },
  signin: { kind: 'error', title: 'ต้องเข้าสู่ระบบใหม่', text: 'ออกจากระบบแล้วเข้าสู่ระบบอีกครั้ง', retry: false },
  auth: { kind: 'error', title: 'Gemini API Key ใช้ไม่ได้', text: 'ตรวจ key ในหน้าตั้งค่า หรือในไฟล์ .env.local', retry: false },
  blocked: {
    kind: 'warn',
    title: 'Google ไม่ยอมตอบเนื้อหาช่วงนี้',
    text: 'ระบบความปลอดภัยของ Google บล็อกคำตอบนี้ ลองแก้ข้อความล่าสุด (✏️) หรือกำกับให้เรื่องไปทางอื่น แล้วส่งใหม่ — กดส่งซ้ำแบบเดิมจะโดนบล็อกอีก',
    retry: false,
  },
};

// The character as sent to the server: the model never sees the pictures, and an uploaded photo is a
// large data URL, so leave them out of every request
export function withoutImages({ avatar, background, expressions, ...persona }) {
  return persona;
}

// What one swipe version of a reply holds (missing parts stay undefined, so switching clears them)
export function swipeVersion({ text, scene, moment, relation, choices, thought, style, reveal, model }) {
  return { text, scene, moment, relation, choices, thought, style, reveal, model };
}

// A reply without its other swipe versions (once the story moves on, only the chosen one is kept)
export function withoutSwipes({ alts, altIndex, ...message }) {
  return message;
}

// A character's saved conversation, or just their greeting when there is none yet
export function savedHistoryOrGreeting(store, char) {
  try {
    const parsed = JSON.parse(store.getItem(`chat_history_${char.id}`) || '[]');
    // A chat that never got past the old greeting starts over with the story setup
    const untouched = parsed.length === 1 && parsed[0]?.role === 'model' && !parsed[0].storyStart;
    if (Array.isArray(parsed) && parsed.length > 0 && !untouched) return parsed;
  } catch (err) {
    console.error('Failed to parse chat history:', err);
  }
  return [openingMessage(char)];
}
