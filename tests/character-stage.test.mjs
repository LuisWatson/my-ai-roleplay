import { register } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

register('./resolve-loader.mjs', import.meta.url);
const { cutoutFor, pictureFor } = await import('../lib/expressions.js');
const { DEFAULT_CHARACTERS } = await import('../constants/characters.js');

const character = { cutouts: { main: '/m.webp', happy: '/h.webp', sad: '/s.webp' } };

test('cutoutFor picks the expression, its fallback, then the main cut-out', () => {
  assert.equal(cutoutFor(character, 'happy'), '/h.webp');
  assert.equal(cutoutFor(character, 'worried'), '/s.webp'); // worried falls back to sad
  assert.equal(cutoutFor(character, 'angry'), '/m.webp');
  assert.equal(cutoutFor(character, null), '/m.webp');
  assert.equal(cutoutFor({}, 'happy'), null);
});

test('Serena expression pictures resolve without optional cut-outs', () => {
  const serena = DEFAULT_CHARACTERS.find((c) => c.id === 'serena');
  assert.equal(serena.cutouts, undefined);
  assert.equal(pictureFor(serena, '😳 อะไรกัน').src, serena.expressions.shy);
  assert.equal(pictureFor(serena, '😊 ยิ้ม').src, serena.expressions.happy);
});
