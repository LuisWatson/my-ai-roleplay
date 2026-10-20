'use client';

import React, { useState } from 'react';
import { Key, Eye, EyeOff, X } from 'lucide-react';

/**
 * Settings modal for configuring the user's Google Gemini API Key and preferences.
 */
export default function SettingsModal({ isOpen, onClose, apiKey, onSaveApiKey }) {
  const [localKey, setLocalKey] = useState(apiKey || '');
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveApiKey(localKey.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-slate-800 border border-slate-700/80 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-white">
          <div className="p-2 rounded-lg bg-purple-900/50 border border-purple-500/30">
            <Key className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-base font-bold">ตั้งค่า Gemini API Key</h2>
            <p className="text-xs text-slate-400">กำหนดคีย์ส่วนตัวสำหรับการเชื่อมต่อโมเดล</p>
          </div>
        </div>

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
