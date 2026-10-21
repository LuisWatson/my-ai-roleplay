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

// What the prompt gets: the newest entries' titles with where/when they happened
export function journalForPrompt(entries, limit = 30) {
  return entries.slice(-limit).map((e) => ({ title: e.title, place: e.place, time: e.time }));
}
