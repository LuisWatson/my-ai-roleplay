// Relationship meters: bond (closeness, affection) and trust, kept as points with no upper limit, plus the
// character's mood. Each reply's scene tag reports how the meters moved (e.g. "ผูกพัน +2, ไว้ใจ 0"); the page
// adds that up and stores the totals on the reply as `relation` { bond, trust, mood }. The latest one is the
// current state and is sent back with the next message, so swipes, edits and deletes stay consistent for free.
// Older replies stored 0–100 values; they simply count as points.

// Most a meter may move in one reply. Trust grows slower than bond and falls harder.
export const RELATION_STEP = {
  bond: { up: 5, down: 10 },
  trust: { up: 3, down: 15 },
};

// An unsigned number bigger than this is an old-style total ("ผูกพัน 72"), not a change
const MAX_UNSIGNED_CHANGE = 15;

// Starting values are on the old 0–100 scale
const MAX_START = 100;

export const RELATION_KEYS = ['bond', 'trust'];

// What a level means, for the model and the profile; levels past the list keep the last name
const LEVEL_NAMES = {
  bond: ['ห่างเหิน', 'เริ่มคุ้นเคย', 'สนิทใจ', 'ผูกพันลึกซึ้ง', 'ขาดกันไม่ได้', 'เป็นส่วนหนึ่งของชีวิตกันและกัน'],
  trust: ['ยังระวังตัว', 'เริ่มวางใจ', 'ไว้ใจ', 'ไว้ใจมาก กล้าเล่าเรื่องส่วนตัว', 'ไว้ใจหมดใจ', 'ฝากชีวิตกันได้'],
};

/**
 * Points → level. Level 1 is 0–19 points and each level needs 10 more points than the one before
 * (20, 30, 40, ...), so the meters keep growing but more slowly. Returns { level, into, size }:
 * points into the current level and how many it holds.
 */
export function levelOf(points) {
  let level = 1;
  let start = 0;
  let size = 20;
  const p = Math.max(0, Number(points) || 0);
  while (p >= start + size) {
    start += size;
    size += 10;
    level += 1;
  }
  return { level, into: p - start, size };
}

export function levelName(key, level) {
  const names = LEVEL_NAMES[key] || [];
  return names[Math.min(level, names.length) - 1] || '';
}

export function latestRelation(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].relation) return messages[i].relation;
  }
  return null;
}

/**
 * New totals from `previous` and what the tag reported (lib/scene.js parseRelation: per meter
 * { n, signed }). With no previous value an unsigned number is the starting point (0–100). After that
 * the number is a change, clamped to RELATION_STEP; a big unsigned number is read as an old-style total.
 * Missing parts keep their previous value.
 */
export function settleRelation(previous, reported) {
  if (!reported) return undefined;
  const meter = (key) => {
    const r = reported[key];
    const prev = previous?.[key];
    if (!r || !Number.isFinite(r.n)) return prev;
    if (!Number.isFinite(prev)) return r.signed ? undefined : Math.max(0, Math.min(MAX_START, r.n));
    const change = r.signed || Math.abs(r.n) <= MAX_UNSIGNED_CHANGE ? r.n : r.n - prev;
    const { up, down } = RELATION_STEP[key];
    return Math.max(0, prev + Math.max(-down, Math.min(up, change)));
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
