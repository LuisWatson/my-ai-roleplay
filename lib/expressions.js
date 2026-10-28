// Expression pictures of a character: `expressions: { happy, shy, sad, angry, thinking, surprised, teasing, worried }`
// → image paths (all optional). The reply's thought pill starts with an emoji (rule 16); it picks which picture
// fits the mood. No extra AI call.

export const EXPRESSION_LABELS = {
  happy: 'ยิ้ม',
  shy: 'เขิน',
  sad: 'เศร้า',
  angry: 'โกรธ / หมั่นไส้',
  thinking: 'คิด / เฉยๆ',
  surprised: 'ตกใจ',
  teasing: 'แกล้ง / เจ้าเล่ห์',
  worried: 'กังวล / อึดอัด',
};

// The only emoji the model is asked to use (rule 16 in lib/prompt.js), one per expression, with its label
export const THOUGHT_EMOJI_LIST = [
  ['😊', 'ยิ้ม/ดีใจ'],
  ['😳', 'เขิน'],
  ['😢', 'เศร้า'],
  ['😠', 'โกรธ/หมั่นไส้'],
  ['🤔', 'คิด/เฉยๆ'],
  ['😮', 'ตกใจ'],
  ['😏', 'แกล้ง/เจ้าเล่ห์'],
  ['😟', 'กังวล/อึดอัด'],
];

// Single code points (a trailing variation selector is ignored), grouped by the feeling they show. Older replies
// (and a model that strays from the list) use many more emoji than the eight above.
const GROUPS = {
  happy: '😊😄😁😆😂🤣😀😃🥰😍😘😌😎🤩😋🤗😸💕❤✨🎉🙂🥹😇',
  shy: '😳🥺🙈😖☺🫣😅🤭🫢',
  sad: '😢😭😔😞🥲💔😩😫😪😓',
  angry: '😠😡🤬😤🙄😒💢',
  thinking: '🤔🧐🤨😐😑😶💭🫤😕',
  surprised: '😮😲😯😱🫨😵',
  teasing: '😏😉😜😝😛😈',
  worried: '😟😰😨😥😬😣🫠',
};

// Emoji made of several code points, matched whole before the first code point is looked up
const SEQUENCES = { '😮‍💨': 'worried', '😶‍🌫️': 'thinking' };

// A character without a picture for the newer expressions shows the closest older one (as before they existed)
const FALLBACK = { teasing: 'happy', worried: 'sad' };

/** Which group an emoji belongs to, or null. */
export function moodOfEmoji(emoji) {
  const text = String(emoji || '').trim();
  for (const [sequence, key] of Object.entries(SEQUENCES)) if (text.startsWith(sequence)) return key;
  const first = [...text][0];
  if (!first) return null;
  for (const [key, list] of Object.entries(GROUPS)) {
    if ([...list].includes(first)) return key;
  }
  return null;
}

/** The leading emoji of a stored thought ("😳 ทำไมใจเต้น…"), or ''. */
export function emojiOfThought(thought) {
  const text = String(thought || '').trim();
  for (const sequence of Object.keys(SEQUENCES)) if (text.startsWith(sequence)) return sequence;
  const first = [...text][0] || '';
  return /\p{Extended_Pictographic}/u.test(first) ? first : '';
}

/**
 * For each message, the expression card to show before it: when a character's reply shows a different expression
 * from her previous reply (or the first one that has one); null otherwise. Lets the reader see her face change
 * without a picture under every reply.
 */
export function moodChanges(messages, character) {
  let previous = null;
  return messages.map((m) => {
    if (m.role !== 'model') return null;
    const { key, src } = pictureFor(character, m.thought);
    const card = key && key !== previous ? { key, src, emoji: emojiOfThought(m.thought) } : null;
    previous = key;
    return card;
  });
}

/**
 * The picture to show for a character right now: the expression that fits the latest thought's emoji when the
 * character has one (or its fallback), otherwise the main portrait. Returns { src, key } (key null for the main
 * portrait; otherwise the expression whose picture is shown).
 */
export function pictureFor(character, thought) {
  const mood = moodOfEmoji(emojiOfThought(thought));
  for (const key of [mood, FALLBACK[mood]]) {
    const src = key && character?.expressions?.[key];
    if (src) return { src, key };
  }
  return { src: character?.avatar, key: null };
}
