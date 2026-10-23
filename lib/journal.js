// Memory journal ("สมุดความทรงจำ"): key moments of a story the user chose to keep, per character, under
// chat_journal_<id> as a JSON array (oldest first) of
//   { id, title, at, place, time, background, excerpt }
// `at` is the real date (ms); place/time/background come from the scene at that moment; `excerpt` is the
// start of the reply it came from. Saved moments are sent to the model every time (see lib/prompt.js) and
// are never summarized away. A chat message tracks its own moment as { title, state, entryId }, where state
// is 'pending' (waiting for the user), 'saved' or 'dismissed'.

export const journalKey = (charId) => `chat_journal_${charId}`;

export const MAX_JOURNAL_ENTRIES = 100;
export const MAX_TITLE_CHARS = 120;
const EXCERPT_CHARS = 400;

export function readJournal(store, charId) {
  try {
    const entries = JSON.parse(store.getItem(journalKey(charId)) || '[]');
    return Array.isArray(entries) ? entries.filter((e) => e && typeof e.title === 'string' && e.id) : [];
  } catch {
    return [];
  }
}

function writeJournal(store, charId, entries) {
  if (entries.length > 0) store.setItem(journalKey(charId), JSON.stringify(entries));
  else store.removeItem(journalKey(charId));
}

// Adds a moment taken from `message` (with the scene it happened in) and returns the new entry
export function addJournalEntry(store, charId, { title, message, scene }) {
  const entry = {
    id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: title.trim().slice(0, MAX_TITLE_CHARS),
    at: Date.now(),
    place: scene?.location || '',
    time: scene?.time || '',
    background: scene?.background || '',
    excerpt: (message?.text || '').slice(0, EXCERPT_CHARS),
  };
  writeJournal(store, charId, [...readJournal(store, charId), entry].slice(-MAX_JOURNAL_ENTRIES));
  return entry;
}

export function removeJournalEntry(store, charId, entryId) {
  writeJournal(store, charId, readJournal(store, charId).filter((e) => e.id !== entryId));
}

export function renameJournalEntry(store, charId, entryId, title) {
  const clean = title.trim().slice(0, MAX_TITLE_CHARS);
  if (!clean) return;
  writeJournal(
    store,
    charId,
    readJournal(store, charId).map((e) => (e.id === entryId ? { ...e, title: clean } : e))
  );
}

// Title reduced to what matters for spotting a repeat: no spaces, punctuation or case
function momentKey(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '');
}

// Moments the app already offered in this chat but that are not in the journal (dismissed, or still waiting),
// newest last. Sent to the model so it doesn't offer them again; saved ones reach it through the journal.
export function offeredMomentTitles(messages, limit = 20) {
  const seen = new Set();
  const titles = [];
  for (const m of messages) {
    const title = m.moment?.title?.trim();
    if (!title || m.moment.state === 'saved') continue;
    const key = momentKey(title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    titles.push(title.slice(0, MAX_TITLE_CHARS));
  }
  return titles.slice(-limit);
}

// True when `title` names a moment already offered or saved: same words, or one title contains the other
// ("เดตตู้คีบตุ๊กตา" / "เดตตู้คีบตุ๊กตาริมห้าง"). Very short titles only match exactly.
export function isRepeatedMoment(title, knownTitles) {
  const key = momentKey(title);
  if (!key) return false;
  return knownTitles.some((known) => {
    const other = momentKey(known);
    if (!other) return false;
    if (other === key) return true;
    const shorter = key.length < other.length ? key : other;
    return shorter.length >= 6 && (key.includes(other) || other.includes(key));
  });
}

// What the prompt gets: the newest entries' titles with where/when they happened
export function journalForPrompt(entries, limit = 30) {
  return entries.slice(-limit).map((e) => ({ title: e.title, place: e.place, time: e.time }));
}
