'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';

/**
 * Character card item displayed in the sidebar list.
 */
export default function CharacterCard({ character, isSelected, onSelect, onDelete }) {
  const isCustom = character.id && character.id.startsWith('custom_');

  const handleDelete = (e) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(character.id);
    }
  };

  return (
    <div
      onClick={() => onSelect(character)}
      className={`group relative p-3 rounded-xl cursor-pointer transition-all flex items-center gap-3 border ${
        isSelected
          ? 'bg-purple-900/40 border-purple-500/60 shadow-md shadow-purple-950/40'
          : 'bg-slate-800/40 hover:bg-slate-800/80 border-slate-700/50 hover:border-slate-600'
      }`}
    >
      <img
        src={character.avatar}
        alt={character.name}
        className="w-12 h-12 rounded-full object-cover border border-purple-400/30 flex-shrink-0 shadow-sm"
      />
      <div className="flex-1 min-w-0 pr-6">
        <div className="flex items-center gap-1.5">
          <h3 className="font-semibold text-sm text-slate-100 truncate">{character.name}</h3>
          {character.category && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-500/30">
              {character.category}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 truncate mt-0.5">
          {character.tagline || character.description}
        </p>
      </div>

      {isCustom && onDelete && (
        <button
          onClick={handleDelete}
          title="ลบตัวละครนี้"
          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-all absolute right-2"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
