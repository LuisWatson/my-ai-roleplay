import { register } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

register('./resolve-loader.mjs', import.meta.url);
const { validateChatRequest } = await import('../lib/chatRequest.js');
const { readFirstStreamText } = await import('../lib/geminiStream.js');
const { tryModels } = await import('../lib/geminiServer.js');

const request = { message: 'สวัสดี', history: [], persona: { name: 'ตัวละคร' } };

test('rejects malformed or incomplete chat requests before any model call', () => {
  for (const body of [
    null, [], {}, { ...request, history: null }, { ...request, history: [null] },
    { ...request, history: [{ role: 'user', text: 10 }] }, { ...request, persona: null },
    { ...request, persona: { name: 123 } }, { ...request, message: null },
  ]) {
    assert.ok(validateChatRequest(body));
  }
  assert.equal(validateChatRequest(request), null);
  assert.equal(validateChatRequest({ ...request, message: '', continueStory: true }), null);
  assert.ok(validateChatRequest({ ...request, continueStory: 'yes' }));
});

test('a stream with no text is treated as a failed model response', async () => {
  const iterator = { async next() { return { done: true }; } };
  await assert.rejects(readFirstStreamText(iterator), { message: 'Empty reply' });
});

test('skips an empty model reply and falls back to the next model', async () => {
  const tried = [];
  const result = await tryModels({
    apiKey: 'empty-stream-test-key',
    models: ['empty-model', 'working-model'],
    perModelMs: 100,
    totalMs: 5000,
    run: async (model) => {
      tried.push(model);
      if (model === 'empty-model') {
        return readFirstStreamText({ async next() { return { done: true }; } });
      }
      return 'reply';
    },
  });
  assert.deepEqual(tried, ['empty-model', 'working-model']);
  assert.equal(result.result, 'reply');
  assert.equal(result.usedModel, 'working-model');
  assert.equal(result.errorResponse, null);
});

test('times out a stalled model and falls back without external API calls', async () => {
  const tried = [];
  const result = await tryModels({
    apiKey: 'timeout-test-key',
    models: ['stalled-model', 'backup-model'],
    perModelMs: 1100,
    totalMs: 5000,
    run: async (model) => {
      tried.push(model);
      if (model === 'stalled-model') return new Promise(() => {});
      return 'reply';
    },
  });
  assert.deepEqual(tried, ['stalled-model', 'backup-model']);
  assert.equal(result.result, 'reply');
  assert.equal(result.usedModel, 'backup-model');
});

test('returns a quota response when every attempted model is exhausted', async () => {
  const result = await tryModels({
    apiKey: 'quota-test-key',
    models: ['quota-model'],
    perModelMs: 100,
    totalMs: 5000,
    run: async () => {
      const error = new Error('daily quota');
      error.status = 429;
      error.errorDetails = [{ retryDelay: '3600s' }];
      throw error;
    },
  });
  assert.equal(result.result, null);
  assert.equal(result.errorResponse.status, 429);
  assert.deepEqual(await result.errorResponse.json(), {
    error: 'quota-model: โควต้าหมด',
    kind: 'quota',
  });
});
