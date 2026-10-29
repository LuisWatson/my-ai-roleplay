const SECTION_PRIORITY = {
  '[สถานะล่าสุด]': 0,
  '[ความสัมพันธ์]': 1,
  '[คนที่เคยเจอแล้ว]': 1,
  '[ข้อเท็จจริงที่ควรจำ]': 2,
  '[เหตุการณ์ตามลำดับเวลา]': 3,
};

// Keep recent lines in each section, rather than assuming structured summaries are chronological throughout.
export function memoryExcerpt(value, maxChars) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || maxChars <= 0) return '';
  if (text.length <= maxChars) return text;

  const lines = text.split(/\r?\n/);
  const groups = [[], [], [], []];
  let section = 3;
  let heading = null;
  let structured = false;
  for (let i = 0; i < lines.length; i++) {
    const key = lines[i].trim();
    if (Object.prototype.hasOwnProperty.call(SECTION_PRIORITY, key)) {
      section = SECTION_PRIORITY[key];
      heading = i;
      structured = true;
    } else if (key) {
      groups[section].push({ index: i, heading });
    }
  }

  if (!structured) {
    const tail = text.slice(-maxChars);
    const start = tail.indexOf('\n');
    return start >= 0 ? tail.slice(start + 1) : tail;
  }

  const selected = new Map();
  const queues = groups.map((group) => group.reverse());
  const render = (items) => [...items].sort(([a], [b]) => a - b).map(([, line]) => line).join('\n');
  const lineLimit = Math.max(1, Math.floor(maxChars / 4));
  while (queues.some((queue) => queue.length)) {
    for (const queue of queues) {
      const item = queue.shift();
      if (!item) continue;
      const candidate = new Map(selected);
      const line = lines[item.index];
      candidate.set(item.index, line.length > lineLimit ? `${line.slice(0, lineLimit - 1)}…` : line);
      if (item.heading !== null) candidate.set(item.heading, lines[item.heading]);
      if (render(candidate).length <= maxChars) {
        candidate.forEach((line, index) => selected.set(index, line));
      }
    }
  }
  return render(selected) || text.slice(-maxChars);
}
