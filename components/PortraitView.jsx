'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { EXPRESSION_LABELS } from '../lib/expressions';

/**
 * A picture of the character at full size over the chat, opened by tapping the header picture or a mood card.
 */
export function PortraitLightbox({ src, name, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`รูปของ ${name}`}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
    >
      <img
        src={src}
        alt={name}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88dvh] max-w-full w-auto rounded-3xl object-contain shadow-2xl border border-white/10"
      />
      <button
        onClick={onClose}
        title="ปิด"
        className="absolute top-4 right-4 p-2.5 rounded-full bg-slate-900/70 hover:bg-slate-800 text-white transition"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

/**
 * A picture placed in the chat where a character's expression changes (see `moodChanges`). Tap for full size.
 */
export function MoodCard({ character, card, onZoom, className = '' }) {
  return (
    <div className={`animate-fadeIn ${className}`} aria-label="สีหน้าตัวละคร">
      <button
        onClick={() => onZoom(card.src)}
        title={`${character.name} · ${EXPRESSION_LABELS[card.key]} (แตะดูรูปเต็ม)`}
        className="block w-36 md:w-40 aspect-[3/4] overflow-hidden rounded-xl border border-white/10 shadow-lg bg-slate-800"
      >
        <img src={card.src} alt={`${character.name} ${EXPRESSION_LABELS[card.key]}`} className="w-full h-full object-cover object-top" />
      </button>
    </div>
  );
}

