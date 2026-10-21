'use client';

import React, { useRef, useEffect } from 'react';
import { ArrowLeft, Trash2, Sparkles } from 'lucide-react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';

/**
 * Main chat container component handling message flow, active persona info, and input controls.
 */
export default function ChatWindow({
  selectedChar,
  onBack,
  messages,
  loading,
  input,
  setInput,
  onSendMessage,
  onClearHistory,
}) {
  const chatEndRef = useRef(null);

  // Auto-scroll to latest message or indicator
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (!selectedChar) {
    return (
      <main className="hidden md:flex flex-1 flex-col items-center justify-center p-6 text-center bg-slate-900/90">
        <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-500/20 mb-4 shadow-inner">
          <Sparkles className="w-10 h-10 text-purple-400 animate-pulse" />
        </div>
        <h3 className="text-xl font-semibold text-slate-200">ยินดีต้อนรับสู่ Khui AI Personal</h3>
        <p className="text-sm max-w-sm mt-2 text-slate-400 leading-relaxed">
          เลือกตัวละครจากแถบด้านซ้ายเพื่อเริ่มต้นสวมบทบาท หรือสร้างตัวละครใหม่ตามจินตนาการของคุณได้ทันที
        </p>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col bg-slate-900/95 relative overflow-hidden">
      {/* Chat Header */}
      <header className="p-3.5 md:p-4 bg-slate-800/70 backdrop-blur-md border-b border-slate-700/80 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="md:hidden p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 transition"
            title="กลับไปหน้ารายชื่อ"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <img
            src={selectedChar.avatar}
            alt={selectedChar.name}
            className="w-10 h-10 rounded-full object-cover border border-purple-400/40 shadow-sm"
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-sm md:text-base text-slate-100">{selectedChar.name}</h2>
              {selectedChar.category && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/40 text-purple-300 border border-purple-500/30">
                  {selectedChar.category}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 truncate max-w-[200px] sm:max-w-md">
              {selectedChar.tagline || selectedChar.description}
            </p>
          </div>
        </div>

        <button
          onClick={onClearHistory}
          title="ล้างประวัติการสนทนา"
          className="p-2 hover:bg-slate-700/60 rounded-lg text-slate-400 hover:text-red-400 transition"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <ChatMessage
            key={idx}
            message={msg}
            avatar={selectedChar.avatar}
            characterName={selectedChar.name}
          />
        ))}

        {loading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex items-start gap-2.5 animate-fadeIn">
            <img
              src={selectedChar.avatar}
              alt={selectedChar.name}
              className="w-8 h-8 rounded-full object-cover mt-1 border border-purple-400/20"
            />
            <div className="bg-slate-800/90 border border-slate-700/80 px-4 py-3 rounded-2xl rounded-tl-none text-slate-300 text-sm flex items-center gap-2 shadow-md">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
              <span className="text-xs text-slate-400">กำลังพิมพ์...</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Message Input Controls */}
      <ChatInput
        input={input}
        setInput={setInput}
        onSendMessage={onSendMessage}
        loading={loading}
        characterName={selectedChar.name}
      />
    </main>
  );
}
