import { register } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

register('./resolve-loader.mjs', import.meta.url);
const { memoryExcerpt } = await import('../lib/memoryExcerpt.js');
const { suggestionContext, SUGGEST_HISTORY_CHARS, SUGGEST_MAX_MESSAGES } = await import('../lib/suggestionContext.js');
const { cleanChoices, pickChoices } = await import('../lib/choices.js');
const { buildSuggestPrompt, buildSummaryPrompt, buildSystemInstruction } = await import('../lib/prompt.js');

test('preserves the latest state, relationship, facts and recent events within the budget', () => {
  const summary = [
    '[สถานะล่าสุด]',
    '- แผนล่าสุด',
    '[ความสัมพันธ์]',
    '- ความสัมพันธ์ล่าสุด',
    '[ข้อเท็จจริงที่ควรจำ]',
    '- ข้อเท็จจริงสำคัญ',
    '[เหตุการณ์ตามลำดับเวลา]',
    ...Array.from({ length: 60 }, (_, i) => `- เหตุการณ์ ${i}: ${'ก'.repeat(60)}`),
  ].join('\n');
  for (const limit of [1800, 1000]) {
    const result = memoryExcerpt(summary, limit);
    assert.ok(result.length <= limit);
    for (const required of ['แผนล่าสุด', 'ความสัมพันธ์ล่าสุด', 'ข้อเท็จจริงสำคัญ', 'เหตุการณ์ 59']) {
      assert.ok(result.includes(required), required);
    }
    assert.ok(!result.includes('เหตุการณ์ 0:'));
  }
});

test('preserves recent lines in legacy summaries and returns short summaries unchanged', () => {
  const summary = Array.from({ length: 60 }, (_, i) => `- เหตุการณ์ ${i}`).join('\n');
  const result = memoryExcerpt(summary, 120);
  assert.ok(result.length <= 120);
  assert.ok(result.includes('เหตุการณ์ 59'));
  assert.ok(!result.includes('เหตุการณ์ 0'));
  assert.equal(memoryExcerpt('- ข้อมูลเดิม', 120), '- ข้อมูลเดิม');
  assert.equal(memoryExcerpt(null, 120), '');
});

test('handles repeated headings and long lines without losing all sections', () => {
  const summary = [
    '[สถานะล่าสุด]', '- สถานะเก่า',
    '[เหตุการณ์ตามลำดับเวลา]', '- เรื่องเก่า',
    '[สถานะล่าสุด]', `- สถานะใหม่ ${'ก'.repeat(3000)}`,
    '[ความสัมพันธ์]', '- ความสัมพันธ์ใหม่',
    '[ข้อเท็จจริงที่ควรจำ]', '- ข้อเท็จจริงใหม่',
    '[เหตุการณ์ตามลำดับเวลา]', '- เรื่องใหม่',
  ].join('\n');
  const result = memoryExcerpt(summary, 1800);
  assert.ok(result.length <= 1800);
  for (const required of ['สถานะใหม่', 'ความสัมพันธ์ใหม่', 'ข้อเท็จจริงใหม่', 'เรื่องใหม่']) {
    assert.ok(result.includes(required), required);
  }
  assert.ok(result.includes('…'));
});

test('includes unsummarized intermediate turns, without duplicating summarized history', () => {
  const messages = Array.from({ length: 18 }, (_, i) => ({
    role: i % 2 ? 'model' : 'user',
    text: `ข้อความ ${i}`,
  }));
  const context = suggestionContext(messages, 4);
  assert.equal(context.truncated, false);
  assert.equal(context.messages.length, 14);
  assert.equal(context.messages[0].text, 'ข้อความ 4');
  assert.equal(context.messages.at(-1).text, 'ข้อความ 17');
});

test('marks omitted and clipped turns and enforces message and character budgets', () => {
  const many = Array.from({ length: 50 }, (_, i) => ({ role: 'user', text: `ข้อความ ${i}` }));
  const countLimited = suggestionContext(many);
  assert.equal(countLimited.messages.length, SUGGEST_MAX_MESSAGES);
  assert.equal(countLimited.truncated, true);
  const long = Array.from({ length: 20 }, (_, i) => ({ role: 'model', text: `${i}${'ก'.repeat(1499)}` }));
  const charLimited = suggestionContext(long);
  assert.ok(charLimited.messages.reduce((n, m) => n + m.text.length, 0) <= SUGGEST_HISTORY_CHARS);
  assert.equal(charLimited.truncated, true);
  const clipped = suggestionContext([{ role: 'user', text: `${'ก'.repeat(1600)}ท้าย` }]);
  assert.equal(clipped.truncated, true);
  assert.ok(clipped.messages[0].text.endsWith('ท้าย'));
});

test('removes exact duplicates without removing opposite or distinct choices', () => {
  const yes = 'ฉันอยากไปเดินเล่นที่สวนกับเธอเย็นนี้แล้วค่อยแวะกินข้าวด้วยกัน';
  const no = 'ฉันไม่อยากไปเดินเล่นที่สวนกับเธอเย็นนี้แล้วค่อยแวะกินข้าวด้วยกัน';
  const choices = cleanChoices([yes, `${yes}!`, no], {});
  assert.deepEqual(choices, [yes, no]);
  assert.deepEqual(pickChoices(`${yes}\n${yes}\n${no}`, {}, 3), [yes, no]);
  assert.deepEqual(pickChoices(yes, {}, 0), []);
});

test('suggestion prompt marks old memory and missing context and includes player details', () => {
  const prompt = buildSuggestPrompt({
    characterName: 'ตัวละคร',
    userProfile: { name: 'ผู้เล่น', personality: 'ใจเย็น' },
    memorySummary: '- เคยมีแผนไปเที่ยว',
    contextTruncated: true,
    messages: [{ role: 'model', text: 'วันนี้ไปไหนดี' }],
  });
  assert.ok(prompt.includes('ใจเย็น'));
  assert.ok(prompt.includes('สถานะในนี้อาจเปลี่ยนไปแล้ว'));
  assert.ok(prompt.includes('บทสนทนาบางส่วนไม่ได้แสดง'));
  assert.ok(prompt.includes('ห้ามสมมติว่าสถานะเก่ายังคงเป็นปัจจุบัน'));
});

test('summary prompt asks for section headings without contradicting itself', () => {
  const prompt = buildSummaryPrompt({
    characterName: 'ตัวละคร',
    userName: 'ผู้เล่น',
    messages: [{ role: 'user', text: 'นัดเจอกันพรุ่งนี้' }],
  });
  assert.ok(prompt.includes('[สถานะล่าสุด]'));
  assert.ok(prompt.includes('ห้ามเขียนแผนว่าเกิดขึ้นแล้ว'));
  assert.ok(!prompt.includes('ไม่ต้องมีหัวข้อ'));
});

test('chat system instruction keeps structured memory sections when over its limit', () => {
  const summary = [
    '[สถานะล่าสุด]', '- แผนล่าสุด',
    '[ความสัมพันธ์]', '- ความสัมพันธ์ล่าสุด',
    '[ข้อเท็จจริงที่ควรจำ]', '- ข้อเท็จจริงสำคัญ',
    '[เหตุการณ์ตามลำดับเวลา]',
    ...Array.from({ length: 200 }, (_, i) => `- เหตุการณ์ ${i}: ${'ก'.repeat(80)}`),
  ].join('\n');
  const prompt = buildSystemInstruction({
    persona: { name: 'ตัวละคร', description: 'ทดสอบ', greeting: '' },
    memory: summary,
  });
  for (const required of ['แผนล่าสุด', 'ความสัมพันธ์ล่าสุด', 'ข้อเท็จจริงสำคัญ', 'เหตุการณ์ 199']) {
    assert.ok(prompt.includes(required), required);
  }
});

test('met-people section survives truncation and setup text yields to what already happened', async () => {
  const { DEFAULT_CHARACTERS } = await import('../constants/characters.js');
  const summary = [
    '[สถานะล่าสุด]', '- ล่าสุด',
    '[คนที่เคยเจอแล้ว]', '- คุณอรอนงค์: เจอที่งานบอลรูม',
    '[เหตุการณ์ตามลำดับเวลา]',
    ...Array.from({ length: 200 }, (_, i) => `- เหตุการณ์ ${i}: ${'ก'.repeat(80)}`),
  ].join('\n');
  const serena = DEFAULT_CHARACTERS.find((c) => c.id === 'serena');
  const prompt = buildSystemInstruction({
    persona: serena,
    memory: summary,
  });
  assert.ok(prompt.includes('คุณอรอนงค์: เจอที่งานบอลรูม'));
  assert.ok(prompt.includes('ห้ามเล่นซ้ำเป็นครั้งแรก'));
  assert.ok(prompt.includes('ห้ามแนะนำตัวหรือทักเหมือนเจอครั้งแรก'));
  assert.ok(!prompt.includes('พบครอบครัวเป็นครั้งแรก'));
  assert.ok(buildSummaryPrompt({ characterName: 'ก', userName: 'ข', messages: [] }).includes('[คนที่เคยเจอแล้ว]'));
});
