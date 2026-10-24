'use client';

import React, { useState } from 'react';
import { Pencil, Trash2, RefreshCw, Check, X, ChevronLeft, ChevronRight, BookmarkPlus, BookHeart, Sparkles } from 'lucide-react';
import { parseRoleplayText } from '../lib/roleplayFormat';

const PARAGRAPH_CLASS = {
  model: { speech: 'font-semibold text-white', narration: 'text-slate-400' },
  user: { speech: 'font-semibold text-white', narration: 'text-violet-200/70' },
};

// Other people in the scene: each speaker always gets the same colour (by name), label + speech
const SPEAKER_STYLES = [
  { label: 'text-amber-300', speech: 'text-amber-100', bar: 'border-amber-400/60' },
  { label: 'text-sky-300', speech: 'text-sky-100', bar: 'border-sky-400/60' },
  { label: 'text-emerald-300', speech: 'text-emerald-100', bar: 'border-emerald-400/60' },
  { label: 'text-pink-300', speech: 'text-pink-100', bar: 'border-pink-400/60' },
  { label: 'text-orange-300', speech: 'text-orange-100', bar: 'border-orange-400/60' },
  { label: 'text-lime-300', speech: 'text-lime-100', bar: 'border-lime-400/60' },
];

function speakerStyle(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return SPEAKER_STYLES[h % SPEAKER_STYLES.length];
}

// "เอวา (Ava)" → also matches a label written as "เอวา" or "Ava"
function isMainCharacter(speaker, characterName) {
  if (!characterName) return false;
  const names = [characterName, ...characterName.split(/[()]/)].map((n) => n.trim()).filter(Boolean);
  return names.includes(speaker.trim());
}

/**
 * Render novel-style text: each spoken line bold, narration and *actions* muted, one paragraph each.
 * Speech by someone other than the main character (a "name:" line) gets that person's name and colour.
 * @param {string} text - Raw message string
 * @param {'model'|'user'} role
 * @param {string} [characterName] - the chat's character, whose own lines need no label
 * @returns {React.ReactNode} Formatted elements
 */
export function formatRoleplayText(text, role = 'model', characterName) {
  const styles = PARAGRAPH_CLASS[role] || PARAGRAPH_CLASS.model;
  return (
    <div className="space-y-2.5">
      {parseRoleplayText(text).map((para, idx) => {
        if (para.speaker && !isMainCharacter(para.speaker, characterName)) {
          const style = speakerStyle(para.speaker);
          return (
            <div key={idx} className={`border-l-2 pl-2.5 ${style.bar}`}>
              <div className={`text-[11px] font-medium ${style.label}`}>{para.speaker}</div>
              <p className={`font-semibold ${style.speech}`}>{para.text}</p>
            </div>
          );
        }
        return (
          <p key={idx} className={styles[para.type]}>
            {para.text}
          </p>
        );
      })}
    </div>
  );
}

/**
 * A character's novel-style reply laid out like a story: narration as plain text on the backdrop,
 * each spoken line in its own bubble (other people's lines get their name and colour).
 */
export function formatStoryText(text, characterName) {
  return (
    <div className="space-y-2.5">
      {parseRoleplayText(text).map((para, idx) => {
        if (para.type === 'narration') {
          return (
            <p key={idx} className="px-1 text-slate-300 [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]">
              {para.text}
            </p>
          );
        }
        if (para.speaker && !isMainCharacter(para.speaker, characterName)) {
          const style = speakerStyle(para.speaker);
          return (
            <div key={idx} className="w-fit max-w-full space-y-1">
              <div className={`px-1 text-[11px] font-medium ${style.label}`}>{para.speaker}</div>
              <p
                className={`px-3.5 py-2.5 rounded-2xl rounded-tl-none bg-slate-800/90 border-l-2 ${style.bar} font-medium ${style.speech} shadow-md backdrop-blur-sm`}
              >
                {para.text}
              </p>
            </div>
          );
        }
        return (
          <p
            key={idx}
            className="w-fit max-w-full px-3.5 py-2.5 rounded-2xl rounded-tl-none bg-slate-800/90 border border-slate-700/80 font-medium text-white shadow-md backdrop-blur-sm"
          >
            {para.text}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Render a short-chat ("DM" mode) message: plain chat lines, with *what they did* muted and italic.
 */
function formatChatText(text) {
  return (
    <div className="space-y-1">
      {text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, idx) =>
          /^\*.*\*$/.test(line) ? (
            <p key={idx} className="italic text-slate-400">
              {line.slice(1, -1)}
            </p>
          ) : (
            <p key={idx} className="text-slate-100">
              {line}
            </p>
          )
        )}
    </div>
  );
}

/**
 * Under a reply with a moment: "pending" offers to save it to the memory journal, "saved" confirms with an
 * undo. Nothing for "dismissed".
 */
function MomentCard({ moment, disabled, onSave, onDismiss, onUndo }) {
  if (moment.state === 'pending') {
    return (
      <div className="w-full rounded-2xl border border-amber-400/30 bg-amber-500/10 px-3.5 py-3 space-y-2 animate-fadeIn">
        <div className="flex items-start gap-2 text-sm text-amber-100">
          <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-300" />
          <span>
            <span className="text-amber-300/90">ช่วงเวลาสำคัญ:</span> {moment.title}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onSave()}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 text-xs font-medium transition disabled:opacity-40"
          >
            <BookHeart className="w-3.5 h-3.5" />
            บันทึกไว้
          </button>
          <button
            onClick={onDismiss}
            disabled={disabled}
            className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 text-xs transition disabled:opacity-40"
          >
            ไม่เป็นไร
          </button>
        </div>
      </div>
    );
  }
  if (moment.state === 'saved') {
    return (
      <div className="flex items-center gap-1.5 px-1 text-[11px] text-amber-200/80 animate-fadeIn">
        <BookHeart className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">บันทึกในสมุดความทรงจำแล้ว · {moment.title}</span>
        <button onClick={onUndo} disabled={disabled} className="underline hover:text-amber-100 flex-shrink-0 disabled:opacity-40">
          เลิกทำ
        </button>
      </div>
    );
  }
  return null;
}

/**
 * Renders an individual chat message item with support for active streaming states.
 */
export default function ChatMessage({
  message,
  avatar,
  characterName,
  disabled,
  canRegenerate,
  onRegenerate,
  onSwipe,
  onSaveMoment,
  onDismissMoment,
  onUndoMoment,
  relationChange,
  canRetry,
  onRetry,
  onEdit,
  onDelete,
  moodCard,
}) {
  const isUser = message.role === 'user';
  const hasText = message.text && message.text.length > 0;
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [momentDraft, setMomentDraft] = useState(null); // title being typed when saving by hand

  const saveMomentDraft = () => {
    if (!momentDraft?.trim()) return;
    onSaveMoment(momentDraft);
    setMomentDraft(null);
  };

  const startEdit = () => {
    setDraft(message.text);
    setIsEditing(true);
  };

  const saveEdit = () => {
    if (draft.trim()) {
      onEdit(draft);
      setIsEditing(false);
    }
  };

  const actionClass = 'p-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-700/60 transition';
  // A character's novel-style reply has no outer bubble: narration sits on the backdrop, speech gets bubbles
  const storyLayout = !isUser && hasText && !isEditing && message.style !== 'dm';

  return (
    <div className={`group flex items-start gap-2.5 transition-all ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <img
          src={avatar}
          alt={characterName || 'Character Avatar'}
          className="w-8 h-8 rounded-full object-cover object-top mt-1 border border-purple-400/30 flex-shrink-0 shadow-sm"
        />
      )}

      <div className={`flex flex-col gap-1 max-w-[85%] ${isUser ? 'md:max-w-[70%] items-end' : 'md:max-w-[80%] items-start'}`}>
      <div
        className={`w-full text-base leading-relaxed transition-all ${
          storyLayout
            ? 'pt-1'
            : isUser
            ? 'p-3.5 rounded-2xl shadow-md bg-violet-500/15 border border-violet-300/25 text-violet-50 rounded-tr-none backdrop-blur-sm'
            : 'p-3.5 rounded-2xl shadow-md bg-slate-800/90 border border-slate-700/80 text-slate-100 rounded-tl-none backdrop-blur-sm'
        }`}
      >
        {isEditing ? (
          <div className="space-y-2 min-w-[220px]">
            <textarea
              autoFocus
              rows={4}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-600 rounded-lg p-2 text-base text-slate-100 focus:outline-none focus:border-purple-500 resize-y"
            />
            <div className="flex justify-end gap-1.5">
              <button onClick={() => setIsEditing(false)} title="ยกเลิก" className={actionClass}>
                <X className="w-4 h-4" />
              </button>
              <button onClick={saveEdit} title="บันทึก" className={`${actionClass} text-purple-300`}>
                <Check className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : hasText ? (
          message.style === 'dm'
            ? formatChatText(message.text)
            : storyLayout
              ? formatStoryText(message.text, characterName)
              : formatRoleplayText(message.text, message.role, characterName)
        ) : (
          <span className="inline-flex items-center gap-1.5 py-1 px-1">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" />
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce [animation-delay:0.2s]" />
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce [animation-delay:0.4s]" />
          </span>
        )}
      </div>

      {/* Her face as she thinks it: the picture for a changed expression sits right above the thought pill */}
      {moodCard && !isEditing && moodCard}

      {message.thought && !isEditing && (
        <div
          className="max-w-full inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/70 border border-white/10 backdrop-blur-md text-xs text-slate-300 animate-fadeIn"
          aria-label="ความคิดของตัวละคร"
        >
          <span className="text-violet-300/90 flex-shrink-0">ความคิด</span>
          <span className="text-slate-200">{message.thought}</span>
        </div>
      )}

      {relationChange && !isEditing && (
        <div className="flex items-center gap-2.5 px-1 text-[11px] font-medium animate-fadeIn" aria-label="ความสัมพันธ์ที่เปลี่ยนไป">
          {[
            ['bond', '💗'],
            ['trust', '🤝'],
          ].map(
            ([key, icon]) =>
              relationChange[key] !== undefined && (
                <span key={key} className={relationChange[key] > 0 ? 'text-emerald-300' : 'text-rose-300'}>
                  {icon} {relationChange[key] > 0 ? '+' : ''}
                  {relationChange[key]}
                  {relationChange.levelUp?.[key] && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30">
                      ขึ้น Lv.{relationChange.levelUp[key]}
                    </span>
                  )}
                </span>
              )
          )}
        </div>
      )}

      {message.moment && !isEditing && (
        <MomentCard
          moment={message.moment}
          disabled={disabled}
          onSave={() => onSaveMoment()}
          onDismiss={onDismissMoment}
          onUndo={onUndoMoment}
        />
      )}

      {momentDraft !== null && (
        <div className="w-full flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-slate-900/80 px-2.5 py-1.5 animate-fadeIn">
          <BookHeart className="w-4 h-4 text-amber-300 flex-shrink-0" />
          <input
            autoFocus
            value={momentDraft}
            onChange={(e) => setMomentDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) saveMomentDraft();
              if (e.key === 'Escape') setMomentDraft(null);
            }}
            maxLength={120}
            placeholder="ตั้งชื่อช่วงเวลานี้ เช่น เดตแรกที่ทะเล"
            className="flex-1 min-w-0 bg-transparent border-0 py-1 text-base md:text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <button onClick={() => setMomentDraft(null)} title="ยกเลิก" className={actionClass}>
            <X className="w-4 h-4" />
          </button>
          <button onClick={saveMomentDraft} title="บันทึกลงสมุดความทรงจำ" className={`${actionClass} text-amber-300`}>
            <Check className="w-4 h-4" />
          </button>
        </div>
      )}

      {canRetry && !isEditing && (
        <button
          onClick={onRetry}
          title="ส่งข้อความนี้อีกครั้ง"
          className="flex items-center gap-1 text-[11px] text-amber-300 hover:text-amber-200 px-1"
        >
          <RefreshCw className="w-3 h-3" />
          <span>ยังไม่ได้รับคำตอบ ลองใหม่</span>
        </button>
      )}

      {hasText && !isEditing && (canRegenerate || !disabled) && (
        <div className="flex items-center gap-0.5">
          {canRegenerate && message.alts?.length > 1 && (
            <div className="flex items-center gap-0.5 mr-1 text-[11px] text-slate-400" aria-label="เลือกคำตอบ">
              <button
                onClick={() => onSwipe(-1)}
                disabled={disabled || message.altIndex === 0}
                title="คำตอบก่อนหน้า"
                className={`${actionClass} disabled:opacity-30 disabled:pointer-events-none`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="tabular-nums min-w-[2.5rem] text-center">
                {message.altIndex + 1} / {message.alts.length}
              </span>
              <button
                onClick={() => onSwipe(1)}
                disabled={disabled || message.altIndex === message.alts.length - 1}
                title="คำตอบถัดไป"
                className={`${actionClass} disabled:opacity-30 disabled:pointer-events-none`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
          {!disabled && (
            <div className="flex gap-0.5 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              {canRegenerate && (
                <button onClick={onRegenerate} title="สร้างคำตอบใหม่" className={actionClass}>
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
              {message.moment?.state !== 'saved' && (
                <button
                  onClick={() => setMomentDraft(message.moment?.title || '')}
                  title="บันทึกช่วงเวลานี้ลงสมุดความทรงจำ"
                  className={actionClass}
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={startEdit} title="แก้ไขข้อความ" className={actionClass}>
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={onDelete} title="ลบข้อความ" className={`${actionClass} hover:text-red-400`}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
