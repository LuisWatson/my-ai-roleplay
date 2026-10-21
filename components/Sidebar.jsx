'use client';

import React, { useRef, useState, useMemo } from 'react';
import { Sparkles, Settings, Plus, Download, Upload, Search } from 'lucide-react';
import CharacterCard from './CharacterCard';

/**
 * Sidebar component containing application branding, character selection list, and character creation trigger.
 */
export default function Sidebar({
  characters,
  selectedChar,
  onSelectChar,
  onDeleteChar,
  onEditChar,
  onExportData,
  onImportData,
  onOpenSettings,
  onOpenCreateModal,
}) {
  const importInputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');

  const categories = useMemo(() => [...new Set(characters.map((c) => c.category).filter(Boolean))], [characters]);

  const visibleCharacters = useMemo(() => {
    const q = query.trim().toLowerCase();
    return characters.filter((c) => {
      if (category && c.category !== category) return false;
      if (!q) return true;
      return [c.name, c.tagline, c.category, c.description].some((f) => f?.toLowerCase().includes(q));
    });
  }, [characters, query, category]);

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (file) onImportData(file);
    e.target.value = '';
  };

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
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาตัวละคร..."
            className="w-full bg-slate-900/70 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {['', ...categories].map((cat) => (
            <button
              key={cat || 'all'}
              onClick={() => setCategory(cat)}
              className={`flex-shrink-0 text-[11px] px-2.5 py-1 rounded-full border transition ${
                category === cat
                  ? 'bg-purple-900/50 border-purple-500/60 text-purple-200'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat || 'ทั้งหมด'}
            </button>
          ))}
        </div>
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1">
          ตัวละคร ({visibleCharacters.length === characters.length ? characters.length : `${visibleCharacters.length}/${characters.length}`})
        </div>
        {visibleCharacters.length === 0 && (
          <p className="text-xs text-slate-500 text-center py-6">ไม่พบตัวละครที่ตรงกับการค้นหา</p>
        )}
        {visibleCharacters.map((char) => (
          <CharacterCard
            key={char.id}
            character={char}
            isSelected={selectedChar?.id === char.id}
            onSelect={onSelectChar}
            onDelete={onDeleteChar}
            onEdit={onEditChar}
          />
        ))}
      </div>

      {/* Action Footer */}
      <div className="p-3 border-t border-slate-700/80 bg-slate-800/40 space-y-2">
        <button
          onClick={onOpenCreateModal}
          className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition shadow-lg shadow-purple-900/30 active:scale-[0.99]"
        >
          <Plus className="w-5 h-5" />
          <span>สร้างตัวละครใหม่</span>
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onExportData}
            className="py-2 px-3 bg-slate-700/60 hover:bg-slate-700 text-slate-300 text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
          >
            <Download className="w-4 h-4" />
            <span>ส่งออก Backup</span>
          </button>
          <button
            onClick={() => importInputRef.current?.click()}
            className="py-2 px-3 bg-slate-700/60 hover:bg-slate-700 text-slate-300 text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
          >
            <Upload className="w-4 h-4" />
            <span>นำเข้า Backup</span>
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>
      </div>
    </aside>
  );
}
