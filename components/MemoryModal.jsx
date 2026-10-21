'use client';

import React, { useEffect, useState } from 'react';
import { Brain, Pin, X, Plus } from 'lucide-react';
import { MAX_PINS, MAX_PIN_CHARS } from '../lib/memory';

const FIELD_CLASS =
  'w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-base md:text-sm focus:outline-none focus:border-purple-500 text-slate-100 placeholder-slate-600 transition';

/**
 * What a character remembers about this chat: facts the user pinned (always sent) and the automatic
 * summary of the older chat (editable, or forgotten so it is rebuilt). `summary` is null while the chat
 * is still short enough to be sent in full.
 */
export default function MemoryModal({ isOpen, onClose, character, summary, pins, onSave, onForgetSummary }) {
  const [draftPins, setDraftPins] = useState([]);
  const [newPin, setNewPin] = useState('');
  const [draftSummary, setDraftSummary] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setDraftPins(pins || []);
    setNewPin('');
    setDraftSummary(summary || '');
  }, [isOpen, pins, summary]);

  if (!isOpen || !character) return null;

  const addPin = () => {
    const text = newPin.trim();
    if (!text || draftPins.length >= MAX_PINS) return;
    setDraftPins([...draftPins, text.slice(0, MAX_PIN_CHARS)]);
    setNewPin('');
  };

  const handleSave = () => {
    const pending = newPin.trim() && draftPins.length < MAX_PINS ? [newPin.trim().slice(0, MAX_PIN_CHARS)] : [];
    onSave({
      pins: [...draftPins, ...pending],
      summary: summary === null ? null : draftSummary.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-slate-800 border border-slate-700/80 rounded-2xl p-5 sm:p-6 w-full max-w-lg space-y-5 max-h-[90dvh] overflow-y-auto shadow-2xl relative">
        <button
          onClick={onClose}
          title="ปิด"
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 text-white pr-8">
          <div className="p-2 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-md shadow-purple-900/30">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold">ความจำของ {character.name}</h2>
            <p className="text-xs text-slate-400">สิ่งที่ตัวละครจำได้จากเรื่องที่คุยกัน</p>
          </div>
        </div>

        {/* Pinned facts */}
        <section className="space-y-2">
          <div className="flex items-center gap-1.5 text-sm font-medium text-slate-200">
            <Pin className="w-4 h-4 text-amber-300" />
            ปักหมุด: เรื่องที่ห้ามลืม
          </div>
          <p className="text-xs text-slate-400">ส่งให้ตัวละครทุกครั้ง และยังอยู่แม้จะล้างแชท</p>
          {draftPins.length > 0 && (
            <ul className="space-y-1.5">
              {draftPins.map((pin, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-xl bg-slate-900/70 border border-slate-700/70 px-3 py-2 text-sm text-slate-100"
                >
                  <span className="flex-1 break-words">{pin}</span>
                  <button
                    onClick={() => setDraftPins(draftPins.filter((_, j) => j !== i))}
                    title="เอาหมุดออก"
                    className="p-0.5 rounded-md text-slate-500 hover:text-red-400 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {draftPins.length < MAX_PINS && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    addPin();
                  }
                }}
                maxLength={MAX_PIN_CHARS}
                placeholder="เช่น วันเกิดของฉันคือ 14 ก.พ."
                className={FIELD_CLASS}
              />
              <button
                onClick={addPin}
                disabled={!newPin.trim()}
                title="ปักหมุด"
                className="px-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white transition disabled:opacity-40"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}
        </section>

        {/* Automatic summary */}
        <section className="space-y-2">
          <div className="text-sm font-medium text-slate-200">เรื่องที่ผ่านมา (สรุปอัตโนมัติ)</div>
          {summary === null ? (
            <p className="text-xs text-slate-400 leading-relaxed rounded-xl bg-slate-900/50 border border-slate-700/60 px-3 py-2.5">
              แชทนี้ยังสั้นอยู่ ตัวละครยังเห็นทุกข้อความ เมื่อคุยยาวขึ้นแอปจะสรุปเรื่องเก่าเก็บไว้ที่นี่ให้เอง
            </p>
          ) : (
            <>
              <p className="text-xs text-slate-400">แอปสรุปให้เองเมื่อแชทยาว แก้ได้ถ้ามีอะไรผิด</p>
              <textarea
                rows={8}
                value={draftSummary}
                onChange={(e) => setDraftSummary(e.target.value)}
                className={`${FIELD_CLASS} resize-y leading-relaxed`}
              />
              <button
                onClick={() => {
                  onForgetSummary();
                  onClose();
                }}
                className="text-xs text-slate-400 hover:text-red-400 transition"
              >
                ล้างสรุปนี้ (แอปจะสรุปใหม่จากแชทเดิม)
              </button>
            </>
          )}
        </section>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-700/60">
          <button onClick={onClose} className="px-4 py-2 bg-slate-700/70 hover:bg-slate-700 text-slate-300 text-sm rounded-xl transition">
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-medium rounded-xl transition shadow-md shadow-purple-900/40"
          >
            บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}
