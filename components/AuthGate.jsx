'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, LogOut, Loader2, UploadCloud, AlertTriangle } from 'lucide-react';
import { isSupabaseConfigured, getBrowserSupabase } from '../lib/supabaseClient';
import { createLocalStore, loadCloudStore, localDataKeys, copyLocalDataTo } from '../lib/store';

/**
 * Decides where the app's data lives and renders `children({ store, account, getAccessToken })`.
 * With Supabase configured: Google login, allowlist check, then the user's cloud store.
 * Without it: no login, localStorage only (local development).
 */
export default function AuthGate({ children }) {
  return isSupabaseConfigured ? <CloudGate>{children}</CloudGate> : <LocalOnly>{children}</LocalOnly>;
}

function LocalOnly({ children }) {
  const store = useMemo(() => createLocalStore(), []);
  return children({ store, account: null, getAccessToken: async () => null });
}

function CloudGate({ children }) {
  const supabase = getBrowserSupabase();
  const [session, setSession] = useState(undefined); // undefined until the saved session has been read
  const [state, setState] = useState({ status: 'loading' });
  const [syncFailed, setSyncFailed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  const sessionKnown = session !== undefined;
  const userId = session?.user?.id;

  // Reload only when the signed-in user changes, not on every token refresh
  useEffect(() => {
    if (!sessionKnown) return;
    if (!userId) {
      setState({ status: 'signed-out' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    (async () => {
      try {
        const { data: allowed, error } = await supabase.rpc('is_allowed');
        if (error) throw error;
        if (!allowed) {
          if (!cancelled) setState({ status: 'not-allowed' });
          return;
        }
        const store = await loadCloudStore(supabase, userId, (err) => {
          console.error('Cloud save failed:', err);
          setSyncFailed(true);
        });
        if (cancelled) return;
        const offerImport = store.keys().length === 0 && localDataKeys().length > 0;
        setState({ status: offerImport ? 'offer-import' : 'ready', store });
      } catch (err) {
        if (!cancelled) setState({ status: 'error', message: err.message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, sessionKnown, userId]);

  const signIn = () =>
    supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
  const signOut = () => supabase.auth.signOut();

  const importLocalData = async () => {
    setState((s) => ({ ...s, status: 'importing' }));
    await copyLocalDataTo(state.store);
    setState((s) => ({ ...s, status: 'ready' }));
  };

  if (state.status === 'ready') {
    return (
      <React.Fragment key={userId}>
        {children({
          store: state.store,
          account: { email: session.user.email, onSignOut: signOut },
          getAccessToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
        })}
        {syncFailed && (
          <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100%-2rem)] flex items-center gap-2 bg-amber-900/90 border border-amber-600 text-amber-100 text-xs px-3 py-2 rounded-xl shadow-lg">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>บันทึกข้อมูลขึ้นบัญชีไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วรีเฟรชหน้า</span>
            <button onClick={() => setSyncFailed(false)} className="ml-1 underline">
              ปิด
            </button>
          </div>
        )}
      </React.Fragment>
    );
  }

  return (
    <div className="h-dvh flex items-center justify-center p-4 bg-slate-900">
      <div className="w-full max-w-sm bg-slate-800/80 border border-slate-700 rounded-2xl p-6 text-center space-y-5 shadow-xl">
        <div className="flex items-center justify-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h1 className="font-bold text-lg text-white">Botbaat</h1>
        </div>

        {(state.status === 'loading' || state.status === 'importing') && (
          <div className="flex flex-col items-center gap-3 text-sm text-slate-300">
            <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            <span>{state.status === 'importing' ? 'กำลังย้ายข้อมูลขึ้นบัญชี...' : 'กำลังโหลดข้อมูล...'}</span>
          </div>
        )}

        {state.status === 'signed-out' && (
          <>
            <p className="text-sm text-slate-300">เข้าสู่ระบบเพื่อให้แชทและบทบาทของคุณใช้ได้ทุกเครื่อง</p>
            <button
              onClick={signIn}
              className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 rounded-xl font-medium text-sm transition"
            >
              เข้าสู่ระบบด้วย Google
            </button>
          </>
        )}

        {state.status === 'not-allowed' && (
          <>
            <p className="text-sm text-slate-300">
              บัญชี <span className="text-white">{session?.user?.email}</span> ยังไม่ได้รับอนุญาตให้ใช้งานแอปนี้
            </p>
            <button
              onClick={signOut}
              className="w-full py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm flex items-center justify-center gap-2 transition"
            >
              <LogOut className="w-4 h-4" />
              ใช้บัญชีอื่น
            </button>
          </>
        )}

        {state.status === 'offer-import' && (
          <>
            <UploadCloud className="w-8 h-8 mx-auto text-purple-400" />
            <p className="text-sm text-slate-300 leading-relaxed">
              เจอแชท บทบาท และตัวละครที่เคยเก็บไว้ในเบราว์เซอร์นี้
              <br />
              ย้ายขึ้นบัญชีของคุณเลยไหม?
            </p>
            <div className="space-y-2">
              <button
                onClick={importLocalData}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-medium text-sm transition"
              >
                ย้ายข้อมูลขึ้นบัญชี
              </button>
              <button
                onClick={() => setState((s) => ({ ...s, status: 'ready' }))}
                className="w-full py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-sm transition"
              >
                เริ่มใหม่ (ข้อมูลเดิมยังอยู่ในเบราว์เซอร์นี้)
              </button>
            </div>
          </>
        )}

        {state.status === 'error' && (
          <>
            <p className="text-sm text-red-300">โหลดข้อมูลไม่สำเร็จ: {state.message}</p>
            <div className="flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition"
              >
                ลองใหม่
              </button>
              <button
                onClick={signOut}
                className="flex-1 py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition"
              >
                ออกจากระบบ
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
