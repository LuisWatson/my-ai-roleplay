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

const isSyncedKey = (key) => SYNCED_KEYS.has(key) || key.startsWith('chat_history_');

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
  const { data, error } = await supabase.from('user_kv').select('key, value');
  if (error) throw error;

  const cache = new Map(data.map((row) => [row.key, row.value]));
  const queues = new Map();

  const enqueue = (key, request) => {
    const next = (queues.get(key) || Promise.resolve())
      .then(request)
      .then((res) => {
        if (res?.error) onError(res.error);
      })
      .catch(onError);
    queues.set(key, next);
  };

  return {
    getItem: (key) => (DEVICE_ONLY_KEYS.has(key) ? localStorage.getItem(key) : cache.get(key) ?? null),
    setItem: (key, value) => {
      if (DEVICE_ONLY_KEYS.has(key)) return localStorage.setItem(key, value);
      const text = String(value);
      cache.set(key, text);
      enqueue(key, () =>
        supabase.from('user_kv').upsert({ user_id: userId, key, value: text, updated_at: new Date().toISOString() })
      );
    },
    removeItem: (key) => {
      if (DEVICE_ONLY_KEYS.has(key)) return localStorage.removeItem(key);
      cache.delete(key);
      enqueue(key, () => supabase.from('user_kv').delete().eq('user_id', userId).eq('key', key));
    },
    keys: () => [...cache.keys()],
    // Resolves once every write made so far has been sent
    flush: () => Promise.all([...queues.values()]),
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
