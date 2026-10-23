'use client';

import React, { useState, useMemo } from 'react';
import { Search, Plus, MessageSquare, PanelLeftOpen } from 'lucide-react';
import CharacterCard from './CharacterCard';

/**
 * Home screen: searchable, filterable grid of every character. Picking a card opens its profile sheet.
 */
export default function CharacterBrowser({
  characters,
  onSelectChar,
  onDeleteChar,
  onEditChar,
  onOpenCreateModal,
  onOpenHistory,
  onExpandSidebar,
}) {
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

  return (
    <main className="flex-1 flex flex-col bg-slate-900/95 overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-5 md:py-8 space-y-4">
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenHistory}
              title="แชทของฉัน"
              className="md:hidden p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            {onExpandSidebar && (
              <button
                onClick={onExpandSidebar}
                title="แสดงแถบด้านซ้าย"
                aria-label="แสดงแถบด้านซ้าย"
                className="hidden md:inline-flex p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition"
              >
                <PanelLeftOpen className="w-5 h-5" />
              </button>
            )}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหาตัวละคร..."
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
              />
            </div>
            <button
              onClick={onOpenCreateModal}
              className="md:hidden p-2.5 rounded-xl bg-purple-600 text-white"
              title="สร้างตัวละครใหม่"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {['', ...categories].map((cat) => (
              <button
                key={cat || 'all'}
                onClick={() => setCategory(cat)}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${
                  category === cat
                    ? 'bg-purple-600 border-purple-500 text-white'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat || 'ทั้งหมด'}
              </button>
            ))}
          </div>

          <div className="text-xs font-semibold text-slate-400">
            ตัวละคร ({visibleCharacters.length === characters.length ? characters.length : `${visibleCharacters.length}/${characters.length}`})
          </div>

          {visibleCharacters.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-16">ไม่พบตัวละครที่ตรงกับการค้นหา</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {visibleCharacters.map((char) => (
                <CharacterCard
                  key={char.id}
                  character={char}
                  onSelect={onSelectChar}
                  onDelete={onDeleteChar}
                  onEdit={onEditChar}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
