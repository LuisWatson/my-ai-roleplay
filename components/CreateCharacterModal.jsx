'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, Image as ImageIcon, Camera, Loader2 } from 'lucide-react';
import { imageFileToAvatar } from '../lib/imageResize';
import { DEFAULT_AVATAR } from '../constants/characters';
import { REALISM_OPTIONS, DEFAULT_REALISM } from '../constants/scenario';

const PRESET_AVATARS = [
  DEFAULT_AVATAR,
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
  profile: {},
  cast: [],
  storyHooks: [],
  situation: '',
  userSecret: '',
  opening: { time: '', place: '', mood: '' },
};
const MAX_HOOKS = 12;
// The opening card's fields (lib/story.js)
const OPENING_FIELDS = [
  ['time', 'เวลา', 'เช่น 17:42 น. วันพฤหัสบดี ต้นฤดูฝน', 60],
  ['place', 'สถานที่', 'เช่น หอสมุดเก่าของมหาวิทยาลัย ชั้น 3', 80],
  ['mood', 'บรรยากาศ', 'เช่น ฝนตกหนัก แสงเย็นสีส้มกระทบชั้นหนังสือ', 300],
];

// Optional profile fields (same keys as constants/characterProfiles.js), shown on the character's profile
const PROFILE_FIELDS = [
  ['age', 'อายุ', 'เช่น 24 ปี'],
  ['occupation', 'อาชีพ / การเรียน', 'เช่น นักศึกษาปี 3 คณะศิลปศาสตร์'],
  ['appearance', 'รูปลักษณ์', 'เช่น ผมดำยาว ตัวเล็ก ชอบใส่ฮู้ดตัวใหญ่'],
  ['personality', 'นิสัย', 'เช่น ยิ้มเก่ง ใจดี แต่ปากแข็ง'],
  ['likes', 'สิ่งที่ชอบ', 'เช่น ชานม แมว หนังสยองขวัญ'],
  ['dislikes', 'สิ่งที่ไม่ชอบ', 'เช่น การรอคอย คนโกหก'],
  ['story', 'ความเป็นมา', 'เช่น รู้จักกันตอนเข้าชมรมดนตรี'],
];
const MAX_CAST = 6;
const SMALL_FIELD =
  'w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-base md:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-purple-500 transition';

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
  const [formError, setFormError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // A photo picked from the phone/computer becomes a small 3:4 portrait stored with the character
  const handlePickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setFormError('');
    try {
      const avatar = await imageFileToAvatar(file);
      setFormData((data) => ({ ...data, avatar }));
    } catch {
      setFormError('เปิดรูปนี้ไม่ได้ ลองเลือกรูปอื่นดูนะ');
    } finally {
      setUploading(false);
    }
  };

  // Load the character being edited (or a blank form) whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData(editingCharacter ? { ...EMPTY_FORM, ...editingCharacter } : EMPTY_FORM);
      setFormError('');
    }
  }, [isOpen, editingCharacter]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.description.trim() || !formData.greeting.trim()) {
      setFormError('กรอกชื่อตัวละคร ข้อมูลบทบาท (Persona) และประโยคทักทายแรกให้ครบก่อนนะ');
      return;
    }
    setFormError('');

    // Keep only filled-in profile fields and named people
    const profile = Object.fromEntries(
      PROFILE_FIELDS.map(([key]) => [key, (formData.profile?.[key] || '').trim()]).filter(([, v]) => v)
    );
    const cast = (formData.cast || [])
      .map((p) => ({ name: p.name.trim(), relation: p.relation.trim(), personality: p.personality.trim() }))
      .filter((p) => p.name);
    const storyHooks = (formData.storyHooks || [])
      .map((h) => h.trim().slice(0, 200))
      .filter(Boolean)
      .slice(0, MAX_HOOKS);
    const opening = Object.fromEntries(
      OPENING_FIELDS.map(([key, , , max]) => [key, (formData.opening?.[key] || '').trim().slice(0, max)])
    );
    const data = {
      ...formData,
      profile,
      cast,
      storyHooks,
      situation: (formData.situation || '').trim().slice(0, 2500),
      userSecret: (formData.userSecret || '').trim().slice(0, 1000),
      opening,
    };

    if (editingCharacter) {
      onUpdateCharacter(data);
    } else {
      onCreateCharacter(data);
    }
    onClose();
  };

  const setOpeningField = (key, value) => setFormData({ ...formData, opening: { ...formData.opening, [key]: value } });
  const hasStory = Boolean(
    editingCharacter?.situation || editingCharacter?.userSecret || Object.values(editingCharacter?.opening || {}).some(Boolean)
  );
  const setProfileField = (key, value) => setFormData({ ...formData, profile: { ...formData.profile, [key]: value } });
  const setCastField = (index, key, value) =>
    setFormData({ ...formData, cast: formData.cast.map((p, i) => (i === index ? { ...p, [key]: value } : p)) });

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-slate-800 border border-slate-700/80 rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90dvh] overflow-y-auto shadow-2xl relative">
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
          {/* Avatar: tap to pick a photo; sample pictures and a link still work */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">รูปโปรไฟล์ (Avatar)</label>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePickPhoto} className="hidden" />
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="แตะเพื่อเลือกรูป"
                className="group relative w-20 aspect-[3/4] rounded-xl overflow-hidden border-2 border-purple-500/60 shadow-md flex-shrink-0"
              >
                <img src={formData.avatar} alt="รูปตัวละคร" className="absolute inset-0 w-full h-full object-cover" />
                <span className="absolute inset-0 grid place-items-center bg-slate-950/40 opacity-0 group-hover:opacity-100 transition">
                  <Camera className="w-6 h-6 text-white" />
                </span>
                {uploading && (
                  <span className="absolute inset-0 grid place-items-center bg-slate-950/50">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </span>
                )}
              </button>
              <div className="flex-1 min-w-0 space-y-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600/80 hover:bg-purple-500 text-white text-sm font-medium transition disabled:opacity-50"
                >
                  <Camera className="w-4 h-4" />
                  {uploading ? 'กำลังเตรียมรูป...' : 'แตะเพื่อเลือกรูป'}
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 flex-shrink-0">รูปตัวอย่าง:</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {PRESET_AVATARS.map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setFormData({ ...formData, avatar: url })}
                        className={`w-7 h-7 rounded-full overflow-hidden border-2 transition ${
                          formData.avatar === url ? 'border-purple-400 scale-110' : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={url} alt={`รูปตัวอย่าง ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
                <details className="text-[11px] text-slate-400">
                  <summary className="cursor-pointer select-none hover:text-slate-200">หรือวางลิงก์รูป</summary>
                  <input
                    type="url"
                    value={/^https?:/.test(formData.avatar) ? formData.avatar : ''}
                    onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                    placeholder={formData.avatar.startsWith('data:') ? 'ใช้รูปที่เลือกจากเครื่องอยู่' : 'https://...'}
                    className="mt-1.5 w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-base md:text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                  />
                </details>
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
              ฉากเปิด / ประโยคทักทายแรก (First Message) <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={formData.greeting}
              onChange={(e) => setFormData({ ...formData, greeting: e.target.value })}
              placeholder={'เช่น *เงยหน้าขึ้นมาสบตาพร้อมยิ้ม* "ไง! รอตั้งนานแล้วนะ"\nหรือเล่าเป็นฉากแบบนิยาย แล้วจบตรงจุดที่ค้างไว้ให้คุณตอบ'}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100 focus:outline-none focus:border-purple-500 transition resize-y"
            />
          </div>

          {/* Story setup: situation, the user's secret, opening card (lib/story.js) */}
          <details className="rounded-xl border border-violet-500/30 bg-violet-950/20 px-3 py-2" open={hasStory}>
            <summary className="cursor-pointer select-none text-xs font-medium text-violet-200 py-1">
              สถานการณ์และการ์ดฉากเปิด (ไม่บังคับ) — ทำให้เรื่องมีทิศทางตั้งแต่ข้อความแรก
            </summary>
            <div className="pt-2.5 space-y-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">สถานการณ์: ตอนนี้เกิดอะไรขึ้น และอะไรที่ยังค้างคาอยู่</label>
                <textarea
                  rows={5}
                  value={formData.situation || ''}
                  onChange={(e) => setFormData({ ...formData, situation: e.target.value })}
                  maxLength={2500}
                  placeholder="เช่น เธอหายไปจากชีวิตคุณเมื่อหนึ่งปีก่อนโดยไม่บอกเหตุผล วันนี้อาจารย์จับคุณสองคนทำโปรเจกต์ด้วยกันทั้งเทอม ความจริงของคืนนั้นยังไม่มีใครรู้..."
                  className={`${SMALL_FIELD} resize-y leading-relaxed`}
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">ความลับฝั่งคุณ (ตัวละครไม่รู้ จนกว่าคุณจะพูดเอง)</label>
                <textarea
                  rows={2}
                  value={formData.userSecret || ''}
                  onChange={(e) => setFormData({ ...formData, userSecret: e.target.value })}
                  maxLength={1000}
                  placeholder="เช่น คุณยังเก็บไฟล์เสียงที่เธอส่งมาคืนนั้นไว้ แต่ไม่เคยกล้าฟังจนจบ"
                  className={`${SMALL_FIELD} resize-y leading-relaxed`}
                />
              </div>
              <div className="space-y-2">
                <div className="text-[11px] text-slate-400">การ์ดฉากเปิด (แสดงเหนือข้อความแรก)</div>
                {OPENING_FIELDS.map(([key, label, placeholder, max]) => (
                  <input
                    key={key}
                    type="text"
                    aria-label={label}
                    value={formData.opening?.[key] || ''}
                    onChange={(e) => setOpeningField(key, e.target.value)}
                    maxLength={max}
                    placeholder={`${label}: ${placeholder}`}
                    className={SMALL_FIELD}
                  />
                ))}
              </div>
              <p className="text-[11px] text-slate-500">ใช้กับแชทที่เริ่มใหม่เท่านั้น แชทที่คุยค้างไว้จะไม่เปลี่ยน</p>
            </div>
          </details>

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
              placeholder={'เช่น\n"อะไรอีกล่ะเนี่ย ขี้เกียจจริงๆ เลยนะเรา"\n*ถอนหายใจแล้วยิ้มมุมปาก* "มานี่ มาให้พี่ดูหน่อย"'}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100 focus:outline-none focus:border-purple-500 transition resize-none"
            />
          </div>

          {/* Profile sheet: optional structured bio and people around the character */}
          <details className="rounded-xl border border-slate-700/70 bg-slate-900/40 px-3 py-2" open={Boolean(editingCharacter?.profile && Object.keys(editingCharacter.profile).length)}>
            <summary className="cursor-pointer select-none text-xs font-medium text-slate-300 py-1">
              โปรไฟล์ตัวละคร (ไม่บังคับ) — แสดงในหน้าโปรไฟล์และช่วยให้ AI เล่นบทแม่นขึ้น
            </summary>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2.5">
              {PROFILE_FIELDS.map(([key, label, placeholder]) => (
                <div key={key} className={key === 'story' || key === 'appearance' ? 'sm:col-span-2' : ''}>
                  <label className="block text-[11px] text-slate-400 mb-1">{label}</label>
                  <input
                    type="text"
                    value={formData.profile?.[key] || ''}
                    onChange={(e) => setProfileField(key, e.target.value)}
                    maxLength={400}
                    placeholder={placeholder}
                    className={SMALL_FIELD}
                  />
                </div>
              ))}
            </div>
          </details>

          <details className="rounded-xl border border-slate-700/70 bg-slate-900/40 px-3 py-2" open={Boolean(editingCharacter?.cast?.length)}>
            <summary className="cursor-pointer select-none text-xs font-medium text-slate-300 py-1">
              คนรอบตัว (ไม่บังคับ) — เช่น พ่อแม่ เพื่อน สัตว์เลี้ยง ที่ออกมาในเรื่องได้
            </summary>
            <div className="space-y-2.5 pt-2.5">
              {(formData.cast || []).map((person, i) => (
                <div key={i} className="rounded-xl border border-slate-700/70 p-2.5 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={person.name}
                      onChange={(e) => setCastField(i, 'name', e.target.value)}
                      maxLength={40}
                      placeholder="ชื่อ เช่น แม่ของฟองฟ้า"
                      className={SMALL_FIELD}
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, cast: formData.cast.filter((_, j) => j !== i) })}
                      title="เอาออก"
                      className="px-2 rounded-lg text-slate-500 hover:text-red-400 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={person.relation}
                    onChange={(e) => setCastField(i, 'relation', e.target.value)}
                    maxLength={100}
                    placeholder="เป็นอะไรกับตัวละคร เช่น แม่, เพื่อนสนิท"
                    className={SMALL_FIELD}
                  />
                  <input
                    type="text"
                    value={person.personality}
                    onChange={(e) => setCastField(i, 'personality', e.target.value)}
                    maxLength={200}
                    placeholder="นิสัยสั้นๆ เช่น ใจดี ขี้บ่น"
                    className={SMALL_FIELD}
                  />
                </div>
              ))}
              {(formData.cast || []).length < MAX_CAST && (
                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, cast: [...(formData.cast || []), { name: '', relation: '', personality: '' }] })
                  }
                  className="w-full py-2 rounded-xl border border-dashed border-slate-600 text-xs text-slate-300 hover:border-purple-500 hover:text-purple-200 transition"
                >
                  + เพิ่มคนรอบตัว
                </button>
              )}
            </div>
          </details>

          <details className="rounded-xl border border-slate-700/70 bg-slate-900/40 px-3 py-2" open={Boolean(editingCharacter?.storyHooks?.length)}>
            <summary className="cursor-pointer select-none text-xs font-medium text-slate-300 py-1">
              เหตุการณ์ในเรื่อง (ไม่บังคับ) — สถานการณ์ที่ AI หยิบมาเล่าให้เรื่องเดินต่อ
            </summary>
            <div className="pt-2.5 space-y-1.5">
              <textarea
                rows={5}
                value={(formData.storyHooks || []).join('\n')}
                onChange={(e) => setFormData({ ...formData, storyHooks: e.target.value.split('\n').slice(0, MAX_HOOKS) })}
                placeholder={'บรรทัดละหนึ่งเรื่อง เช่น\nคืนฝนตก ไฟดับทั้งซอย เธอมาเคาะประตูบ้านคุณ\nเพื่อนสนิทของเธอมาแซวว่าสองคนเหมาะกัน'}
                className={`${SMALL_FIELD} resize-y leading-relaxed`}
              />
              <p className="text-[11px] text-slate-500">ไม่แสดงในหน้าโปรไฟล์ เพื่อให้เป็นเรื่องเซอร์ไพรส์ตอนคุย (สูงสุด {MAX_HOOKS} เรื่อง)</p>
            </div>
          </details>

          {formError && (
            <p role="alert" className="text-xs text-rose-300 bg-rose-950/40 border border-rose-500/30 rounded-xl px-3 py-2">
              {formError}
            </p>
          )}

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
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition"
            >
              {editingCharacter ? 'บันทึกการแก้ไข' : 'สร้างตัวละคร'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
