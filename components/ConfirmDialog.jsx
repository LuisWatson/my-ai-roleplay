'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Trash2, HelpCircle } from 'lucide-react';

/**
 * In-app replacement for window.confirm(). Returns [dialog, ask]: render `dialog` once,
 * then `await ask({ title, text, confirmLabel, danger, avatar })` resolves true (confirmed) or false.
 */
export function useConfirm() {
  const [request, setRequest] = useState(null);
  const requestRef = useRef(null);
  requestRef.current = request;

  const ask = useCallback((options) => new Promise((resolve) => setRequest({ ...options, resolve })), []);

  // Stable, so the dialog's focus/keyboard effect only runs when a new question opens
  const answer = useCallback((value) => {
    requestRef.current?.resolve(value);
    setRequest(null);
  }, []);

  return [<ConfirmDialog key="confirm" request={request} onAnswer={answer} />, ask];
}

function ConfirmDialog({ request, onAnswer }) {
  const cancelRef = useRef(null);

  // Cancel has focus, so a stray Enter never deletes anything; Escape cancels
  useEffect(() => {
    if (!request) return;
    cancelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onAnswer(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [request, onAnswer]);

  if (!request) return null;
  const { title, text, confirmLabel = 'ยืนยัน', danger = false, avatar } = request;
  const Icon = danger ? Trash2 : HelpCircle;

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fadeIn"
      onClick={() => onAnswer(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-slate-800 border border-slate-700/80 rounded-2xl p-5 shadow-2xl space-y-4"
      >
        <div className="flex items-start gap-3">
          {avatar ? (
            <img src={avatar} alt="" className="w-11 h-11 rounded-full object-cover border border-slate-600 flex-shrink-0" />
          ) : (
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                danger ? 'bg-rose-500/15 text-rose-300' : 'bg-purple-500/15 text-purple-300'
              }`}
            >
              <Icon className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0 pt-0.5">
            <h2 id="confirm-title" className="text-base font-semibold text-white">
              {title}
            </h2>
            {text && <p className="text-sm text-slate-400 mt-1 leading-relaxed">{text}</p>}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            ref={cancelRef}
            onClick={() => onAnswer(false)}
            className="flex-1 py-2.5 rounded-xl bg-slate-700/70 hover:bg-slate-700 text-slate-200 text-sm transition focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            ยกเลิก
          </button>
          <button
            onClick={() => onAnswer(true)}
            className={`flex-1 py-2.5 rounded-xl text-white text-sm font-medium transition focus:outline-none focus:ring-2 ${
              danger
                ? 'bg-rose-600 hover:bg-rose-500 focus:ring-rose-400'
                : 'bg-purple-600 hover:bg-purple-500 focus:ring-purple-400'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
