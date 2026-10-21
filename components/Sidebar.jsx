'use client';

import React, { useRef, useState, useMemo } from 'react';
import { Sparkles, Settings, Plus, Download, Upload, Search, Home, Trash2, X, LogOut } from 'lucide-react';

const DAY_MS = 24 * 60 * 60 * 1000;

// "วันนี้" / "เมื่อวาน" / "ก่อนหน้านี้" by calendar day, like a messaging app's chat list
function groupLabel(at, now) {
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  if (at >= startOfToday) return 'วันนี้';
  if (at >= startOfToday - DAY_MS) return 'เมื่อวาน';
  return 'ก่อนหน้านี้';
}

/**
 * Left panel: app actions plus the list of chats the user has already started, newest first.
 * On mobile it is a slide-in drawer opened from the home screen.
 */
export default function Sidebar({
  recentChats,
  selectedChar,
  onSelectChar,
  onClearChat,
  onGoHome,
  onOpenSettings,
  onOpenCreateModal,
  onExportData,
  onImportData,
  account,
  isOpen,
  onClose,
}) {
  const importInputRef = useRef(null);
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    const result = [];
    for (const chat of recentChats) {
      if (q && !chat.character.name.toLowerCase().includes(q)) continue;
      const label = groupLabel(chat.at, now);
      const group = result.find((g) => g.label === label);
      if (group) group.chats.push(chat);
      else result.push({ label, chats: [chat] });
    }
    return result;
  }, [recentChats, query]);

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (file) onImportData(file);
    e.target.value = '';
  };

  const handleClear = (e, charId) => {
    e.stopPropagation();
    onClearChat(charId);
  };

  return (
    <>
      {isOpen && <div onClick={onClose} className="md:hidden fixed inset-0 bg-black/60 z-30" />}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-80 bg-slate-800 md:bg-slate-800/80 backdrop-blur-md border-r border-slate-700/80 flex flex-col h-full transition-transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-700/80 flex justify-between items-center bg-slate-800/40">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-sm shadow-purple-900/40">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-base text-white tracking-wide">Botbaat</h1>
          </div>
          <div className="flex items-center">
            <button
              onClick={onOpenSettings}
              title="ตั้งค่า"
              className="p-2 hover:bg-slate-700/80 rounded-full transition text-slate-400 hover:text-white"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              title="ปิดเมนู"
              className="md:hidden p-2 hover:bg-slate-700/80 rounded-full transition text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Primary actions */}
        <div className="p-3 space-y-2 border-b border-slate-700/80">
          <button
            onClick={onGoHome}
            className={`w-full py-2.5 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition ${
              selectedChar ? 'bg-slate-700/60 hover:bg-slate-700 text-slate-200' : 'bg-slate-700 text-white'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>หน้าหลัก</span>
          </button>
          <button
            onClick={onOpenCreateModal}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-purple-900/30"
          >
            <Plus className="w-4 h-4" />
            <span>สร้างตัวละครใหม่</span>
          </button>
        </div>

        {/* Chat history */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">แชทของฉัน</div>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาแชท..."
              className="w-full bg-slate-900/70 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
            />
          </div>

          {recentChats.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-6 leading-relaxed">
              ยังไม่มีแชท
              <br />
              เลือกตัวละครจากหน้าหลักเพื่อเริ่มคุย
            </p>
          )}
          {recentChats.length > 0 && groups.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-6">ไม่พบแชทที่ค้นหา</p>
          )}

          {groups.map((group) => (
            <div key={group.label} className="space-y-1">
              <div className="text-[11px] text-slate-500 px-1">{group.label}</div>
              {group.chats.map(({ character, preview }) => (
                <div
                  key={character.id}
                  onClick={() => onSelectChar(character)}
                  className={`group flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition ${
                    selectedChar?.id === character.id ? 'bg-purple-900/40' : 'hover:bg-slate-700/50'
                  }`}
                >
                  <img
                    src={character.avatar}
                    alt={character.name}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-slate-600"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-100 truncate">{character.name}</div>
                    <div className="text-xs text-slate-400 truncate">{preview}</div>
                  </div>
                  <button
                    onClick={(e) => handleClear(e, character.id)}
                    title="ลบแชทนี้"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus:opacity-100 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Backup */}
        <div className="p-3 border-t border-slate-700/80 bg-slate-800/40 grid grid-cols-2 gap-2">
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

        {/* Signed-in account (only when login is set up) */}
        {account && (
          <div className="px-3 pb-3 pt-1 bg-slate-800/40 flex items-center gap-2">
            <span className="flex-1 min-w-0 text-xs text-slate-400 truncate" title={account.email}>
              {account.email}
            </span>
            <button
              onClick={account.onSignOut}
              title="ออกจากระบบ"
              className="py-1.5 px-2.5 text-xs text-slate-400 hover:text-white hover:bg-slate-700/80 rounded-lg flex items-center gap-1.5 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
