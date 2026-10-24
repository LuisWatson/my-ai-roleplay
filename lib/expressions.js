// Expression pictures of a character: `expressions: { happy, shy, sad, angry }` → image paths (all optional).
// The reply's thought pill starts with an emoji (rule 16); it picks which picture fits the mood. No extra AI call.

export const EXPRESSION_LABELS = { happy: 'ยิ้ม', shy: 'เขิน', sad: 'เศร้า / กังวล', angry: 'โกรธ / หมั่นไส้' };

// Single code points (a trailing variation selector is ignored), grouped by the feeling they show
const GROUPS = {
  happy: '😊😄😁😆😂🤣😀😃🥰😍😘😌😎🤩😏😉😋🤗😸💕❤✨🎉',
  shy: '😳🥺🙈😖☺🫣😅🤭',
  sad: '😢😭😔😞😟😥😰😨😱🥲💔😩😫😪😓😕',
  angry: '😠😡🤬😤🙄😒💢',
};

/** Which group an emoji belongs to, or null. */
export function moodOfEmoji(emoji) {
  const first = [...String(emoji || '').trim()][0];
  if (!first) return null;
  for (const [key, list] of Object.entries(GROUPS)) {
    if ([...list].includes(first)) return key;
  }
  return null;
}

/** The leading emoji of a stored thought ("😳 ทำไมใจเต้น…"), or ''. */
export function emojiOfThought(thought) {
  const first = [...String(thought || '').trim()][0] || '';
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
 * character has one, otherwise the main portrait. Returns { src, key } (key null for the main portrait).
 */
export function pictureFor(character, thought) {
  const key = moodOfEmoji(emojiOfThought(thought));
  const src = key && character?.expressions?.[key];
  return src ? { src, key } : { src: character?.avatar, key: null };
}
