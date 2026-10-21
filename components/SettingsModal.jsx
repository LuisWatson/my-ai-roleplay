'use client';

import React, { useState, useEffect } from 'react';
import { Key, Eye, EyeOff, X, User, Sliders } from 'lucide-react';
import { AVAILABLE_MODELS } from '../constants/models';

/**
 * Settings modal for configuring the user's Persona/Profile and Google Gemini API credentials.
 */
export default function SettingsModal({
  isOpen,
  onClose,
  apiKey,
  onSaveApiKey,
  model,
  onSaveModel,
  userProfile,
  onSaveUserProfile,
}) {
  const [activeTab, setActiveTab] = useState('persona'); // 'persona' | 'api'
  const [localKey, setLocalKey] = useState(apiKey || '');
  const [localModel, setLocalModel] = useState(model);
  const [showPassword, setShowPassword] = useState(false);

  // Local state for user persona
  const [localProfile, setLocalProfile] = useState({
    name: '',
    callMe: '',
    description: '',
  });

  // Sync state whenever modal opens or props change
  useEffect(() => {
    if (isOpen) {
      setLocalKey(apiKey || '');
      setLocalModel(model);
      setLocalProfile({
        name: userProfile?.name || '',
        callMe: userProfile?.callMe || '',
        description: userProfile?.description || '',
      });
    }
  }, [isOpen, apiKey, model, userProfile]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveApiKey(localKey.trim());
    onSaveModel(localModel);
    if (onSaveUserProfile) {
      onSaveUserProfile(localProfile);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-slate-800 border border-slate-700/80 rounded-2xl p-6 w-full max-w-lg space-y-5 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 text-white">
          <div className="p-2 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-md shadow-purple-900/30">
            <Sliders className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold">การตั้งค่าระบบ</h2>
            <p className="text-xs text-slate-400">ปรับแต่งตัวตนของคุณและการเชื่อมต่อโมเดล AI</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-700/80 gap-2">
          <button
            onClick={() => setActiveTab('persona')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'persona'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span>โปรไฟล์ผู้ใช้ (User Persona)</span>
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'api'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>API Key & โมเดล</span>
          </button>
        </div>

        {/* Tab 1: User Persona */}
        {activeTab === 'persona' && (
          <div className="space-y-3.5">
            <p className="text-xs text-slate-400 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-700/50">
              กำหนดข้อมูลและตัวตนของคุณเพื่อให้ตัวละคร AI รู้จัก สวมบทบาทได้แนบเนียน และเรียกชื่อคุณได้อย่างเป็นธรรมชาติ
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  ชื่อหรือชื่อเล่นของคุณ
                </label>
                <input
                  type="text"
                  value={localProfile.name}
                  onChange={(e) => setLocalProfile({ ...localProfile, name: e.target.value })}
                  placeholder="เช่น บาส, Luis"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500 text-slate-100 placeholder-slate-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  คำที่อยากให้ AI เรียกคุณ
                </label>
                <input
                  type="text"
                  value={localProfile.callMe}
                  onChange={(e) => setLocalProfile({ ...localProfile, callMe: e.target.value })}
                  placeholder="เช่น พี่บาส, แก, ที่รัก"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500 text-slate-100 placeholder-slate-600 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                บุคลิก / ความสัมพันธ์ของคุณกับตัวละคร
              </label>
              <textarea
                rows={3}
                value={localProfile.description}
                onChange={(e) => setLocalProfile({ ...localProfile, description: e.target.value })}
                placeholder="เช่น เป็นโปรแกรมเมอร์ใจดี ชอบแกล้งกลับ สนิทกันมาหลายปี หรือเป็นแฟนที่คอยเอาใจใส่..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:border-purple-500 text-slate-100 placeholder-slate-600 transition resize-none"
              />
            </div>
          </div>
        )}

        {/* Tab 2: Gemini API Key */}
        {activeTab === 'api' && (
          <div className="space-y-3.5">
            <p className="text-xs text-slate-400 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-700/50">
              หากเว้นว่างไว้ ระบบจะเรียกใช้ค่า <code className="text-purple-300 font-mono">GEMINI_API_KEY</code> จากไฟล์ <code className="text-purple-300 font-mono">.env.local</code> โดยอัตโนมัติ
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Google Gemini API Key</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={localKey}
                  onChange={(e) => setLocalKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-slate-100 placeholder-slate-600 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">โมเดล Gemini</label>
              <select
                value={localModel}
                onChange={(e) => setLocalModel(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500 text-slate-100 transition"
              >
                {AVAILABLE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">หากโมเดลที่เลือกใช้ไม่ได้ ระบบจะสลับไปโมเดลสำรองอัตโนมัติ</p>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-700/60">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700/70 hover:bg-slate-700 text-slate-300 text-sm rounded-xl transition"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-medium rounded-xl transition shadow-md shadow-purple-900/40"
          >
            บันทึกการตั้งค่า
          </button>
        </div>
      </div>
    </div>
  );
}
