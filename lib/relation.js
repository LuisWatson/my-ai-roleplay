// Relationship meters (WHIF-style): each reply's scene tag may report { bond, trust, mood } (0–100 for the
// numbers). The page stores the settled values on the reply as `relation`; the latest one is the current
// state and is sent back with the next message, so swipes, edits and deletes stay consistent for free.

// Most a meter may move in one reply, so a single line can't swing the relationship
export const MAX_RELATION_STEP = 10;

export function latestRelation(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].relation) return messages[i].relation;
  }
  return null;
}

/**
 * What the model reported, moved at most MAX_RELATION_STEP from `previous` per meter. With no previous
 * value the model picks the starting point. Missing parts keep their previous value.
 */
export function settleRelation(previous, reported) {
  if (!reported) return undefined;
  const meter = (key) => {
    const next = reported[key];
    const prev = previous?.[key];
    if (next === undefined) return prev;
    if (prev === undefined) return next;
    return Math.max(prev - MAX_RELATION_STEP, Math.min(prev + MAX_RELATION_STEP, next));
  };
  const bond = meter('bond');
  const trust = meter('trust');
  const mood = reported.mood || previous?.mood;
  const relation = {
    ...(bond !== undefined && { bond }),
    ...(trust !== undefined && { trust }),
    ...(mood && { mood }),
  };
  return Object.keys(relation).length > 0 ? relation : undefined;
}
