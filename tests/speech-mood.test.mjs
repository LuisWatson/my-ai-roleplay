import { register } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

register('./resolve-loader.mjs', import.meta.url);
const { parseRoleplayText, speechMoods } = await import('../lib/roleplayFormat.js');
const { pictureOfMood } = await import('../lib/expressions.js');

const TEXT = [
  'เธอเดินนำหน้าไป',
  '{😏} "พูดแบบนี้แสดงว่ามั่นใจมากเลยสินะ?"',
  '*เธอหันมามอง*',
  '{😳} "ระวังเถอะ"',
].join('\n');

test('a face mark before a quote becomes that speech\'s mood and is not shown', () => {
  const paragraphs = parseRoleplayText(TEXT);
  const speech = paragraphs.filter((p) => p.type === 'speech');
  assert.deepEqual(
    speech.map((p) => [p.text, p.mood]),
    [
      ['"พูดแบบนี้แสดงว่ามั่นใจมากเลยสินะ?"', 'teasing'],
      ['"ระวังเถอะ"', 'shy'],
    ]
  );
  assert.ok(paragraphs.every((p) => !p.text.includes('{')));
});

test('speech without a mark carries the previous face, the first one falls back to the thought', () => {
  const paragraphs = parseRoleplayText('"อะไรนะ"\n{😢} "ไม่เอาแล้ว"\n"จริงๆ นะ"');
  assert.deepEqual(speechMoods(paragraphs, 'เอวา', '😊 ดีใจ'), ['happy', 'sad', 'sad']);
  assert.deepEqual(speechMoods(paragraphs, 'เอวา', undefined), [null, 'sad', 'sad']);
});

test('other people\'s speech has no mood and does not change hers', () => {
  const paragraphs = parseRoleplayText('{😳} "ค่ะ"\nแม่: "มานี่สิ"\n"อ่า"');
  assert.deepEqual(speechMoods(paragraphs, 'เอวา', undefined), ['shy', null, 'shy']);
});

test('a mark on a line that is a name\'s speech, a half-streamed mark and a stray mark never show', () => {
  assert.equal(parseRoleplayText('แม่: {😏} "มานี่"')[0].speaker, 'แม่');
  assert.deepEqual(parseRoleplayText('เธอยิ้ม {😳').map((p) => p.text), ['เธอยิ้ม']);
  assert.deepEqual(parseRoleplayText('{🙂} "สวัสดี').map((p) => p.text), ['"สวัสดี"']);
});

test('pictureOfMood returns the expression picture or the main portrait without a key', () => {
  const c = { avatar: '/a.webp', expressions: { happy: '/h.webp', sad: '/s.webp' } };
  assert.deepEqual(pictureOfMood(c, 'happy'), { src: '/h.webp', key: 'happy' });
  assert.deepEqual(pictureOfMood(c, 'worried'), { src: '/s.webp', key: 'sad' });
  assert.deepEqual(pictureOfMood(c, 'angry'), { src: '/a.webp', key: null });
});
