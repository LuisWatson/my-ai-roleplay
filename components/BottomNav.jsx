'use client';

import React from 'react';
import { Home, MessageSquare, Plus } from 'lucide-react';

/**
 * Phone-only bottom bar on the home screen (the sidebar is a hidden drawer on phones). "Chats" opens that drawer.
 * Home is the page you are on; its selected state is a soft accent pill, not a solid fill.
 */
export default function BottomNav({ onHome, onChats, onCreate }) {
  const item = 'flex-1 flex flex-col items-center justify-center gap-0.5 min-h-14 text-xs rounded-2xl transition-colors';
  return (
    <nav
      aria-label="เมนูหลัก"
      className="md:hidden flex items-stretch gap-1 px-3 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] bg-slate-950 border-t border-slate-800"
    >
      <button onClick={onHome} aria-current="page" className={`${item} bg-purple-500/15 text-purple-300`}>
        <Home className="w-5 h-5" />
        <span>หน้าหลัก</span>
      </button>
      <button onClick={onChats} className={`${item} text-slate-400 hover:text-slate-100 active:bg-slate-800`}>
        <MessageSquare className="w-5 h-5" />
        <span>แชท</span>
      </button>
      <button onClick={onCreate} className={`${item} text-slate-400 hover:text-slate-100 active:bg-slate-800`}>
        <Plus className="w-5 h-5" />
        <span>สร้าง</span>
      </button>
    </nav>
  );
}
