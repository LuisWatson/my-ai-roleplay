// A character's story setup: `situation` (what is going on and what is unresolved), `userSecret` (the user's
// side of it), `opening` { time, place, mood, background } (the card above the first message) and the
// story hooks. Chats started before this existed must not suddenly get a plot they never had, so these are
// sent only for chats whose first message is marked `storyStart` (every chat opened from now on).

const STORY_FIELDS = ['situation', 'userSecret', 'storyHooks'];

/** The opening card of a character, or null when it has none. Every part is optional except one of them. */
export function openingOf(char) {
  const o = char?.opening;
  if (!o || typeof o !== 'object') return null;
  const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const card = {
    time: clean(o.time, 60),
    place: clean(o.place, 80),
    mood: clean(o.mood, 300),
    background: clean(o.background, 20),
  };
  return card.time || card.place || card.mood ? card : null;
}

/** The first message of a new chat: the greeting, marked as a story start, set in the opening's place and time. */
export function openingMessage(char) {
  const card = openingOf(char);
  const scene = card?.place
    ? { location: card.place, time: card.time || '', ...(card.background && { background: card.background }) }
    : undefined;
  return { role: 'model', text: char?.greeting || '', storyStart: true, ...(scene && { scene }) };
}

/** True when this chat began with the story setup (see the note at the top). */
export function isStoryChat(messages) {
  return Boolean(messages?.[0]?.storyStart);
}

/** The character as sent to /api/chat: without the story setup for chats started before it existed. */
export function personaForChat(persona, messages) {
  // The hidden truth never travels whole: lib/truth.js sends only the stages that are told or due
  const { truthStages, ...rest } = persona;
  if (isStoryChat(messages)) return rest;
  for (const key of STORY_FIELDS) delete rest[key];
  return rest;
}
