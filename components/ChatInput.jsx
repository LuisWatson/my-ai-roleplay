'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Send, Square, Clapperboard, X, FastForward } from 'lucide-react';

const MAX_HEIGHT_PX = 200;

const INSERT_BUTTONS = [
  { label: '**', open: '*', close: '*', tip: 'การกระทำ' },
  { label: '""', open: '"', close: '"', tip: 'คำพูด' },
];

/**
 * Chat input that grows with the text, so a long *action* "speech" message stays readable while typing.
 * Enter sends, Shift+Enter adds a new line. "กำกับเรื่อง" opens a field for an out-of-story instruction
 * that applies to the next reply (sent or regenerated) and then clears.
 */
export default function ChatInput({
  input,
  setInput,
  onSendMessage,
  onContinue,
  onStop,
  loading,
  characterName,
  direction,
  setDirection,
  chatStyle,
  onToggleChatStyle,
}) {
  const textareaRef = useRef(null);
  const [showDirection, setShowDirection] = useState(false);
  // Phones get a one-line placeholder: the long hint wrapped to two lines and threw the button row off balance
  const [wide, setWide] = useState(true);
  const shortName = (characterName || 'ตัวละคร').replace(/\s*\(.*\)\s*$/, '');
  const placeholder =
    chatStyle === 'dm'
      ? `แชทกับ ${shortName}...`
      : wide
        ? `พิมพ์ *การกระทำ* "คำพูด" คุยกับ ${characterName || 'ตัวละคร'}...`
        : `คุยกับ ${shortName}...`;

  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)');
    const update = () => setWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const directionOpen = showDirection || Boolean(direction);

  // Once a reply has used the direction (it is cleared then), fold the box away again
  useEffect(() => {
    if (!loading && !direction) setShowDirection(false);
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, MAX_HEIGHT_PX);
    el.style.height = `${next}px`;
    // Only show a scrollbar once the text is taller than the cap.
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT_PX ? 'auto' : 'hidden';
  }, [input, placeholder]); // an empty box is as tall as its placeholder

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
        {directionOpen && (
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-amber-950/40 border border-amber-500/30 px-3 py-1.5 animate-fadeIn">
            <Clapperboard className="w-4 h-4 text-amber-300 flex-shrink-0" />
            <input
              type="text"
              autoFocus={showDirection && !direction}
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              maxLength={500}
              placeholder="กำกับคำตอบถัดไป เช่น ให้ฝนเริ่มตก, ข้ามไปตอนเย็น, ให้เธองอนหนักขึ้น"
              className="flex-1 min-w-0 bg-transparent border-0 py-1 text-base md:text-sm text-amber-50 placeholder-amber-200/40 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setDirection('');
                setShowDirection(false);
              }}
              title="ยกเลิกการกำกับ"
              className="p-1 rounded-md text-amber-200/60 hover:text-amber-100 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
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
            placeholder={placeholder}
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
          ) : !canSend && onContinue ? (
            // Empty input: the send slot becomes "continue", like other roleplay apps
            <button
              onClick={onContinue}
              title="ให้ตอบต่อทันที"
              aria-label="ให้ตอบต่อทันที"
              className="h-10 w-10 grid place-items-center rounded-xl transition flex-shrink-0 bg-gradient-to-br from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 text-white shadow-md shadow-cyan-900/40"
            >
              <FastForward className="w-4 h-4 fill-current" />
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
        <div className="mt-1.5 px-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowDirection((v) => !v || Boolean(direction))}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] transition ${
                direction ? 'text-amber-300 bg-amber-500/10' : 'text-slate-400 hover:text-amber-200'
              }`}
            >
              <Clapperboard className="w-3.5 h-3.5" />
              <span>{direction ? 'มีคำกำกับเรื่อง' : 'กำกับเรื่อง'}</span>
            </button>
            <button
              type="button"
              onClick={onToggleChatStyle}
              title="สลับระหว่างแบบนิยายกับแชทสั้นแบบ LINE"
              className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] transition ${
                chatStyle === 'dm' ? 'text-sky-300 bg-sky-500/10' : 'text-slate-400 hover:text-sky-200'
              }`}
            >
              <span aria-hidden>{chatStyle === 'dm' ? '💬' : '📖'}</span>
              <span>{chatStyle === 'dm' ? 'แชทสั้น' : 'นิยาย'}</span>
            </button>
          </div>
          <p className="hidden sm:block text-[11px] text-slate-500">
            <kbd className="font-sans text-slate-400">Enter</kbd> ส่ง ·{' '}
            <kbd className="font-sans text-slate-400">Shift + Enter</kbd> ขึ้นบรรทัดใหม่
          </p>
        </div>
      </div>
    </div>
  );
}
