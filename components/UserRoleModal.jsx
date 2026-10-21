'use client';

import React, { useState, useEffect } from 'react';
import { UserCog, X } from 'lucide-react';
import { normalizeUserRole } from '../lib/userRole';

const FIELD_CLASS =
  'w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500 text-slate-100 placeholder-slate-600 transition';

/**
 * Modal for defining who the user is to one specific character (name, relationship, personality, likes, dislikes).
 * Empty fields fall back to the general profile in Settings.
 */
export default function UserRoleModal({ isOpen, onClose, character, role, onSave }) {
  const [form, setForm] = useState(normalizeUserRole(null));

  useEffect(() => {
    if (isOpen) setForm(normalizeUserRole(role));
  }, [isOpen, role]);

  if (!isOpen || !character) return null;

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSave = () => {
    onSave(character.id, form);
    onClose();
  };

  const handleReset = () => {
    onSave(character.id, normalizeUserRole(null));
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-slate-800 border border-slate-700/80 rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 text-white">
          <div className="p-2 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-md shadow-purple-900/30">
            <UserCog className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold">บทบาทของฉันกับ {character.name}</h2>
            <p className="text-xs text-slate-400">เว้นว่าง = ใช้ค่าจากโปรไฟล์ทั่วไปใน Settings</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">ชื่อของฉัน</label>
            <input type="text" value={form.name} onChange={update('name')} placeholder="เช่น บาส" className={FIELD_CLASS} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">ให้เรียกฉันว่า</label>
            <input type="text" value={form.callMe} onChange={update('callMe')} placeholder="เช่น พี่บาส, แก, ที่รัก" className={FIELD_CLASS} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">ฉันเป็นอะไรกับตัวละครนี้ (ความสัมพันธ์ / บทบาท)</label>
          <textarea
            rows={2}
            value={form.description}
            onChange={update('description')}
            placeholder={character.userRoleHint || 'เช่น เพื่อนร่วมงาน เพื่อนสนิท แฟน รุ่นน้อง'}
            className={`${FIELD_CLASS} resize-none`}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">นิสัยของฉัน</label>
          <textarea
            rows={2}
            value={form.personality}
            onChange={update('personality')}
            placeholder="เช่น ใจเย็น ขี้เกรงใจ ชอบหยอกกลับ ไม่ค่อยพูดเรื่องตัวเอง"
            className={`${FIELD_CLASS} resize-none`}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">สิ่งที่ฉันชอบ</label>
            <textarea rows={2} value={form.likes} onChange={update('likes')} placeholder="เช่น กาแฟ หนังสยองขวัญ เดินป่า" className={`${FIELD_CLASS} resize-none`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">สิ่งที่ฉันไม่ชอบ</label>
            <textarea rows={2} value={form.dislikes} onChange={update('dislikes')} placeholder="เช่น คนโกหก ที่ที่คนแน่น ตื่นเช้า" className={`${FIELD_CLASS} resize-none`} />
          </div>
        </div>

        <div className="flex justify-between items-center gap-2 pt-3 border-t border-slate-700/60">
          <button onClick={handleReset} className="px-3 py-2 text-xs text-slate-400 hover:text-red-400 transition">
            ล้างค่า
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 bg-slate-700/70 hover:bg-slate-700 text-slate-300 text-sm rounded-xl transition">
              ยกเลิก
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-medium rounded-xl transition shadow-md shadow-purple-900/40"
            >
              บันทึกบทบาท
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
