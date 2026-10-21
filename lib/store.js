// App storage with the same shape as localStorage (getItem / setItem / removeItem) plus keys().
// The local store is plain localStorage; the cloud store keeps the signed-in user's data in the
// Supabase `user_kv` table (see supabase/schema.sql), with an in-memory copy so reads stay synchronous.

// Never leaves this device: a key typed into Settings belongs to the browser it was typed in.
const DEVICE_ONLY_KEYS = new Set(['user_gemini_api_key']);

const SYNCED_KEYS = new Set([
  'user_custom_chars',
  'user_character_roles',
  'user_roleplay_profile',
  'user_response_settings',
  'user_chat_activity',
  'user_role_prompted',
  'user_gemini_model',
]);

const isSyncedKey = (key) => SYNCED_KEYS.has(key) || /^chat_(history|memory|pins|journal|style)_/.test(key);

export function createLocalStore() {
  return {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
    removeItem: (key) => localStorage.removeItem(key),
    keys: () => Object.keys(localStorage),
  };
}

// Loads every row of the user's data, then returns a store backed by it.
// Writes update the in-memory copy at once and reach Supabase in order per key; failures go to `onError`.
export async function loadCloudStore(supabase, userId, onError) {
  const { data, error } = await supabase.from('user_kv').select('key, value, updated_at');
  if (error) throw error;

  const cache = new Map(data.map((row) => [row.key, row.value]));
  // updated_at of the copy we hold, in ms, to spot rows another device changed
  const stamps = new Map(data.map((row) => [row.key, Date.parse(row.updated_at)]));
  const queues = new Map();
  let pending = 0;
  let writeCount = 0; // bumps on every local change, to notice edits made during a refresh

  const enqueue = (key, request) => {
    pending++;
    writeCount++;
    const next = (queues.get(key) || Promise.resolve())
      .then(request)
      .then((res) => {
        if (res?.error) onError(res.error);
      })
      .catch(onError)
      .finally(() => pending--);
    queues.set(key, next);
  };

  return {
    getItem: (key) => (DEVICE_ONLY_KEYS.has(key) ? localStorage.getItem(key) : cache.get(key) ?? null),
    setItem: (key, value) => {
      if (DEVICE_ONLY_KEYS.has(key)) return localStorage.setItem(key, value);
      const text = String(value);
      const now = Date.now();
      cache.set(key, text);
      stamps.set(key, now);
      enqueue(key, () =>
        supabase.from('user_kv').upsert({ user_id: userId, key, value: text, updated_at: new Date(now).toISOString() })
      );
    },
    removeItem: (key) => {
      if (DEVICE_ONLY_KEYS.has(key)) return localStorage.removeItem(key);
      cache.delete(key);
      stamps.delete(key);
      enqueue(key, () => supabase.from('user_kv').delete().eq('user_id', userId).eq('key', key));
    },
    keys: () => [...cache.keys()],
    // Resolves once every write made so far has been sent
    flush: () => Promise.all([...queues.values()]),
    hasPendingWrites: () => pending > 0,

    // Pulls in rows another device added, changed or removed since we loaded. Fetches only the
    // timestamps, then the values that differ. Returns true when anything changed. Does nothing
    // while our own writes are still on their way, so it never replaces newer local data.
    refresh: async () => {
      if (pending > 0) return false;
      const writesBefore = writeCount;
      const { data: rows, error: listError } = await supabase.from('user_kv').select('key, updated_at');
      if (listError) throw listError;

      const onServer = new Map(rows.map((row) => [row.key, Date.parse(row.updated_at)]));
      const changed = rows.filter((row) => stamps.get(row.key) !== onServer.get(row.key)).map((row) => row.key);
      const removed = [...cache.keys()].filter((key) => !onServer.has(key));
      if (changed.length === 0 && removed.length === 0) return false;

      let fresh = [];
      if (changed.length > 0) {
        const { data: values, error: valueError } = await supabase
          .from('user_kv')
          .select('key, value, updated_at')
          .in('key', changed);
        if (valueError) throw valueError;
        fresh = values;
      }
      if (writeCount !== writesBefore) return false; // a local edit happened meanwhile; it wins, try again next time

      for (const row of fresh) {
        cache.set(row.key, row.value);
        stamps.set(row.key, Date.parse(row.updated_at));
      }
      for (const key of removed) {
        cache.delete(key);
        stamps.delete(key);
      }
      return true;
    },
  };
}

// Keys in this browser's localStorage worth copying into a new account
export function localDataKeys() {
  return Object.keys(localStorage).filter(isSyncedKey);
}

export async function copyLocalDataTo(store) {
  for (const key of localDataKeys()) {
    store.setItem(key, localStorage.getItem(key));
  }
  await store.flush();
}
