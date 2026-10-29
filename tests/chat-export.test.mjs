import { register } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

register('./resolve-loader.mjs', import.meta.url);
const { exportChatAsText, exportChatAsJson } = await import('../lib/chatExport.js');

test('exports Verse-branded files without changing the backup format', async () => {
  const originalDocument = globalThis.document;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const downloads = [];
  let blob;
  globalThis.document = {
    createElement() {
      return { click() { downloads.push({ name: this.download, blob }); } };
    },
  };
  URL.createObjectURL = (value) => { blob = value; return 'blob:test'; };
  URL.revokeObjectURL = () => {};

  try {
    const data = {
      character: { id: 'test', name: 'Test/Character' },
      userProfile: { name: 'User' },
      messages: [{ role: 'model', text: 'Hello' }],
    };
    exportChatAsText(data);
    exportChatAsJson(data);

    assert.match(downloads[0].name, /^verse-chat-Test_Character-\d{4}-\d{2}-\d{2}\.txt$/);
    assert.match(await downloads[0].blob.text(), /จบบันทึกบทสนทนา \(Verse\)/);
    assert.match(downloads[1].name, /^verse-chat-Test_Character-\d{4}-\d{2}-\d{2}\.json$/);
    const backup = JSON.parse(await downloads[1].blob.text());
    assert.equal(backup.app, 'my-ai-roleplay-single-chat');
    assert.equal(backup.version, 1);
    assert.deepEqual(backup.messages, data.messages);
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  }
});
