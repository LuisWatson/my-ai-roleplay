'use client';

import React, { useEffect, useRef } from 'react';
import { Play } from 'lucide-react';

// Time-of-day line above the character's name
function greetingFor(date) {
  const h = date.getHours();
  if (h < 5) return 'ดึกแล้ว ยังไม่นอนเหรอ';
  if (h < 11) return 'เช้าแล้ว';
  if (h < 16) return 'ตอนบ่าย';
  if (h < 19) return 'เย็นแล้ว';
  return 'คืนนี้';
}

/**
 * Top of the home screen: the character you talked to last (or a default one) as a layered scene.
 * Planes: room -> big name -> character cut-out -> text. The first three move at different rates while
 * the list scrolls (`scrollRef`), so the character seems to stand in front of the room and the name.
 * Without `cutouts` the portrait fades in from the right instead.
 */
export default function HomeHero({ character, preview, hasChat, onOpen, scrollRef }) {
  const rootRef = useRef(null);
  const cutout = character.cutouts?.main;
  const room = character.background;
  const shortName = character.name.split(' (')[0];

  useEffect(() => {
    const scroller = scrollRef?.current;
    const root = rootRef.current;
    if (!scroller || !root) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let raf = 0;
    const update = () => {
      raf = 0;
      const p = Math.min(1, Math.max(0, scroller.scrollTop / Math.max(1, root.offsetHeight)));
      root.style.setProperty('--p', p.toFixed(3));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrollRef, character.id]);

  return (
    <section
      ref={rootRef}
      style={{ '--p': 0 }}
      className="relative h-[60svh] min-h-[22rem] max-h-[36rem] rounded-2xl overflow-hidden border border-slate-700/50 bg-slate-950"
    >
      {room && (
        <img
          src={room}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-70"
          style={{ transform: 'translate3d(0, calc(var(--p) * 8%), 0) scale(1.06)' }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/40 to-transparent" />

      <div
        aria-hidden="true"
        className="absolute left-5 md:left-10 top-[9%] font-bold leading-none text-white/90 text-[20vw] md:text-[6.5rem] tracking-tight select-none"
        style={{ transform: 'translate3d(0, calc(var(--p) * -18%), 0)', opacity: 'calc(1 - var(--p) * 1.1)' }}
      >
        {shortName}
      </div>

      {cutout ? (
        <img
          src={cutout}
          alt={character.name}
          className="absolute bottom-[-9%] right-[-34%] md:right-[6%] h-[100%] md:h-[104%] w-auto max-w-none"
          style={{ transform: 'translate3d(0, calc(var(--p) * 3%), 0)' }}
        />
      ) : (
        <img
          src={character.avatar}
          alt={character.name}
          className="absolute inset-y-0 right-0 w-[72%] md:w-[48%] h-full object-cover object-top [mask-image:linear-gradient(to_right,transparent,black_40%)]"
          style={{ transform: 'translate3d(0, calc(var(--p) * 3%), 0)' }}
        />
      )}

      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-slate-950/90 to-transparent" />

      <div className="absolute left-5 right-5 md:left-10 bottom-5 md:bottom-8 max-w-md">
        <p className="text-sm text-slate-300">{greetingFor(new Date())}</p>
        <h2 className="mt-1 text-2xl md:text-3xl font-semibold text-white">{character.name}</h2>
        <p className="mt-1 text-sm text-slate-200 line-clamp-2">{character.tagline || character.description}</p>
        {hasChat && preview && <p className="mt-2 text-xs text-slate-400 line-clamp-1">ล่าสุด: {preview}</p>}
        <button
          onClick={() => onOpen(character)}
          className="mt-3 inline-flex items-center gap-2 min-h-11 px-5 rounded-full bg-purple-600 hover:bg-purple-500 active:scale-[0.97] text-white text-sm font-semibold transition"
        >
          <Play className="w-4 h-4 fill-current" />
          {hasChat ? 'คุยต่อ' : 'เริ่มแชท'}
        </button>
      </div>
    </section>
  );
}
