'use client';

import React, { useEffect, useState } from 'react';
import { X, Pencil, MessageCircle, UserCog, BookHeart } from 'lucide-react';
import { formatRoleplayText } from './ChatMessage';
import { levelOf, levelName } from '../lib/relation';

// "ผูกพัน Lv.4 · ผูกพันลึกซึ้ง"
function meterText(key, label, points) {
  const { level } = levelOf(points);
  return `${label} Lv.${level} · ${levelName(key, level)}`;
}

const PROFILE_ROWS = [
  ['age', 'อายุ'],
  ['occupation', 'อาชีพ / การเรียน'],
  ['appearance', 'รูปลักษณ์'],
  ['personality', 'นิสัย'],
  ['likes', 'สิ่งที่ชอบ'],
  ['dislikes', 'สิ่งที่ไม่ชอบ'],
  ['story', 'ความเป็นมา'],
];

const TABS = [
  ['bio', 'ประวัติ'],
  ['role', 'บทบาทของคุณ'],
  ['cast', 'คนรอบตัว'],
  ['greeting', 'คำทักทาย'],
];

function Row({ label, value }) {
  if (!value?.trim()) return null;
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] font-medium text-purple-300/90">{label}</div>
      <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">{value}</div>
    </div>
  );
}

/**
 * A character's profile sheet, opened from the character grid before chatting: big picture, bio, the user's
 * role with them, the people around them, and their greeting. `status` (when there is a chat already) is
 * { relation, journalCount }.
 */
export default function CharacterProfile({ character, role, status, hasChat, onClose, onStartChat, onEditRole, onEdit }) {
  const [tab, setTab] = useState('bio');

  useEffect(() => {
    if (character) setTab('bio');
  }, [character]);

  useEffect(() => {
    if (!character) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [character, onClose]);

  if (!character) return null;
  const profile = character.profile || {};
  const hasProfile = PROFILE_ROWS.some(([key]) => profile[key]?.trim());
  const cast = (character.cast || []).filter((p) => p?.name?.trim());
  const defaults = character.defaultUserRole || {};
  const relation = status?.relation;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`โปรไฟล์ของ ${character.name}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[92dvh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* Picture with name */}
        <div className="relative h-[38dvh] min-h-[220px] max-h-80 flex-shrink-0 bg-slate-800">
          <img src={character.avatar} alt={character.name} className="absolute inset-0 w-full h-full object-cover object-top" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/30 to-black/20" />
          <button
            onClick={onClose}
            title="ปิด"
            className="absolute top-3 right-3 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
          {onEdit && (
            <button
              onClick={onEdit}
              title="แก้ไขตัวละคร"
              className="absolute top-3 left-3 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          <div className="absolute bottom-0 inset-x-0 p-4 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold text-white drop-shadow">{character.name}</h2>
              {character.category && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-200 border border-purple-400/40">
                  {character.category}
                </span>
              )}
            </div>
            {character.tagline && <p className="text-sm text-slate-200/90">{character.tagline}</p>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          {/* Where things stand, once there is a chat */}
          {(relation || status?.journalCount > 0) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300">
              {Number.isFinite(relation?.bond) && <span>💗 {meterText('bond', 'ผูกพัน', relation.bond)}</span>}
              {Number.isFinite(relation?.trust) && <span>🤝 {meterText('trust', 'ไว้ใจ', relation.trust)}</span>}
              {relation?.mood && <span className="text-slate-400">· {relation.mood}</span>}
              {status?.journalCount > 0 && (
                <span className="flex items-center gap-1 text-amber-200/90">
                  <BookHeart className="w-3.5 h-3.5" />
                  {status.journalCount} ความทรงจำ
                </span>
              )}
            </div>
          )}

          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs border transition ${
                  tab === id
                    ? 'bg-purple-600 border-purple-500 text-white'
                    : 'border-slate-600 text-slate-300 hover:border-slate-500'
                }`}
              >
                {label}
                {id === 'cast' && cast.length > 0 && <span className="ml-1 opacity-70">{cast.length}</span>}
              </button>
            ))}
          </div>

          {tab === 'bio' && (
            <div className="space-y-3">
              {hasProfile ? (
                PROFILE_ROWS.map(([key, label]) => <Row key={key} label={label} value={profile[key]} />)
              ) : (
                <Row label="ตัวตน" value={character.description} />
              )}
              <Row label="โลกของเรื่อง" value={character.scenario} />
            </div>
          )}

          {tab === 'role' && (
            <div className="space-y-3">
              <Row label="ชื่อของคุณ" value={role?.name} />
              <Row label="ให้เรียกคุณว่า" value={role?.callMe} />
              <Row label="คุณเป็นอะไรกับเขา" value={role?.description || defaults.description} />
              <Row label="ประวัติของคุณ" value={role?.background || defaults.background} />
              <Row label="นิสัยของคุณ" value={role?.personality} />
              {!role?.description && !defaults.description && (
                <p className="text-xs text-slate-400">ยังไม่ได้ตั้งบทบาทกับตัวละครนี้</p>
              )}
              <button
                onClick={onEditRole}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sm text-slate-200 transition"
              >
                <UserCog className="w-4 h-4" />
                แก้บทบาทของฉัน
              </button>
            </div>
          )}

          {tab === 'cast' &&
            (cast.length > 0 ? (
              <ul className="space-y-2">
                {cast.map((p, i) => (
                  <li key={i} className="rounded-2xl bg-slate-800/70 border border-slate-700/70 px-3.5 py-2.5">
                    <div className="text-sm font-medium text-white">{p.name}</div>
                    {p.relation && <div className="text-[11px] text-purple-300/90">{p.relation}</div>}
                    {p.personality && <div className="text-xs text-slate-300 mt-0.5">{p.personality}</div>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400 leading-relaxed">
                ยังไม่มีคนรอบตัว{onEdit ? ' — เพิ่มได้ในหน้าแก้ไขตัวละคร (ไอคอนดินสอด้านบน)' : ''}
              </p>
            ))}

          {tab === 'greeting' && (
            <div className="rounded-2xl rounded-tl-none bg-slate-800/90 border border-slate-700/80 p-3.5 text-sm leading-relaxed">
              {formatRoleplayText(character.greeting || '', 'model', character.name)}
            </div>
          )}
        </div>

        <div className="p-4 pt-3 border-t border-slate-800 bg-slate-900">
          <button
            onClick={onStartChat}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium transition shadow-lg shadow-purple-900/40"
          >
            <MessageCircle className="w-5 h-5" />
            {hasChat ? 'คุยต่อ' : 'เริ่มแชท'}
          </button>
        </div>
      </div>
    </div>
  );
}
