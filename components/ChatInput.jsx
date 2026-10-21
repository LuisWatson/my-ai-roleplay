'use client';

import React from 'react';
import { Send, Square } from 'lucide-react';

/**
 * Chat input component allowing users to send messages to the active persona.
 */
export default function ChatInput({ input, setInput, onSendMessage, onStop, loading, characterName }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  return (
    <div className="p-3 md:p-4 bg-slate-800/50 backdrop-blur-md border-t border-slate-700/60">
      <div className="flex items-center gap-2 max-w-4xl mx-auto">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          placeholder={`พิมพ์ข้อความคุยกับ ${characterName || 'ตัวละคร'}...`}
          className="flex-1 bg-slate-900/90 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-slate-100 placeholder-slate-500 transition-all disabled:opacity-50"
        />
        {loading ? (
          <button
            onClick={onStop}
            title="หยุดตอบ"
            className="p-3 bg-slate-700 hover:bg-red-600/80 text-white rounded-xl transition flex-shrink-0"
          >
            <Square className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={onSendMessage}
            disabled={!input.trim()}
            title="ส่งข้อความ"
            className="p-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition shadow-lg shadow-purple-900/30 flex-shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
