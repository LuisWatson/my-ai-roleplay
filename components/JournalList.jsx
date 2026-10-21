'use client';

import React, { useState } from 'react';
import { BookHeart, MapPin, Clock, Pencil, Trash2, Check, X } from 'lucide-react';
import { sceneBackgroundSrc } from '../constants/sceneBackgrounds';

const DATE_FORMAT = { day: 'numeric', month: 'short', year: 'numeric' };

function JournalCard({ entry, fallbackBackground, onRename, onDelete }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null); // title being edited
  const background = sceneBackgroundSrc(entry.background) || fallbackBackground;

  const saveTitle = () => {
    if (draft?.trim()) onRename(entry.id, draft);
    setDraft(null);
  };

  return (
    <li className="relative overflow-hidden rounded-2xl border border-white/10 shadow-md">
      {background && (
        <img src={background} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/75 to-slate-950/40" />

      <div className="relative p-3.5 space-y-1.5">
        <div className="flex items-start gap-2">
          <BookHeart className="w-4 h-4 mt-0.5 text-amber-300 flex-shrink-0" />
          {draft === null ? (
            <h3 className="flex-1 text-sm font-semibold text-white leading-snug">{entry.title}</h3>
          ) : (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) saveTitle();
                if (e.key === 'Escape') setDraft(null);
              }}
              maxLength={120}
              className="flex-1 min-w-0 bg-slate-900/80 border border-slate-600 rounded-lg px-2 py-1 text-base md:text-sm text-white focus:outline-none focus:border-amber-400"
            />
          )}
          <div className="flex gap-0.5 flex-shrink-0">
            {draft === null ? (
              <>
                <button onClick={() => setDraft(entry.title)} title="แก้ชื่อ" className="p-1 rounded-md text-slate-400 hover:text-white transition">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onDelete(entry)} title="ลบความทรงจำนี้" className="p-1 rounded-md text-slate-400 hover:text-red-400 transition">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setDraft(null)} title="ยกเลิก" className="p-1 rounded-md text-slate-400 hover:text-white transition">
                  <X className="w-4 h-4" />
                </button>
                <button onClick={saveTitle} title="บันทึก" className="p-1 rounded-md text-amber-300 hover:text-amber-200 transition">
                  <Check className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-6 text-[11px] text-slate-300/80">
          {entry.place && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {entry.place}
            </span>
          )}
          {entry.time && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {entry.time}
            </span>
          )}
          <span className="text-slate-400/80">{new Date(entry.at).toLocaleDateString('th-TH', DATE_FORMAT)}</span>
        </div>

        {entry.excerpt && (
          <button
            onClick={() => setOpen((v) => !v)}
            className={`w-full text-left pl-6 text-xs leading-relaxed text-slate-300/90 whitespace-pre-line ${open ? 'block' : 'line-clamp-2'}`}
          >
            {entry.excerpt}
          </button>
        )}
      </div>
    </li>
  );
}

/**
 * The memory journal of one character, newest moment first.
 */
export default function JournalList({ entries, fallbackBackground, onRename, onDelete }) {
  if (!entries?.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-600/70 px-4 py-8 text-center space-y-2">
        <BookHeart className="w-8 h-8 mx-auto text-amber-300/70" />
        <p className="text-sm text-slate-300">ยังไม่มีความทรงจำที่บันทึกไว้</p>
        <p className="text-xs text-slate-400 leading-relaxed">
          เมื่อเรื่องมีช่วงเวลาสำคัญ แอปจะถามว่าจะบันทึกไหม
          <br />
          หรือกดปุ่ม 🔖 ใต้ข้อความไหนก็ได้เพื่อบันทึกเอง
        </p>
      </div>
    );
  }
  return (
    <ul className="space-y-2.5">
      {[...entries].reverse().map((entry) => (
        <JournalCard
          key={entry.id}
          entry={entry}
          fallbackBackground={fallbackBackground}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
