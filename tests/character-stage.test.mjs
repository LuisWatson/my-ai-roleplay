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

test('every Serena cut-out has a matching expression picture', () => {
  const serena = DEFAULT_CHARACTERS.find((c) => c.id === 'serena');
  assert.ok(serena.cutouts.main);
  for (const key of Object.keys(serena.expressions)) assert.ok(serena.cutouts[key], key);
  assert.equal(cutoutFor(serena, pictureFor(serena, '😳 อะไรกัน').key), serena.cutouts.shy);
});
