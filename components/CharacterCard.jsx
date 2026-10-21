'use client';

import React from 'react';
import { Trash2, Pencil } from 'lucide-react';

/**
 * Character card item displayed in the browse grid: full-bleed cover image with
 * name/tagline overlaid at the bottom, like a show poster.
 */
export default function CharacterCard({ character, isSelected, onSelect, onDelete, onEdit }) {
  const isCustom = character.id && character.id.startsWith('custom_');

  const handleDelete = (e) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(character.id);
    }
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    onEdit(character);
  };

  return (
    <div
      onClick={() => onSelect(character)}
      className={`group relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer transition-all border ${
        isSelected
          ? 'border-purple-500 ring-2 ring-purple-500/50 shadow-lg shadow-purple-950/40'
          : 'border-slate-700/50 hover:border-slate-600'
      }`}
    >
      <img src={character.avatar} alt={character.name} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

      {character.category && (
        <span className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 rounded bg-black/50 backdrop-blur-sm text-purple-200 border border-purple-400/30">
          {character.category}
        </span>
      )}

      {isCustom && (
        <div className="[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-within:opacity-100 transition-all absolute top-2 right-2 flex gap-0.5">
          {onEdit && (
            <button
              onClick={handleEdit}
              title="แก้ไขตัวละครนี้"
              className="p-1.5 bg-black/50 backdrop-blur-sm hover:bg-purple-500/40 text-slate-200 hover:text-purple-200 rounded-lg"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={handleDelete}
              title="ลบตัวละครนี้"
              className="p-1.5 bg-black/50 backdrop-blur-sm hover:bg-red-500/40 text-slate-200 hover:text-red-300 rounded-lg"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-3">
        <h3 className="font-semibold text-sm text-white truncate drop-shadow">{character.name}</h3>
        <p className="text-xs text-slate-300 line-clamp-2 drop-shadow mt-0.5">
          {character.tagline || character.description}
        </p>
      </div>
    </div>
  );
}
