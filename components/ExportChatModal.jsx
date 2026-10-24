'use client';

import React, { useRef } from 'react';
import { Download, FileText, FileJson, Upload, X } from 'lucide-react';

export default function ExportChatModal({
  isOpen,
  onClose,
  character,
  messageCount,
  onExportText,
  onExportJson,
  onImportJson,
}) {
  const importRef = useRef(null);

  if (!isOpen || !character) return null;

  const handleImportClick = () => {
    importRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so the same file can be picked again
    if (!file) return;
    onClose();
    onImportJson?.(file);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="ส่งออก / นำเข้าแชท"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-slate-800 border border-slate-700/80 rounded-2xl p-5 space-y-4 shadow-2xl relative"
      >
        <button
          onClick={onClose}
          title="ปิด"
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-600/30 border border-purple-500/40 text-purple-300">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">ส่งออก / นำเข้าแชท</h2>
            <p className="text-xs text-slate-400">
              แชทกับ {character.name} ({messageCount} ข้อความ)
            </p>
          </div>
        </div>

        {/* Export section */}
        <div className="space-y-2 pt-1">
          <p className="text-[11px] uppercase tracking-widest text-slate-500 px-1">ส่งออก</p>

          <button
            type="button"
            onClick={() => {
              onExportText();
              onClose();
            }}
            className="w-full p-3 rounded-xl bg-slate-900/80 hover:bg-slate-700/60 border border-slate-700/70 hover:border-purple-500/50 text-left transition flex items-start gap-3 group"
          >
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-200 group-hover:text-purple-200">
                ส่งออกเป็นไฟล์อ่านง่าย (.txt)
              </div>
              <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                จัดรูปแบบบทบรรยายและคำพูดเหมือนนิยาย เหมาะสำหรับอ่านบนมือถือและคอมพิวเตอร์
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onExportJson();
              onClose();
            }}
            className="w-full p-3 rounded-xl bg-slate-900/80 hover:bg-slate-700/60 border border-slate-700/70 hover:border-purple-500/50 text-left transition flex items-start gap-3 group"
          >
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:scale-105 transition">
              <FileJson className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-200 group-hover:text-purple-200">
                ส่งออกเป็นไฟล์สำรองข้อมูล (.json)
              </div>
              <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                เก็บข้อมูลดิบทั้งหมด รวมทั้งหมุด สมุดความทรงจำ และสรุปเรื่องย่อ — นำกลับมากู้คืนได้
              </div>
            </div>
          </button>
        </div>

        {/* Import section */}
        {onImportJson && (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-widest text-slate-500 px-1">นำเข้า</p>

            <button
              type="button"
              onClick={handleImportClick}
              className="w-full p-3 rounded-xl bg-slate-900/80 hover:bg-slate-700/60 border border-slate-700/70 hover:border-amber-500/50 text-left transition flex items-start gap-3 group"
            >
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-105 transition">
                <Upload className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-200 group-hover:text-amber-200">
                  นำเข้าประวัติแชทนี้ (.json)
                </div>
                <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  กู้คืนแชทจากไฟล์สำรองข้อมูลของตัวละครนี้ แชทปัจจุบันจะถูกแทนที่
                </div>
              </div>
            </button>

            {/* Hidden file input */}
            <input
              ref={importRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        <div className="pt-2 border-t border-slate-700/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-700/70 hover:bg-slate-700 text-slate-300 text-sm rounded-xl transition"
          >
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
}
