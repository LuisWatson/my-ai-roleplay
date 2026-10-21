'use client';

import React, { useState } from 'react';
import { Pencil, Trash2, RefreshCw, Check, X } from 'lucide-react';
import { parseRoleplayText } from '../lib/roleplayFormat';

const PARAGRAPH_CLASS = {
  model: { speech: 'font-semibold text-white', narration: 'text-slate-400' },
  user: { speech: 'font-semibold text-white', narration: 'text-violet-200/70' },
};

/**
 * Render novel-style text: each spoken line bold, narration and *actions* muted, one paragraph each.
 * @param {string} text - Raw message string
 * @param {'model'|'user'} role
 * @returns {React.ReactNode} Formatted elements
 */
export function formatRoleplayText(text, role = 'model') {
  const styles = PARAGRAPH_CLASS[role] || PARAGRAPH_CLASS.model;
  return (
    <div className="space-y-2.5">
      {parseRoleplayText(text).map((para, idx) => (
        <p key={idx} className={styles[para.type]}>
          {para.text}
        </p>
      ))}
    </div>
  );
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
  canRetry,
  onRetry,
  onEdit,
  onDelete,
}) {
  const isUser = message.role === 'user';
  const hasText = message.text && message.text.length > 0;
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');

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

  return (
    <div className={`group flex items-start gap-2.5 transition-all ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <img
          src={avatar}
          alt={characterName || 'Character Avatar'}
          className="w-8 h-8 rounded-full object-cover mt-1 border border-purple-400/30 flex-shrink-0 shadow-sm"
        />
      )}

      <div className={`flex flex-col gap-1 max-w-[85%] ${isUser ? 'md:max-w-[70%] items-end' : 'md:max-w-[80%] items-start'}`}>
      <div
        className={`w-full p-3.5 rounded-2xl text-sm leading-relaxed transition-all shadow-md ${
          isUser
            ? 'bg-violet-500/15 border border-violet-300/25 text-violet-50 rounded-tr-none backdrop-blur-sm'
            : 'bg-slate-800/90 border border-slate-700/80 text-slate-100 rounded-tl-none backdrop-blur-sm'
        }`}
      >
        {isEditing ? (
          <div className="space-y-2 min-w-[220px]">
            <textarea
              autoFocus
              rows={4}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-600 rounded-lg p-2 text-sm text-slate-100 focus:outline-none focus:border-purple-500 resize-y"
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
          formatRoleplayText(message.text, message.role)
        ) : (
          <span className="inline-flex items-center gap-1.5 py-1 px-1">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" />
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce [animation-delay:0.2s]" />
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce [animation-delay:0.4s]" />
          </span>
        )}
      </div>

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

      {hasText && !isEditing && !disabled && (
        <div className="flex gap-0.5 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {canRegenerate && (
            <button onClick={onRegenerate} title="สร้างคำตอบใหม่" className={actionClass}>
              <RefreshCw className="w-3.5 h-3.5" />
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
    </div>
  );
}
