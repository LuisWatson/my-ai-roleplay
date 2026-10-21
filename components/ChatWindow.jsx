'use client';

import React, { useRef, useEffect, useState } from 'react';
import { ArrowLeft, Trash2, UserCog, X, MapPin, Clock, AlertCircle, RotateCcw, Brain } from 'lucide-react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { latestScene } from '../lib/scene';
import { latestRelation } from '../lib/relation';
import { sceneBackgroundSrc } from '../constants/sceneBackgrounds';

// Story-style lines shown while the reply is on its way; never about the app or the AI
const WAITING_LINES = [
  (name) => `${name}นิ่งคิดไปครู่หนึ่ง`,
  (name) => `${name}เหลือบมองคุณ`,
  (name) => `${name}เรียบเรียงคำพูดในใจ`,
  (name) => `${name}สูดหายใจเบาๆ`,
  (name) => `${name}กำลังจะพูดอะไรบางอย่าง`,
];
const WAITING_LINE_MS = 3500;

// "Alex (อเล็กซ์)" → "Alex": the short name reads better inside a sentence
const shortName = (name) => name.replace(/\s*\(.*\)\s*$/, '') || name;

/**
 * Bubble shown while waiting for a reply: three soft dots and a rotating line of narration about the character.
 */
function WaitingIndicator({ avatar, name }) {
  const [step, setStep] = useState(() => Math.floor(Math.random() * WAITING_LINES.length));

  useEffect(() => {
    const timer = setInterval(() => setStep((s) => s + 1), WAITING_LINE_MS);
    return () => clearInterval(timer);
  }, []);

  const line = WAITING_LINES[step % WAITING_LINES.length](shortName(name));

  return (
    <div className="flex items-start gap-2.5 animate-fadeIn">
      <img src={avatar} alt={name} className="w-8 h-8 rounded-full object-cover mt-1 border border-purple-400/20" />
      <div className="bg-slate-800/90 border border-slate-700/80 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-3 shadow-md">
        <span className="flex gap-1" aria-hidden>
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="w-1.5 h-1.5 rounded-full bg-purple-300/80 animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
        <span key={step} className="text-xs italic text-slate-400 animate-fadeIn">
          {line}...
        </span>
      </div>
    </div>
  );
}

// "+5" / "-3" next to a meter that just moved
function Delta({ now, before }) {
  if (!Number.isFinite(now) || !Number.isFinite(before) || now === before) return null;
  const up = now > before;
  return (
    <span className={`text-[10px] font-medium animate-fadeIn ${up ? 'text-emerald-300' : 'text-rose-300'}`}>
      {up ? '+' : ''}
      {now - before}
    </span>
  );
}

/**
 * How the character feels about the user right now: bond 💗, trust 🤝 (0–100) and mood, with the change
 * from the reply before.
 */
function RelationPill({ relation, previous }) {
  return (
    <div
      title="ความผูกพัน / ความไว้ใจ / อารมณ์ตอนนี้"
      className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/50 border border-white/10 backdrop-blur-md text-[11px] text-slate-300 shadow-sm"
    >
      {Number.isFinite(relation.bond) && (
        <span className="flex items-center gap-1">
          <span aria-hidden>💗</span>
          <span className="tabular-nums">{relation.bond}</span>
          <Delta now={relation.bond} before={previous?.bond} />
        </span>
      )}
      {Number.isFinite(relation.trust) && (
        <span className="flex items-center gap-1">
          <span aria-hidden>🤝</span>
          <span className="tabular-nums">{relation.trust}</span>
          <Delta now={relation.trust} before={previous?.trust} />
        </span>
      )}
      {relation.mood && (
        <>
          <span className="w-px h-3 bg-white/15" />
          <span className="max-w-[9rem] truncate">{relation.mood}</span>
        </>
      )}
    </div>
  );
}

/**
 * Suggested next replies under the last reply; tapping one puts it in the input box to send or edit.
 */
function ChoiceChips({ choices, onPick }) {
  return (
    <div className="pl-10 flex flex-wrap gap-2 animate-fadeIn" aria-label="ตัวเลือกแนะนำ">
      {choices.map((choice, i) => (
        <button
          key={i}
          onClick={() => onPick(choice)}
          className="max-w-full text-left px-3 py-1.5 rounded-2xl border border-purple-400/30 bg-purple-900/20 hover:bg-purple-800/30 text-xs text-purple-100 transition"
        >
          {choice}
        </button>
      ))}
    </div>
  );
}

const NOTICE_STYLES = {
  error: 'bg-rose-950/60 border-rose-500/40 text-rose-100',
  warn: 'bg-amber-950/50 border-amber-500/40 text-amber-100',
  info: 'bg-slate-800/80 border-slate-600/60 text-slate-200',
};

/**
 * Card above the input for a reply that went wrong: friendly title and hint, optional retry,
 * and the technical reason folded away for when it's needed.
 */
function NoticeCard({ notice, onRetry, onDismiss }) {
  return (
    <div
      role="alert"
      className={`mx-3 md:mx-4 mb-2 px-3.5 py-3 rounded-2xl border backdrop-blur-md shadow-lg flex items-start gap-3 animate-fadeIn ${
        NOTICE_STYLES[notice.kind] || NOTICE_STYLES.info
      }`}
    >
      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 opacity-80" />
      <div className="flex-1 min-w-0 space-y-1">
        {notice.title && <div className="text-sm font-medium">{notice.title}</div>}
        <div className="text-xs opacity-85 leading-relaxed">{notice.text}</div>
        {notice.detail && (
          <details className="text-[11px] opacity-60">
            <summary className="cursor-pointer select-none">รายละเอียด</summary>
            <div className="mt-1 break-words">{notice.detail}</div>
          </details>
        )}
        {notice.retry && (
          <button
            onClick={onRetry}
            className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            ลองส่งอีกครั้ง
          </button>
        )}
      </div>
      <button onClick={onDismiss} title="ปิด" className="opacity-60 hover:opacity-100 transition">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/**
 * Main chat container component handling message flow, active persona info, and input controls.
 */
export default function ChatWindow({
  selectedChar,
  onBack,
  messages,
  loading,
  input,
  setInput,
  onSendMessage,
  onClearHistory,
  hasUserRole,
  onOpenUserRole,
  onStopReply,
  onRegenerate,
  onSwipe,
  onSaveMoment,
  onDismissMoment,
  onUndoMoment,
  chatStyle,
  onToggleChatStyle,
  showRelation,
  showChoices,
  onPickChoice,
  onRetry,
  onOpenMemory,
  direction,
  setDirection,
  notice,
  onDismissNotice,
  onEditMessage,
  onDeleteMessage,
}) {
  const chatEndRef = useRef(null);
  const scene = latestScene(messages);
  // Relationship now, and before the latest reply that changed it (for the +/- shown next to it)
  const shownRelation = showRelation ? latestRelation(messages) : null;
  const lastRelationAt = messages.findLastIndex((m) => m.relation);
  const previousRelation = lastRelationAt > 0 ? latestRelation(messages.slice(0, lastRelationAt)) : null;
  const lastMessage = messages[messages.length - 1];
  const choices =
    showChoices && !loading && lastMessage?.role === 'model' && lastMessage.choices?.length ? lastMessage.choices : null;
  const backgroundSrc =
    (!selectedChar.fixedBackground && sceneBackgroundSrc(scene?.background)) || selectedChar.background;

  // Auto-scroll to latest message or indicator
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <main className="flex-1 flex flex-col bg-slate-900/95 relative overflow-hidden isolate">
      {/* Blurred scene backdrop; negative z keeps it under the messages, the overlay keeps text readable */}
      {backgroundSrc && (
        <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <img
            key={backgroundSrc}
            src={backgroundSrc}
            alt=""
            className="w-full h-full object-cover scale-110 blur-md animate-fadeIn"
          />
          <div className="absolute inset-0 bg-slate-950/70" />
        </div>
      )}

      {/* Chat Header */}
      <header className="p-3.5 md:p-4 bg-slate-800/70 backdrop-blur-md border-b border-slate-700/80 flex items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 transition"
            title="กลับไปหน้าหลัก"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <img
            src={selectedChar.avatar}
            alt={selectedChar.name}
            className="w-10 h-10 rounded-full object-cover border border-purple-400/40 shadow-sm flex-shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="font-semibold text-sm md:text-base text-slate-100 truncate">{selectedChar.name}</h2>
              {selectedChar.category && (
                <span className="hidden min-[400px]:inline text-[10px] px-2 py-0.5 rounded-full bg-purple-900/40 flex-shrink-0 whitespace-nowrap text-purple-300 border border-purple-500/30">
                  {selectedChar.category}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 truncate sm:max-w-md">
              {selectedChar.tagline || selectedChar.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
        <button
          onClick={onOpenUserRole}
          title="บทบาทของฉันกับตัวละครนี้"
          className={`p-1.5 sm:p-2 rounded-lg transition flex items-center gap-1.5 text-xs ${
            hasUserRole
              ? 'bg-purple-900/40 text-purple-300 border border-purple-500/40'
              : 'hover:bg-slate-700/60 text-slate-400 hover:text-purple-300'
          }`}
        >
          <UserCog className="w-5 h-5" />
          <span className="hidden sm:inline">บทบาทของฉัน</span>
        </button>
        <button
          onClick={onOpenMemory}
          title="ความทรงจำของตัวละคร"
          className="p-1.5 sm:p-2 rounded-lg transition flex items-center gap-1.5 text-xs hover:bg-slate-700/60 text-slate-400 hover:text-purple-300"
        >
          <Brain className="w-5 h-5" />
          <span className="hidden sm:inline">ความทรงจำ</span>
        </button>
        <button
          onClick={onClearHistory}
          title="ล้างประวัติการสนทนา"
          className="p-1.5 sm:p-2 hover:bg-slate-700/60 rounded-lg text-slate-400 hover:text-red-400 transition"
        >
          <Trash2 className="w-5 h-5" />
        </button>
        </div>
      </header>

      {/* Scene bar: current in-story location/time (and relationship), reported by the model after each reply */}
      {(scene || shownRelation) && (
        <div className="flex flex-wrap justify-center gap-1.5 pt-3 px-4 z-10">
          {scene && (
            <div className="flex items-center gap-2.5 px-3.5 py-1 rounded-full bg-slate-900/50 border border-white/10 backdrop-blur-md text-[11px] text-slate-300 shadow-sm">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-violet-300/80" />
                {scene.time}
              </span>
              <span className="w-px h-3 bg-white/15" />
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-violet-300/80" />
                {scene.location}
              </span>
            </div>
          )}
          {shownRelation && <RelationPill relation={shownRelation} previous={previousRelation} />}
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <ChatMessage
            key={idx}
            message={msg}
            avatar={selectedChar.avatar}
            characterName={selectedChar.name}
            disabled={loading}
            canRegenerate={
              idx === messages.length - 1 && msg.role === 'model' && messages.some((m) => m.role === 'user')
            }
            onRegenerate={onRegenerate}
            onSwipe={onSwipe}
            onSaveMoment={(title) => onSaveMoment(idx, title)}
            onDismissMoment={() => onDismissMoment(idx)}
            onUndoMoment={() => onUndoMoment(idx)}
            canRetry={idx === messages.length - 1 && msg.role === 'user' && !loading}
            onRetry={onRetry}
            onEdit={(text) => onEditMessage(idx, text)}
            onDelete={() => onDeleteMessage(idx)}
          />
        ))}

        {loading && messages[messages.length - 1]?.role === 'user' && (
          <WaitingIndicator avatar={selectedChar.avatar} name={selectedChar.name} />
        )}
        {choices && <ChoiceChips choices={choices} onPick={onPickChoice} />}
        <div ref={chatEndRef} />
      </div>

      {notice && <NoticeCard notice={notice} onRetry={onRetry} onDismiss={onDismissNotice} />}

      {/* Message Input Controls */}
      <ChatInput
        input={input}
        setInput={setInput}
        onSendMessage={onSendMessage}
        onStop={onStopReply}
        loading={loading}
        characterName={selectedChar.name}
        direction={direction}
        setDirection={setDirection}
        chatStyle={chatStyle}
        onToggleChatStyle={onToggleChatStyle}
      />
    </main>
  );
}
