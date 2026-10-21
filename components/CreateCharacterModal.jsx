'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, X, Image as ImageIcon } from 'lucide-react';
import { DEFAULT_AVATAR } from '../constants/characters';
import { REALISM_OPTIONS, DEFAULT_REALISM } from '../constants/scenario';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
];

const EMPTY_FORM = {
  name: '',
  tagline: '',
  category: 'สร้างเอง',
  description: '',
  greeting: '',
  exampleDialogue: '',
  scenario: '',
  realism: DEFAULT_REALISM,
  avatar: DEFAULT_AVATAR,
};

/**
 * Modal form component for authoring a new character persona, or editing an existing one
 * when `editingCharacter` is provided.
 */
export default function CreateCharacterModal({
  isOpen,
  onClose,
  onCreateCharacter,
  editingCharacter,
  onUpdateCharacter,
}) {
  const [formData, setFormData] = useState(EMPTY_FORM);

  // Load the character being edited (or a blank form) whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData(editingCharacter ? { ...EMPTY_FORM, ...editingCharacter } : EMPTY_FORM);
    }
  }, [isOpen, editingCharacter]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.description.trim() || !formData.greeting.trim()) {
      alert('กรุณากรอกชื่อตัวละคร, ข้อมูลบทบาท (Persona), และประโยคทักทายแรกให้ครบถ้วน');
      return;
    }

    if (editingCharacter) {
      onUpdateCharacter(formData);
    } else {
      onCreateCharacter(formData);
    }
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

        <div className="flex items-center gap-2 text-white">
          <div className="p-2 rounded-lg bg-purple-900/50 border border-purple-500/30">
            <Sparkles className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-base font-bold">{editingCharacter ? 'แก้ไขตัวละคร' : 'สร้างตัวละครใหม่'}</h2>
            <p className="text-xs text-slate-400">กำหนดบุคลิกและบทบาทสำหรับ Roleplay</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar Preview & Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">รูปโปรไฟล์ (Avatar)</label>
            <div className="flex items-center gap-3 mb-2">
              <img
                src={formData.avatar}
                alt="Preview"
                className="w-12 h-12 rounded-full object-cover border-2 border-purple-500/60 shadow-md flex-shrink-0"
              />
              <div className="flex-1">
                <input
                  type="url"
                  value={formData.avatar}
                  onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                  placeholder="URL รูปภาพ..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">รูปตัวอย่าง:</span>
              <div className="flex gap-1.5">
                {PRESET_AVATARS.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setFormData({ ...formData, avatar: url })}
                    className={`w-7 h-7 rounded-full overflow-hidden border-2 transition ${
                      formData.avatar === url ? 'border-purple-400 scale-110' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt={`Preset ${idx}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Name & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                ชื่อตัวละคร <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="เช่น เอวา (Ava)"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100 focus:outline-none focus:border-purple-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">หมวดหมู่ / สถานะ</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="เช่น เพื่อนสนิท, แฟน, รุ่นพี่"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100 focus:outline-none focus:border-purple-500 transition"
              />
            </div>
          </div>

          {/* Tagline */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">คำอธิบายสั้นๆ (Tagline)</label>
            <input
              type="text"
              value={formData.tagline}
              onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
              placeholder="เช่น เพื่อนสนิทสายกวน ขี้แกล้ง แต่คอยดูแลเสมอ"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100 focus:outline-none focus:border-purple-500 transition"
            />
          </div>

          {/* Persona / Description */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              นิสัยและบทบาท (Prompt / Persona) <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={4}
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="ระบุอายุ บุคลิก นิสัย สรรพนามที่ใช้แทนตัวเองและความสัมพันธ์กับผู้ใช้..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100 focus:outline-none focus:border-purple-500 transition resize-none"
            />
          </div>

          {/* Greeting */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              ประโยคทักทายแรก (First Message) <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={2}
              required
              value={formData.greeting}
              onChange={(e) => setFormData({ ...formData, greeting: e.target.value })}
              placeholder="เช่น *(เงยหน้าขึ้นมาสบตาพร้อมยิ้ม)* 'ไง! รอตั้งนานแล้วนะ'"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100 focus:outline-none focus:border-purple-500 transition resize-none"
            />
          </div>

          {/* Scenario / world setting */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              ฉาก / โลกของเรื่อง (ไม่บังคับ)
            </label>
            <textarea
              rows={2}
              value={formData.scenario}
              onChange={(e) => setFormData({ ...formData, scenario: e.target.value })}
              placeholder="เช่น เรียนมหาวิทยาลัยเดียวกัน ชั้นปีเดียวกัน รู้จักกันมาตั้งแต่เด็ก"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100 focus:outline-none focus:border-purple-500 transition resize-none"
            />
          </div>

          {/* Realism level */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">ความสมจริงของเรื่อง</label>
            <div className="grid grid-cols-3 gap-2">
              {REALISM_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, realism: opt.id })}
                  title={opt.hint}
                  className={`py-2 rounded-xl border text-xs transition ${
                    formData.realism === opt.id
                      ? 'bg-purple-900/40 border-purple-500/60 text-purple-200'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Example dialogue */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              ตัวอย่างบทพูด (ไม่บังคับ) ช่วยให้ตัวละครพูดมีเอกลักษณ์ขึ้น
            </label>
            <textarea
              rows={3}
              value={formData.exampleDialogue}
              onChange={(e) => setFormData({ ...formData, exampleDialogue: e.target.value })}
              placeholder={'เช่น\n"อะไรอีกล่ะเนี่ย ขี้เกียจจริงๆ เลยนะเรา"\n*(ถอนหายใจแล้วยิ้มมุมปาก)* "มานี่ มาให้พี่ดูหน่อย"'}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100 focus:outline-none focus:border-purple-500 transition resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-700/60">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-700/70 hover:bg-slate-700 text-slate-300 text-sm rounded-xl transition"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-medium rounded-xl transition shadow-md shadow-purple-900/40"
            >
              {editingCharacter ? 'บันทึกการแก้ไข' : 'สร้างตัวละคร'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
