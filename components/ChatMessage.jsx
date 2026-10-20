'use client';

import React from 'react';

/**
 * Format message text to style action and emotion narrations enclosed in asterisks *(action)*.
 * @param {string} text - Raw message string
 * @returns {React.ReactNode[]} Formatted elements
 */
export function formatRoleplayText(text) {
  if (!text) return null;
  const parts = text.split(/(\*.*?\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <span
          key={index}
          className="italic text-purple-300 font-light block my-1 bg-purple-950/20 px-2 py-0.5 rounded border-l-2 border-purple-500/50"
        >
          {part.slice(1, -1)}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

/**
 * Renders an individual chat message item.
 */
export default function ChatMessage({ message, avatar, characterName }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex items-start gap-2.5 transition-all ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <img
          src={avatar}
          alt={characterName || 'Character Avatar'}
          className="w-8 h-8 rounded-full object-cover mt-1 border border-purple-400/30 flex-shrink-0 shadow-sm"
        />
      )}

      <div
        className={`max-w-[85%] md:max-w-[70%] p-3.5 rounded-2xl text-sm leading-relaxed transition-all shadow-md ${
          isUser
            ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-tr-none'
            : 'bg-slate-800/90 border border-slate-700/80 text-slate-100 rounded-tl-none backdrop-blur-sm'
        }`}
      >
        {formatRoleplayText(message.text)}
      </div>
    </div>
  );
}
