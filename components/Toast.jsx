'use client';

import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

const AUTO_HIDE_MS = 5000;

/**
 * Small message floating at the top of the screen, for results that happen away from the chat
 * (e.g. importing a backup). `toast` is { kind: 'success' | 'error', title, text? } or null.
 */
export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onClose, AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;
  const isError = toast.kind === 'error';
  const Icon = isError ? AlertCircle : CheckCircle2;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm animate-fadeIn">
      <div
        role="status"
        className={`flex items-start gap-3 px-4 py-3 rounded-2xl border shadow-xl backdrop-blur-md ${
          isError ? 'bg-rose-950/90 border-rose-500/40 text-rose-100' : 'bg-slate-800/95 border-emerald-500/40 text-slate-100'
        }`}
      >
        <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isError ? 'text-rose-300' : 'text-emerald-400'}`} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{toast.title}</div>
          {toast.text && <div className="text-xs opacity-80 mt-0.5 break-words">{toast.text}</div>}
        </div>
        <button onClick={onClose} title="ปิด" className="opacity-60 hover:opacity-100 transition">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
