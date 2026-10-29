'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cutoutFor } from '../lib/expressions';

const SCENE_MS = 800;
const MOOD_MS = 550;

/**
 * Layers of one picture slot. A new source is preloaded, then stacked on top of the old one and fades in while the
 * old one stays fully visible underneath (so nothing dips to the background mid-change); the old layer is dropped
 * once the fade is over. The first picture of a slot fades in on its own.
 */
function useLayers(src, ms) {
  const [layers, setLayers] = useState(() => (src ? [{ src, id: 0 }] : []));
  const idRef = useRef(0);

  useEffect(() => {
    if (!src) {
      setLayers([]);
      return undefined;
    }
    let cancelled = false;
    let timer;
    const img = new Image();
    const apply = () => {
      if (cancelled) return;
      setLayers((prev) => (prev.length && prev[prev.length - 1].src === src ? prev : [...prev, { src, id: ++idRef.current }]));
      timer = setTimeout(() => setLayers((prev) => prev.slice(-1)), ms + 150);
    };
    img.onload = apply;
    img.onerror = apply;
    img.src = src;
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [src, ms]);

  return layers;
}

/**
 * Full-chat backdrop for a character with `cutouts` (transparent pictures, one per expression, see
 * `cutoutFor`): the scene sharp behind, the character's current expression centred in front, a light dim on top.
 * Both change with an animation: the scene cross-fades, the character fades in with a slight rise and settle.
 * Sits behind the messages (parent must be `relative isolate`).
 */
export default function CharacterStage({ character, sceneSrc, expression }) {
  const sceneLayers = useLayers(sceneSrc, SCENE_MS);
  const moodLayers = useLayers(cutoutFor(character, expression), MOOD_MS);

  return (
    <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden pointer-events-none bg-slate-950">
      {sceneLayers.map((layer) => (
        <img
          key={layer.id}
          src={layer.src}
          alt=""
          className="absolute inset-0 w-full h-full object-cover scale-105 blur-[3px] brightness-[0.45] animate-stageScene"
        />
      ))}
      {moodLayers.map((layer) => (
        <div key={layer.id} className="absolute inset-0 flex justify-center items-start overflow-hidden animate-stageMood">
          {/* Close-up: wider than the screen on a phone, anchored to the top so the face sits in the upper third and
              the legs run off the bottom under the text; on wide screens it is sized by height instead */}
          <img
            src={layer.src}
            alt=""
            className="max-w-none shrink-0 w-[125%] mt-[6%] md:w-auto md:h-[105%] md:mt-0"
          />
        </div>
      ))}
      {/* Light dim overall, heavy at the bottom where the text is, clear around the face */}
      <div className="absolute inset-0 bg-black/15" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 via-40% to-transparent to-65%" />
    </div>
  );
}
