'use client';

import React from 'react';
import { Sparkles, Settings, Plus } from 'lucide-react';
import CharacterCard from './CharacterCard';

/**
 * Sidebar component containing application branding, character selection list, and character creation trigger.
 */
export default function Sidebar({
  characters,
  selectedChar,
  onSelectChar,
  onDeleteChar,
  onOpenSettings,
  onOpenCreateModal,
}) {
  return (
    <aside
      className={`w-full md:w-80 bg-slate-800/80 backdrop-blur-md border-r border-slate-700/80 flex flex-col h-full ${
        selectedChar ? 'hidden md:flex' : 'flex'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-700/80 flex justify-between items-center bg-slate-800/40">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-sm shadow-purple-900/40">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h1 className="font-bold text-base text-white tracking-wide">Khui AI Personal</h1>
        </div>
        <button
          onClick={onOpenSettings}
          title="ตั้งค่า"
          className="p-2 hover:bg-slate-700/80 rounded-full transition text-slate-400 hover:text-white"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Character List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1">
          ตัวละคร ({characters.length})
        </div>
        {characters.map((char) => (
          <CharacterCard
            key={char.id}
            character={char}
            isSelected={selectedChar?.id === char.id}
            onSelect={onSelectChar}
            onDelete={onDeleteChar}
          />
        ))}
      </div>

      {/* Action Footer */}
      <div className="p-3 border-t border-slate-700/80 bg-slate-800/40">
        <button
          onClick={onOpenCreateModal}
          className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition shadow-lg shadow-purple-900/30 active:scale-[0.99]"
        >
          <Plus className="w-5 h-5" />
          <span>สร้างตัวละครใหม่</span>
        </button>
      </div>
    </aside>
  );
}
