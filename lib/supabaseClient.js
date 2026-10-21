import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Without these the app runs as before: no login, everything in this browser's localStorage.
export const isSupabaseConfigured = Boolean(url && anonKey);

let browserClient = null;

// The signed-in client used by the page (session kept in localStorage, refreshed automatically)
export function getBrowserSupabase() {
  if (!browserClient) {
    browserClient = createClient(url, anonKey, { auth: { flowType: 'pkce' } });
  }
  return browserClient;
}

// A one-off server-side client that acts as the user who owns `accessToken`
export function createSupabaseForToken(accessToken) {
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
