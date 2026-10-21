'use client';

import React, { useEffect, useRef } from 'react';
import { Send, Square } from 'lucide-react';

const MAX_HEIGHT_PX = 200;

const INSERT_BUTTONS = [
  { label: '**', open: '*', close: '*', tip: 'การกระทำ' },
  { label: '""', open: '"', close: '"', tip: 'คำพูด' },
];

/**
 * Chat input that grows with the text, so a long *action* "speech" message stays readable while typing.
 * Enter sends, Shift+Enter adds a new line.
 */
export default function ChatInput({ input, setInput, onSendMessage, onStop, loading, characterName }) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, MAX_HEIGHT_PX);
    el.style.height = `${next}px`;
    // Only show a scrollbar once the text is taller than the cap.
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT_PX ? 'auto' : 'hidden';
  }, [input]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onSendMessage();
    }
  };

  // Inserts a pair of marks at the cursor (or wraps the selection) and puts the cursor between them.
  const insertPair = (open, close) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? input.length;
    const end = el.selectionEnd ?? input.length;
    const selected = input.slice(start, end);
    setInput(input.slice(0, start) + open + selected + close + input.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + open.length + selected.length;
      el.setSelectionRange(selected ? start + open.length : cursor, cursor);
    });
  };

  const canSend = input.trim().length > 0;

  return (
    <div className="px-3 pt-3 pb-2 md:px-4 md:pt-4 bg-slate-900/60 backdrop-blur-md border-t border-slate-800">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-end gap-2 rounded-2xl bg-slate-800/70 border border-slate-700/70 px-2 py-2 shadow-lg shadow-black/20 transition focus-within:border-purple-500/70 focus-within:ring-2 focus-within:ring-purple-500/20">
          <div className="flex gap-1.5 flex-shrink-0">
            {INSERT_BUTTONS.map(({ label, open, close, tip }) => (
              <div key={label} className="relative group">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertPair(open, close)}
                  disabled={loading}
                  aria-label={tip}
                  className="h-10 w-10 grid place-items-center rounded-xl bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-purple-300 hover:text-purple-200 font-mono text-base transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {label}
                </button>
                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-xs text-slate-200 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition shadow-lg">
                  {tip}
                </span>
              </div>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder={`พิมพ์ *การกระทำ* "คำพูด" คุยกับ ${characterName || 'ตัวละคร'}...`}
            className="chat-input-scroll flex-1 resize-none overflow-hidden bg-transparent border-0 py-2 text-base md:text-sm leading-relaxed text-slate-100 placeholder-slate-500 px-1 focus:outline-none disabled:opacity-50"
          />
          {loading ? (
            <button
              onClick={onStop}
              title="หยุดตอบ"
              className="h-10 w-10 grid place-items-center rounded-xl bg-slate-700 hover:bg-red-600/80 text-white transition flex-shrink-0"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              onClick={onSendMessage}
              disabled={!canSend}
              title="ส่งข้อความ"
              className={`h-10 w-10 grid place-items-center rounded-xl transition flex-shrink-0 ${
                canSend
                  ? 'bg-gradient-to-br from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white shadow-md shadow-purple-900/40'
                  : 'bg-slate-700/60 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="hidden sm:block mt-1.5 px-1 text-[11px] text-slate-500">
          <kbd className="font-sans text-slate-400">Enter</kbd> ส่ง ·{' '}
          <kbd className="font-sans text-slate-400">Shift + Enter</kbd> ขึ้นบรรทัดใหม่
        </p>
      </div>
    </div>
  );
}
