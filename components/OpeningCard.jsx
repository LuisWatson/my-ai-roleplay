'use client';

import React from 'react';
import { Clock, MapPin, CloudSun } from 'lucide-react';

/**
 * The scene card that opens a story: time, place and atmosphere (`opening` of a character, see lib/story.js).
 * Shown above the first message of a chat and in the profile sheet.
 */
export default function OpeningCard({ opening, className = '' }) {
  if (!opening) return null;
  const rows = [
    [Clock, 'เวลา', opening.time],
    [MapPin, 'สถานที่', opening.place],
    [CloudSun, 'บรรยากาศ', opening.mood],
  ].filter(([, , value]) => value);

  return (
    <section
      aria-label="ฉากเปิด"
      className={`rounded-2xl border border-violet-400/25 bg-slate-900/70 backdrop-blur-md px-4 py-3.5 space-y-2.5 shadow-lg ${className}`}
    >
      <div className="text-[10px] font-semibold tracking-[0.2em] text-violet-300/80">ฉากเปิด</div>
      {rows.map(([Icon, label, value]) => (
        <div key={label} className="flex items-start gap-2.5">
          <Icon className="w-4 h-4 mt-0.5 flex-shrink-0 text-violet-300/80" />
          <div className="min-w-0">
            <div className="text-[10px] text-slate-400">{label}</div>
            <div className="text-sm text-slate-100 leading-relaxed">{value}</div>
          </div>
        </div>
      ))}
    </section>
  );
}
