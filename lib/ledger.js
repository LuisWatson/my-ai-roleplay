// Structured long-term memory. Instead of asking a model to rewrite the whole summary after every batch (which
// slowly wore early facts away: who the player had met, which story had been told to whom), the model only reports
// what the NEW batch added, and this code merges it. Nothing is ever deleted unless the model names a fact that
// stopped being true. The text the chat model reads is rendered from the data, under the same five headings the
// free-text summary used (lib/memoryExcerpt.js orders by them).
//
// data = {
//   people:       [{ name, aliases[], role, meetings[], knows, told[] }],   who the player met, and what they know
//   facts:        [string],                                                  durable facts, promises, told stories
//   relationship: [string],                                                  current relationship (replaced)
//   status:       [string],                                                  latest place/plans (replaced)
//   chapters:     [string],                                                  event notes, oldest first, "- " lines
// }
// A memory object { summary, covered, hash, data, rendered } is "structured" while summary === rendered; once the
// user edits the summary by hand the data is stale and the plain-text path takes over.

import { castRoleFor } from './roleplayFormat';

export const CHAPTERS_MAX_CHARS = 4000;
export const FACTS_MAX_CHARS = 3000;
const MAX_FACTS = 80;
const MAX_TOLD = 12;
const SHOWN_MEETINGS_HEAD = 2;
const SHOWN_MEETINGS_TAIL = 3;
const LINE_MAX = 300;

export const emptyMemoryData = () => ({ people: [], facts: [], relationship: [], status: [], chapters: [] });

const clean = (value, max = LINE_MAX) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').replace(/^[-•*]\s*/, '').trim().slice(0, max) : '';
const cleanList = (value, max, len = LINE_MAX) => (Array.isArray(value) ? value.map((v) => clean(v, len)).filter(Boolean).slice(0, max) : []);
const sameText = (a, b) => a.replace(/\s+/g, '') === b.replace(/\s+/g, '');

const GROUP_NAME = /^(คณะ|ทีม|ฝ่าย|กลุ่ม|ตัวแทน|พนักงาน|ผู้ถือหุ้น|ผู้เข้าร่วม)/;
const NOT_KNOWN = /^(ไม่ระบุ|ไม่ทราบ|ไม่มี|unknown|n\/a|-)/i;
const TITLES =/^(คุณ|นาย|นาง|นางสาว|น\.ส\.|ท่าน|พี่|น้อง)/;
// "พิมพ์ชนก (พิม)" → keys {พิมพ์ชนก, พิม}; "คุณวิชัย" → {วิชัย}. Two names are the same person when keys overlap.
export function nameKeys(name) {
  const text = clean(name, 80);
  const keys = new Set();
  const add = (part) => {
    const k = part.replace(/[()\s]/g, '').replace(TITLES, '').toLowerCase();
    if (k) keys.add(k);
  };
  const inner = [...text.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]);
  add(text.replace(/\([^)]*\)/g, ''));
  inner.forEach(add);
  return keys;
}
// Same person when a key is shared, or one key contains the other ("อานนท์" / "อาอานนท์") and is 3+ letters long
const overlaps = (a, b) =>
  [...a].some((x) => [...b].some((y) => x === y || (Math.min(x.length, y.length) >= 3 && (x.includes(y) || y.includes(x)))));

const copy = (data) => ({
  people: (data?.people || []).map((p) => ({ ...p, aliases: [...(p.aliases || [])], meetings: [...(p.meetings || [])], told: [...(p.told || [])] })),
  facts: [...(data?.facts || [])],
  relationship: [...(data?.relationship || [])],
  status: [...(data?.status || [])],
  chapters: [...(data?.chapters || [])],
});

const personKeys = (p) => new Set([...nameKeys(p.name), ...(p.aliases || []).flatMap((a) => [...nameKeys(a)])]);

/**
 * Applies what a model reported for one batch to `data` and returns the new data (the old one is untouched).
 * `delta`: { chapter, status[], relationship[], people[{ name, role, knows, meetings[], told[] }], facts[], removeFacts[] }
 * `castNames`: the character's supporting cast, so "พิม" and "พิมพ์ชนก (พิม)" end up as one person.
 * `skipNames`: the character and the player (never listed as people they met).
 */
export function applyDelta(data, delta, { castNames = [], skipNames = [] } = {}) {
  const next = copy(data);
  if (!delta || typeof delta !== 'object') return next;
  const skip = new Set(skipNames.flatMap((n) => [...nameKeys(n)]));
  const cast = castNames.map((name) => ({ name, keys: nameKeys(name) }));

  for (const d of Array.isArray(delta.people) ? delta.people : []) {
    const name = clean(d?.name, 80);
    if (!name) continue;
    const keys = nameKeys(name);
    if (overlaps(keys, skip)) continue;
    const castHit = cast.find((c) => overlaps(keys, c.keys));
    // Groups ("คณะกรรมการ", "ทีมกฎหมาย") are not someone the player met; the chapters already tell about them
    if (!castHit && GROUP_NAME.test(name)) continue;
    let person = next.people.find((p) => overlaps(personKeys(p), keys) || (castHit && overlaps(personKeys(p), castHit.keys)));
    if (!person) {
      person = { name: castHit ? clean(castHit.name, 80) : name, aliases: [], role: '', meetings: [], knows: '', told: [] };
      next.people.push(person);
    }
    if (!sameText(person.name, name) && !person.aliases.some((a) => sameText(a, name))) person.aliases.push(name);
    const role = clean(d.role, 120);
    if (role) person.role = role;
    const knows = clean(d.knows, 160);
    if (knows && !NOT_KNOWN.test(knows)) person.knows = knows;
    for (const m of cleanList(d.meetings, 6)) {
      if (!person.meetings.some((x) => sameText(x, m))) person.meetings.push(m);
    }
    for (const t of cleanList(d.told, 4, 140)) {
      if (!person.told.some((x) => sameText(x, t))) person.told.push(t);
    }
    person.told = person.told.slice(-MAX_TOLD);
  }

  const removed = cleanList(delta.removeFacts, 10);
  if (removed.length) next.facts = next.facts.filter((f) => !removed.some((r) => sameText(f, r)));
  for (const f of cleanList(delta.facts, 5, 200)) {
    if (!next.facts.some((x) => sameText(x, f))) next.facts.push(f);
  }
  next.facts = next.facts.slice(-MAX_FACTS);

  const relationship = cleanList(delta.relationship, 6);
  if (relationship.length) next.relationship = relationship;
  const status = cleanList(delta.status, 8);
  if (status.length) next.status = status;

  const chapterLines = String(delta.chapter || '')
    .split(/\r?\n/)
    .map((l) => clean(l, 400))
    .filter(Boolean);
  if (chapterLines.length) next.chapters.push(chapterLines.map((l) => `- ${l}`).join('\n'));
  return next;
}

// Who speaks in these messages, counted by the code itself ("คุณอรอนงค์: ..." lines of the character's replies), so
// that having met someone never depends on a model remembering to report it. label → number of replies they speak in.
export function speakerCounts(messages) {
  const counts = new Map();
  for (const m of messages || []) {
    if (m?.role !== 'model') continue;
    const labels = new Set();
    for (const line of String(m.text || '').split(/\r?\n/)) {
      const hit = line.match(/^\s*([^\s:*"“{[][^:*"“\n]{0,28}?)\s*:\s*\S/);
      if (hit) labels.add(hit[1].trim());
    }
    for (const label of labels) counts.set(label, (counts.get(label) || 0) + 1);
  }
  return counts;
}

/**
 * Adds each speaker's reply count to their person (`spoke`). A supporting-cast member who speaks but was not reported
 * is added with the role the cast gives. `cast`: [{ name, relation }]; others who speak are left to the model's report.
 */
export function applySpeakers(data, messages, { cast = [], skipNames = [] } = {}) {
  const next = copy(data);
  const skip = new Set(skipNames.flatMap((n) => [...nameKeys(n)]));
  const castKeys = cast.filter((c) => typeof c?.name === 'string').map((c) => ({ ...c, keys: nameKeys(c.name) }));
  for (const [label, count] of speakerCounts(messages)) {
    const keys = nameKeys(label);
    if (!keys.size || overlaps(keys, skip)) continue;
    const castHit = castKeys.find((c) => overlaps(keys, c.keys));
    let person = next.people.find((p) => overlaps(personKeys(p), keys) || (castHit && overlaps(personKeys(p), castHit.keys)));
    if (!person && castHit) {
      person = { name: clean(castHit.name, 80), aliases: [], role: castRoleFor(castHit.name, cast) || '', meetings: [], knows: '', told: [], spoke: 0 };
      next.people.push(person);
    }
    if (person) person.spoke = (person.spoke || 0) + count;
  }
  return next;
}

// One message Google would not summarize: keep a short raw note of it as its own chapter
export function addRawNote(data, message, characterName) {
  const next = copy(data);
  const who = message?.role === 'user' ? 'คู่สนทนา' : characterName || 'ตัวละคร';
  const text = String(message?.text || '').replace(/\s+/g, ' ').trim();
  if (text) next.chapters.push(`- (${who}) ${text.slice(0, 300)}${text.length > 300 ? '…' : ''}`);
  return next;
}

const meetingsText = (meetings) => {
  const n = meetings.length;
  const shown = n <= SHOWN_MEETINGS_HEAD + SHOWN_MEETINGS_TAIL
    ? meetings.join(', ')
    : `${meetings.slice(0, SHOWN_MEETINGS_HEAD).join(', ')} … ${meetings.slice(-SHOWN_MEETINGS_TAIL).join(', ')}`;
  return `เจอ ${n} ครั้ง: ${shown}`;
};

// The text the chat model reads
export function renderMemory(data) {
  const d = data || emptyMemoryData();
  const lines = (list) => list.map((l) => `- ${l}`).join('\n');
  const people = (d.people || []).map((p) => {
    const parts = [
      `${p.name}${p.role ? `: ${p.role}` : ''}`,
      p.meetings?.length ? meetingsText(p.meetings) : '',
      p.spoke ? `ได้พบและคุยกับผู้เล่นแล้ว (พูดในฉาก ${p.spoke} ข้อความ)` : '',
      p.knows ? `รู้จักผู้เล่นในฐานะ ${p.knows}` : '',
      p.told?.length ? `เรื่องที่เล่า/ตอบเขาไปแล้ว: ${p.told.join('; ')}` : '',
    ].filter(Boolean);
    return `- ${parts.join(' | ')}`;
  });
  const sections = [
    ['[สถานะล่าสุด]', lines(d.status || [])],
    ['[ความสัมพันธ์]', lines(d.relationship || [])],
    ['[คนที่เคยเจอแล้ว]', people.join('\n')],
    ['[ข้อเท็จจริงที่ควรจำ]', lines(d.facts || [])],
    ['[เหตุการณ์ตามลำดับเวลา]', (d.chapters || []).join('\n')],
  ];
  return sections.filter(([, body]) => body).map(([h, body]) => `${h}\n${body}`).join('\n\n');
}

// A memory object whose structured data still matches the text the chat model reads (the user has not edited it)
export function isStructured(memory) {
  return Boolean(memory?.data && typeof memory.rendered === 'string' && memory.rendered === memory.summary);
}

export const withData = (memory, data) => {
  const summary = renderMemory(data);
  return { ...memory, summary, data, rendered: summary };
};

const chaptersLength = (data) => data.chapters.reduce((sum, c) => sum + c.length, 0);

// The two oldest chapters to merge into one when the event notes outgrow their budget, else null
export function chaptersToCompact(data) {
  if (data.chapters.length < 3 || chaptersLength(data) <= CHAPTERS_MAX_CHARS) return null;
  return [data.chapters[0], data.chapters[1]];
}

// Replaces the two oldest chapters with `merged` (kept only if it really is shorter)
export function applyCompaction(data, merged) {
  const lines = String(merged || '')
    .split(/\r?\n/)
    .map((l) => clean(l, 400))
    .filter(Boolean);
  const text = lines.map((l) => `- ${l}`).join('\n');
  const old = data.chapters[0].length + data.chapters[1].length;
  if (!text || text.length >= old) return data;
  const next = copy(data);
  next.chapters.splice(0, 2, text);
  return next;
}

// The facts list when it has outgrown its budget (the model folds it into fewer, shorter lines), else null
export function factsToCompact(data) {
  const chars = data.facts.reduce((sum, f) => sum + f.length, 0);
  return data.facts.length >= 12 && chars > FACTS_MAX_CHARS ? data.facts : null;
}

// Replaces the facts with the folded list (kept only if it is shorter and not nearly empty)
export function applyFactsCompaction(data, folded) {
  const lines = cleanList(String(folded || '').split(/\r?\n/), MAX_FACTS, 200);
  const old = data.facts.reduce((sum, f) => sum + f.length, 0);
  if (lines.length < 5 || lines.reduce((sum, f) => sum + f.length, 0) >= old) return data;
  const next = copy(data);
  next.facts = lines;
  return next;
}

// Tolerant JSON read of a model reply (code fences, text around the object)
export function parseDelta(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return parsed && typeof parsed === 'object' && typeof parsed.chapter === 'string' && parsed.chapter.trim() ? parsed : null;
  } catch {
    return null;
  }
}
