'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Send,
  Square,
  Clapperboard,
  X,
  FastForward,
  Plus,
  Lightbulb,
  Brain,
  UserCog,
  BookOpen,
  MessageCircle,
  Download,
} from 'lucide-react';

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
  onSuggest,
  onOpenMemory,
  onOpenUserRole,
  onOpenExport,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // The + menu closes on Escape or a tap outside it
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);
  const textareaRef = useRef(null);
  const [showDirection, setShowDirection] = useState(false);
  // Phones get a one-line placeholder: the long hint wrapped to two lines and threw the button row off balance
  const [wide, setWide] = useState(true);
  const shortName = (characterName || 'ตัวละคร').replace(/\s*\(.*\)\s*$/, '');
  const placeholder =
    chatStyle === 'dm'
      ? `แชทกับ ${shortName}...`
      : wide
        ? `พิมพ์ *ทำ* "พูด" 'คิด' คุยกับ ${characterName || 'ตัวละคร'}...`
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

  const menuItems = [
    {
      key: 'suggest',
      icon: Lightbulb,
      label: 'แนะนำคำตอบ',
      onClick: onSuggest,
      disabled: !onSuggest || loading,
    },
    {
      key: 'direction',
      icon: Clapperboard,
      label: direction ? 'มีคำกำกับเรื่อง' : 'กำกับเรื่อง',
      onClick: () => setShowDirection(true),
      active: Boolean(direction),
    },
    {
      key: 'style',
      icon: chatStyle === 'dm' ? MessageCircle : BookOpen,
      label: chatStyle === 'dm' ? 'โหมด: แชทสั้น' : 'โหมด: นิยาย',
      onClick: onToggleChatStyle,
    },
    { key: 'memory', icon: Brain, label: 'ความทรงจำ', onClick: onOpenMemory },
    { key: 'role', icon: UserCog, label: 'บทบาทของฉัน', onClick: onOpenUserRole },
    ...(onOpenExport ? [{ key: 'export', icon: Download, label: 'ส่งออก', onClick: onOpenExport }] : []),
  ];

  return (
    <div className="px-3 pt-3 pb-2 md:px-4 md:pt-4 bg-slate-900/60 backdrop-blur-md border-t border-slate-800">
      <div ref={menuRef} className="max-w-4xl mx-auto">
        {menuOpen && (
          <div className="mb-2 grid grid-cols-3 sm:grid-cols-6 gap-1.5 rounded-2xl bg-slate-800/95 border border-slate-700/70 p-2 shadow-xl shadow-black/30 animate-fadeIn">
            {menuItems.map(({ key, icon: Icon, label, onClick, disabled, active }) => (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setMenuOpen(false);
                  onClick?.();
                }}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-3 text-xs transition disabled:opacity-35 disabled:cursor-not-allowed ${
                  active ? 'bg-amber-500/15 text-amber-200' : 'text-slate-200 hover:bg-slate-700/70'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="leading-tight text-center">{label}</span>
              </button>
            ))}
          </div>
        )}
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
          {/* Round + and one ** | "" capsule: three separate boxes crowded the phone layout */}
          <div className="flex items-center gap-2 flex-shrink-0 mb-0.5">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="เมนูเพิ่มเติม"
              aria-expanded={menuOpen}
              className={`h-9 w-9 grid place-items-center rounded-full transition ${
                menuOpen
                  ? 'bg-purple-600/80 text-white'
                  : 'bg-slate-700/60 hover:bg-slate-700 text-purple-300 hover:text-purple-200'
              }`}
            >
              <Plus className={`w-5 h-5 transition-transform ${menuOpen ? 'rotate-45' : ''}`} />
            </button>
            <div className="flex items-center h-9 rounded-full bg-slate-700/60">
              {INSERT_BUTTONS.map(({ label, open, close, tip }, i) => (
                <React.Fragment key={label}>
                  {i > 0 && <span className="w-px h-4 bg-slate-500/60" aria-hidden />}
                  <div className="relative group h-full">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertPair(open, close)}
                      disabled={loading}
                      aria-label={tip}
                      className={`h-full px-2.5 grid place-items-center text-purple-300 hover:text-purple-100 hover:bg-slate-600/60 font-mono text-sm transition disabled:opacity-40 disabled:cursor-not-allowed ${
                        i === 0 ? 'rounded-l-full pl-3' : 'rounded-r-full pr-3'
                      }`}
                    >
                      {label}
                    </button>
                    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-xs text-slate-200 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition shadow-lg">
                      {tip}
                    </span>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder={placeholder}
            className="flex-1 resize-none overflow-hidden bg-transparent border-0 py-2 text-base md:text-sm leading-relaxed text-slate-100 placeholder-slate-500 px-1 focus:outline-none disabled:opacity-50"
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
              className="h-10 w-10 grid place-items-center rounded-xl transition flex-shrink-0 bg-teal-600 hover:bg-teal-500 text-white"
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
                  ? 'bg-purple-500 hover:bg-purple-400 text-white'
                  : 'bg-slate-700/60 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="mt-1.5 px-1 hidden sm:flex items-center justify-end">
          <p className="text-[11px] text-slate-500">
            <kbd className="font-sans text-slate-400">Enter</kbd> ส่ง ·{' '}
            <kbd className="font-sans text-slate-400">Shift + Enter</kbd> ขึ้นบรรทัดใหม่
          </p>
        </div>
      </div>
    </div>
  );
}
