import { register } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

register('./resolve-loader.mjs', import.meta.url);
const { hasVisibleReplyText } = await import('../lib/scene.js');
const {
  canRegenerateReply,
  CHAT_MESSAGE_PAGE_SIZE,
  firstVisibleMessageIndex,
  visibleMessages,
  restoreAfterEmptyReply,
} = await import('../lib/chatHelpers.js');

test('tag-only replies have no visible story, while partial tags do not hide preceding text', () => {
  assert.equal(hasVisibleReplyText('[ฉาก: สถานที่=ห้องรับรอง; เวลา=เย็น]'), false);
  assert.equal(hasVisibleReplyText('เธอหันมามองคุณ\n[ฉาก: สถานที่=ห้องรับรอง; เวลา=เย็น]'), true);
  assert.equal(hasVisibleReplyText('เธอหันมามองคุณ\n[ฉาก:'), true);
  assert.equal(hasVisibleReplyText('  '), false);
});

test('empty final model replies remain eligible for regeneration only after a user turn', () => {
  const messages = [
    { role: 'user', text: 'ส่งข้อความ' },
    { role: 'model', text: '' },
  ];
  assert.equal(canRegenerateReply(messages, 1), true);
  assert.equal(canRegenerateReply(messages, 0), false);
  assert.equal(canRegenerateReply([{ role: 'model', text: '' }], 0), false);
});

test('empty or whitespace-only streaming placeholders are removed and regenerated replies restored', () => {
  const user = { role: 'user', text: 'ส่งข้อความ' };
  const previous = { role: 'model', text: 'คำตอบก่อนหน้า' };
  for (const text of ['', '  \n']) {
    const pending = [user, { role: 'model', text }];
    assert.deepEqual(restoreAfterEmptyReply(pending), [user]);
    assert.deepEqual(restoreAfterEmptyReply(pending, previous), [user, previous]);
  }
  const partial = { role: 'model', text: 'คำตอบบางส่วน' };
  assert.deepEqual(restoreAfterEmptyReply([user, partial]), [user, partial]);
});

test('chat pagination shows the latest page and reveals older pages in fixed increments', () => {
  assert.equal(CHAT_MESSAGE_PAGE_SIZE, 40);
  assert.equal(firstVisibleMessageIndex(100, CHAT_MESSAGE_PAGE_SIZE), 60);
  assert.equal(firstVisibleMessageIndex(100, CHAT_MESSAGE_PAGE_SIZE * 2), 20);
  assert.equal(firstVisibleMessageIndex(20, CHAT_MESSAGE_PAGE_SIZE), 0);
  const messages = Array.from({ length: 100 }, (_, index) => ({ index }));
  assert.deepEqual(visibleMessages(messages, 60).map((message) => message.index), Array.from({ length: 40 }, (_, i) => i + 60));
  assert.equal(visibleMessages(messages, 0).length, messages.length);
});
