'use client';

import React, { useRef, useEffect, useState } from 'react';
import { ArrowLeft, Trash2, UserCog, X, MapPin, AlertCircle, RotateCcw, Brain, PanelLeftOpen } from 'lucide-react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { latestScene } from '../lib/scene';
import { latestRelation, levelOf, levelName } from '../lib/relation';
import { sceneBackgroundFor } from '../constants/sceneBackgrounds';
import OpeningCard from './OpeningCard';
import { PortraitLightbox, MoodCard } from './PortraitView';
import { openingOf } from '../lib/story';
import { pictureFor, moodChanges } from '../lib/expressions';

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
      <span className="w-11 h-11 mt-1 flex-shrink-0 rounded-full overflow-hidden border border-purple-400/20">
        <img src={avatar} alt={name} className="w-full h-full object-cover object-top scale-125 origin-[50%_20%]" />
      </span>
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

const METERS = [
  ['bond', '💗', 'ผูกพัน', 'bg-pink-400'],
  ['trust', '🤝', 'ไว้ใจ', 'bg-sky-400'],
];

/**
 * The character's current feelings, shown in the header under their name instead of the tagline:
 * bond 💗 and trust 🤝 as levels with progress to the next one (lib/relation.js), and mood.
 */
function RelationLine({ relation }) {
  return (
    <p className="flex items-center gap-2.5 text-xs text-slate-300 min-w-0">
      {METERS.map(([key, icon, label, bar]) => {
        if (!Number.isFinite(relation[key])) return null;
        const { level, into, size } = levelOf(relation[key]);
        return (
          <span
            key={key}
            title={`${label} Lv.${level} · ${levelName(key, level)} (${into}/${size} ไปเลเวลถัดไป)`}
            className="flex items-center gap-1 flex-shrink-0"
          >
            <span aria-hidden>{icon}</span>
            <span className="tabular-nums">Lv.{level}</span>
            <span className="w-7 h-1 rounded-full bg-slate-600/70 overflow-hidden" aria-hidden>
              <span className={`block h-full ${bar}`} style={{ width: `${Math.round((into / size) * 100)}%` }} />
            </span>
          </span>
        );
      })}
      {relation.mood && <span className="truncate text-slate-400">· {relation.mood}</span>}
    </p>
  );
}

// For each message, how its reply moved the meters: { bond, trust } point differences plus `levelUp`
// { bond: newLevel } when a meter reached a new level; null when nothing changed
function relationChanges(messages) {
  let previous = null;
  return messages.map((m) => {
    if (!m.relation) return null;
    const change = {};
    for (const [key] of METERS) {
      const now = m.relation[key];
      const before = previous?.[key];
      if (Number.isFinite(now) && Number.isFinite(before) && now !== before) {
        change[key] = now - before;
        const level = levelOf(now).level;
        if (level > levelOf(before).level) change.levelUp = { ...change.levelUp, [key]: level };
      }
    }
    previous = m.relation;
    return Object.keys(change).length > 0 ? change : null;
  });
}

// Two locations count as the same place when one contains the other, ignoring spaces
// ("ร้านกาแฟ" and "ร้านกาแฟ มุมหน้าต่าง"), so small rewordings by the model don't add a divider
function samePlace(a, b) {
  const x = (a || '').replace(/\s+/g, '');
  const y = (b || '').replace(/\s+/g, '');
  return Boolean(x && y) && (x.includes(y) || y.includes(x));
}

// For each message, the scene to announce above it: the first scene of the chat, and every reply that
// reports a different place than the scene before it; null otherwise
function sceneDividers(messages) {
  let previous = null;
  return messages.map((m) => {
    if (!m.scene?.location) return null;
    const changed = !previous || !samePlace(previous.location, m.scene.location);
    previous = m.scene;
    return changed ? m.scene : null;
  });
}

/**
 * A thin line between messages where the story moves to a new place, with the place (the story text tells the time).
 */
function SceneDivider({ scene }) {
  return (
    <div className="flex items-center gap-3 py-1 text-[11px] text-slate-400" aria-label="เปลี่ยนฉาก">
      <span className="flex-1 h-px bg-white/10" />
      <span className="flex items-center gap-1 min-w-0 px-3 py-1 rounded-full bg-slate-900/60 border border-white/10 backdrop-blur-md">
        <MapPin className="w-3 h-3 flex-shrink-0 text-violet-300/80" />
        <span className="truncate">{scene.location}</span>
      </span>
      <span className="flex-1 h-px bg-white/10" />
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
  waiting,
  input,
  setInput,
  onSendMessage,
  onContinue,
  onSuggest,
  suggesting,
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
  onOpenExport,
  direction,
  setDirection,
  notice,
  onDismissNotice,
  onEditMessage,
  onDeleteMessage,
  onExpandSidebar,
}) {
  const scene = latestScene(messages);
  const [zoomSrc, setZoomSrc] = useState(null); // the picture open at full size, or null
  useEffect(() => setZoomSrc(null), [selectedChar.id]);
  const lastThought = [...messages].reverse().find((m) => m.thought)?.thought;
  const picture = pictureFor(selectedChar, lastThought);
  // Where her expression changes, a small picture at the end of that reply, above her thought
  const moodCards = moodChanges(messages, selectedChar);
  // Relationship now, and before the latest reply that changed it (for the +/- shown next to it)
  const shownRelation = showRelation ? latestRelation(messages) : null;
  const changes = showRelation ? relationChanges(messages) : [];
  const dividers = sceneDividers(messages);
  // A chat that began with the story setup shows the opening card in place of its first divider
  const opening = messages[0]?.storyStart ? openingOf(selectedChar) : null;
  const lastMessage = messages[messages.length - 1];
  const choices =
    (showChoices || lastMessage?.choicesAsked) && !loading && lastMessage?.role === 'model' && lastMessage.choices?.length
      ? lastMessage.choices
      : null;
  const backgroundSrc = sceneBackgroundFor(selectedChar, scene?.background) || selectedChar.background;

  // Follow new text only while the reader is at the bottom: scrolling up to reread stays put, even while a
  // reply streams in. Sending a message or opening a chat always goes to the bottom.
  const scrollRef = useRef(null);
  const atBottomRef = useRef(true);
  const lengthRef = useRef(0);
  const jumpRef = useRef(true); // a chat just opened: go straight to the end instead of animating through it
  const handleScroll = () => {
    const el = scrollRef.current;
    if (el) atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  useEffect(() => {
    atBottomRef.current = true;
    jumpRef.current = true;
  }, [selectedChar.id]);

  useEffect(() => {
    if (messages.length > lengthRef.current && lastMessage?.role === 'user') atBottomRef.current = true;
    lengthRef.current = messages.length;
  }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !atBottomRef.current) return;
    // A chat that is only its opening scene starts at the top, so it reads from the opening card down
    if (jumpRef.current && messages.length === 1) {
      el.scrollTo({ top: 0 });
      jumpRef.current = false;
      return;
    }
    el.scrollTo({ top: el.scrollHeight, behavior: loading || jumpRef.current ? 'auto' : 'smooth' });
    jumpRef.current = false;
  }, [messages, loading, waiting, suggesting, notice]);

  return (
    <div className="flex-1 flex min-w-0 overflow-hidden">
    <main className="flex-1 min-w-0 flex flex-col bg-slate-900/95 relative overflow-hidden isolate">
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
      <header className="relative px-3 py-2.5 md:p-4 border-b border-slate-700/80 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 z-10">
        {/* The frosted glass sits on its own layer: on iPhone Safari a backdrop-filter blurs the pictures inside it */}
        <div aria-hidden className="absolute inset-0 -z-10 bg-slate-800/70 backdrop-blur-md" />
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {onExpandSidebar && (
            <button
              onClick={onExpandSidebar}
              title="แสดงแถบด้านซ้าย"
              aria-label="แสดงแถบด้านซ้าย"
              className="hidden md:inline-flex p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 transition"
            >
              <PanelLeftOpen className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 transition"
            title="กลับไปหน้าหลัก"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setZoomSrc(picture.src)}
            title="ดูรูปเต็ม"
            aria-label={`ดูรูปของ ${selectedChar.name}`}
            className="flex-shrink-0 rounded-full"
          >
            <img
              src={picture.src}
              alt={selectedChar.name}
              className="w-12 h-12 md:w-10 md:h-10 rounded-full object-cover object-top border border-purple-400/40 shadow-sm"
            />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="font-semibold text-sm md:text-base text-slate-100 truncate">{selectedChar.name}</h2>
              {selectedChar.category && (
                <span className="hidden lg:inline text-[10px] px-2 py-0.5 rounded-full bg-purple-900/40 flex-shrink-0 whitespace-nowrap text-purple-300 border border-purple-500/30">
                  {selectedChar.category}
                </span>
              )}
            </div>
            {shownRelation ? (
              <div className="hidden md:block">
                <RelationLine relation={shownRelation} />
              </div>
            ) : (
              <p className="text-xs text-slate-400 truncate sm:max-w-md">
                {selectedChar.tagline || selectedChar.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onOpenUserRole}
          title="บทบาทของฉันกับตัวละครนี้"
          className={`hidden sm:flex sm:p-2 rounded-lg transition items-center gap-1.5 text-xs ${
            hasUserRole
              ? 'bg-purple-900/40 text-purple-300 border border-purple-500/40'
              : 'hover:bg-slate-700/60 text-slate-400 hover:text-purple-300'
          }`}
        >
          <UserCog className="w-5 h-5" />
          <span className="hidden lg:inline">บทบาทของฉัน</span>
        </button>
        <button
          onClick={onOpenMemory}
          title="ความทรงจำของตัวละคร"
          className="hidden sm:flex sm:p-2 rounded-lg transition items-center gap-1.5 text-xs hover:bg-slate-700/60 text-slate-400 hover:text-purple-300"
        >
          <Brain className="w-5 h-5" />
          <span className="hidden lg:inline">ความทรงจำ</span>
        </button>
        <button
          onClick={onClearHistory}
          title="ล้างประวัติการสนทนา"
          className="w-9 h-9 flex items-center justify-center sm:w-auto sm:h-auto sm:p-2 hover:bg-slate-700/60 rounded-lg text-slate-400 hover:text-red-400 transition"
        >
          <Trash2 className="w-5 h-5" />
        </button>
        </div>

        {shownRelation && (
          <div className="basis-full md:hidden flex justify-center pt-1.5 border-t border-white/5">
            <RelationLine relation={shownRelation} />
          </div>
        )}
      </header>

      {/* Scene bar: current in-story place, reported by the model after each reply. The time is not shown:
          it often disagreed with the time the story text gave, so the story itself tells the time */}
      {scene?.location && (
        <div className="flex justify-center pt-3 px-4 z-10">
          <div className="flex items-center gap-1.5 max-w-full px-3.5 py-1 rounded-full bg-slate-900/50 border border-white/10 backdrop-blur-md text-[11px] text-slate-300 shadow-sm">
            <MapPin className="w-3 h-3 flex-shrink-0 text-violet-300/80" />
            <span className="truncate">{scene.location}</span>
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto overflow-x-hidden overscroll-x-none p-4 space-y-4 [overflow-wrap:anywhere]">
        {messages.map((msg, idx) => (
          <React.Fragment key={idx}>
          {idx === 0 && opening ? (
            <OpeningCard opening={opening} className="max-w-md mx-auto" />
          ) : (
            dividers[idx] && <SceneDivider scene={dividers[idx]} />
          )}
          <ChatMessage
            message={msg}
            moodCard={
              moodCards[idx] && (
                <MoodCard character={selectedChar} card={moodCards[idx]} onZoom={setZoomSrc} />
              )
            }
            avatar={msg.role === 'model' ? pictureFor(selectedChar, msg.thought).src : selectedChar.avatar}
            characterName={selectedChar.name}
            cast={selectedChar.cast}
            disabled={loading}
            canRegenerate={
              idx === messages.length - 1 && msg.role === 'model' && messages.some((m) => m.role === 'user')
            }
            onRegenerate={onRegenerate}
            onSwipe={onSwipe}
            onSaveMoment={(title) => onSaveMoment(idx, title)}
            onDismissMoment={() => onDismissMoment(idx)}
            onUndoMoment={() => onUndoMoment(idx)}
            relationChange={changes[idx]}
            canRetry={idx === messages.length - 1 && msg.role === 'user' && !loading}
            onRetry={onRetry}
            onEdit={(text) => onEditMessage(idx, text)}
            onDelete={() => onDeleteMessage(idx)}
          />
          </React.Fragment>
        ))}

        {waiting && (
          <WaitingIndicator avatar={selectedChar.avatar} name={selectedChar.name} />
        )}
        {suggesting ? (
          <p className="pl-10 text-xs text-purple-200/70 animate-pulse">💡 กำลังคิดคำตอบให้เลือก...</p>
        ) : (
          choices && <ChoiceChips choices={choices} onPick={onPickChoice} />
        )}
      </div>

      {notice && <NoticeCard notice={notice} onRetry={onRetry} onDismiss={onDismissNotice} />}

      {/* Message Input Controls */}
      <ChatInput
        input={input}
        setInput={setInput}
        onSendMessage={onSendMessage}
        onContinue={onContinue}
        onSuggest={lastMessage?.role === 'model' && !suggesting ? onSuggest : undefined}
        onOpenMemory={onOpenMemory}
        onOpenUserRole={onOpenUserRole}
        onOpenExport={onOpenExport}
        onStop={onStopReply}
        loading={loading}
        characterName={selectedChar.name}
        direction={direction}
        setDirection={setDirection}
        chatStyle={chatStyle}
        onToggleChatStyle={onToggleChatStyle}
      />
    </main>
    {zoomSrc && <PortraitLightbox src={zoomSrc} name={selectedChar.name} onClose={() => setZoomSrc(null)} />}
    </div>
  );
}
