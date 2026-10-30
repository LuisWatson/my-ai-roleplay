import { register } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

register('./resolve-loader.mjs', import.meta.url);
const {
  addRawNote, applyCompaction, applyDelta, applyFactsCompaction, applySpeakers, chaptersToCompact, emptyMemoryData, factsToCompact,
  isStructured, nameKeys, parseDelta, renderMemory, speakerCounts, withData,
} = await import('../lib/ledger.js');

const options = { castNames: ['พิมพ์ชนก (พิม)', 'คุณอรอนงค์'], skipNames: ['เซเรน่า', 'หลุย'] };

test('a person keeps every meeting; later batches add to them and never drop them', () => {
  let data = applyDelta(emptyMemoryData(), {
    chapter: 'หลุยพบแม่ที่มื้อค่ำ',
    status: ['ที่ร้านอาหาร'],
    people: [{ name: 'คุณอรอนงค์', role: 'แม่ของเซเรน่า', knows: 'แฟนของเซเรน่า', meetings: ['มื้อค่ำครอบครัว'], told: ['เจอกันที่งานสัมมนาห้วยขวาง'] }],
  }, options);
  data = applyDelta(data, {
    chapter: 'ตรวจไซต์งานกับแม่',
    status: ['ที่ไซต์งาน'],
    people: [{ name: 'อรอนงค์', meetings: ['ตรวจไซต์งาน'] }],
  }, options);
  // a batch that does not mention her at all changes nothing about her
  data = applyDelta(data, { chapter: 'ทำงานที่ออฟฟิศ', status: ['ออฟฟิศ'], people: [] }, options);
  assert.equal(data.people.length, 1);
  assert.deepEqual(data.people[0].meetings, ['มื้อค่ำครอบครัว', 'ตรวจไซต์งาน']);
  assert.equal(data.people[0].role, 'แม่ของเซเรน่า');
  assert.deepEqual(data.people[0].told, ['เจอกันที่งานสัมมนาห้วยขวาง']);
  assert.deepEqual(data.status, ['ออฟฟิศ']);
  assert.equal(data.chapters.length, 3);
});

test('nicknames and titles resolve to the same person, and the character and player are never listed', () => {
  const data = applyDelta(emptyMemoryData(), {
    chapter: 'x',
    people: [{ name: 'พิม', meetings: ['ห้องประชุม'] }, { name: 'พิมพ์ชนก', meetings: ['ลิฟต์'] }, { name: 'เซเรน่า' }, { name: 'คุณหลุย' }, { name: 'คุณวิชัย' }, { name: 'วิชัย' }],
  }, options);
  assert.deepEqual(data.people.map((p) => p.name), ['พิมพ์ชนก (พิม)', 'คุณวิชัย']);
  assert.equal(data.people[0].meetings.length, 2);
  assert.ok(nameKeys('พิมพ์ชนก (พิม)').has('พิม'));
});

test('facts are added once, and removed only when the model names them', () => {
  let data = applyDelta(emptyMemoryData(), { chapter: 'x', facts: ['ชอบลาเต้ไม่หวาน', 'ชอบ ลาเต้ไม่หวาน', 'เกลียดคนผิดนัด'] });
  assert.equal(data.facts.length, 2);
  data = applyDelta(data, { chapter: 'y', facts: [] });
  assert.equal(data.facts.length, 2);
  data = applyDelta(data, { chapter: 'z', removeFacts: ['เกลียดคนผิดนัด'] });
  assert.deepEqual(data.facts, ['ชอบลาเต้ไม่หวาน']);
});

test('a broken or empty report leaves the data as it was', () => {
  const data = applyDelta(emptyMemoryData(), { chapter: 'x', people: [{ name: 'กฤต', meetings: ['งานเลี้ยง'] }], facts: ['ก'] });
  for (const bad of [null, undefined, 'text', {}, { people: 'x', facts: 5 }]) {
    const next = applyDelta(data, bad);
    assert.deepEqual(next, data);
    assert.notEqual(next, data);
  }
  assert.equal(parseDelta('not json'), null);
  assert.equal(parseDelta('{"chapter":""}'), null);
  assert.equal(parseDelta('```json\n{"chapter":"ก","people":[]}\n```').chapter, 'ก');
});

test('rendered text keeps the five headings the chat prompt orders by, and long meeting lists are shortened', () => {
  let data = applyDelta(emptyMemoryData(), {
    chapter: 'เหตุการณ์หนึ่ง',
    status: ['อยู่ที่ห้องทำงาน'],
    relationship: ['เริ่มหวั่นไหว'],
    people: [{ name: 'พิม', role: 'เลขา', knows: 'แฟนเจ้านาย', meetings: ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ'], told: ['เรื่องห้วยขวาง'] }],
    facts: ['ชอบลาเต้ไม่หวาน'],
  });
  data = applyDelta(data, { chapter: 'อีกวัน', people: [{ name: 'พิม', meetings: ['ช'] }] });
  const text = renderMemory(data);
  const headings = ['[สถานะล่าสุด]', '[ความสัมพันธ์]', '[คนที่เคยเจอแล้ว]', '[ข้อเท็จจริงที่ควรจำ]', '[เหตุการณ์ตามลำดับเวลา]'];
  headings.forEach((h, i) => assert.ok(text.includes(h), h) && i);
  assert.ok(text.includes('เจอ 7 ครั้ง: ก, ข … จ, ฉ, ช'));
  assert.ok(text.includes('รู้จักผู้เล่นในฐานะ แฟนเจ้านาย'));
  assert.ok(text.includes('เรื่องที่เล่า/ตอบเขาไปแล้ว: เรื่องห้วยขวาง'));
});

test('structured data counts only while the text is unedited', () => {
  const memory = withData({ covered: 3, hash: 'h' }, applyDelta(emptyMemoryData(), { chapter: 'x' }));
  assert.equal(isStructured(memory), true);
  assert.equal(isStructured({ ...memory, summary: 'แก้เอง' }), false);
  assert.equal(isStructured({ summary: 'plain', covered: 1, hash: 'h' }), false);
});

test('old event notes fold into one only when over budget, and a longer fold is refused', () => {
  const big = 'ก'.repeat(2200);
  const longLine = `- ${'ก'.repeat(290)}`;
  let data = { ...emptyMemoryData(), chapters: [`- ${big}`, `- ${big}`, `- ${big}`] };
  const pair = chaptersToCompact(data);
  assert.deepEqual(pair, [data.chapters[0], data.chapters[1]]);
  assert.equal(chaptersToCompact({ ...emptyMemoryData(), chapters: ['- a', '- b', '- c'] }), null);
  assert.equal(applyCompaction(data, Array(20).fill(longLine).join('\n')), data);
  data = applyCompaction(data, '- รวมแล้ว\n- สั้น');
  assert.equal(data.chapters.length, 2);
  assert.equal(data.chapters[0], '- รวมแล้ว\n- สั้น');
});

test('a message Google will not summarize is kept as its own note', () => {
  const data = addRawNote(emptyMemoryData(), { role: 'user', text: 'ข้อความ' }, 'เซเรน่า');
  assert.deepEqual(data.chapters, ['- (คู่สนทนา) ข้อความ']);
});

test('who speaks is counted by the code, so a cast member is known even when the model forgot to report them', () => {
  const cast = [{ name: 'คุณอรอนงค์', relation: 'แม่ของเซเรน่า ประธานกรรมการโรงแรม อายุ 52 ปี' }, { name: 'พิมพ์ชนก (พิม)', relation: 'เลขาส่วนตัว' }];
  const messages = [
    { role: 'model', text: '*เซเรน่ามองไปที่ประตู*\n\nคุณอรอนงค์: "มากันแล้วเหรอ"\nพิม: "สวัสดีค่ะ"' },
    { role: 'user', text: 'คุณอรอนงค์: ไม่นับ เพราะเป็นข้อความผู้เล่น' },
    { role: 'model', text: 'คุณอรอนงค์: "ไปกันเถอะ"\n"บทพูดเซเรน่า: ไม่ใช่ป้ายชื่อ"' },
  ];
  assert.equal(speakerCounts(messages).get('คุณอรอนงค์'), 2);
  const data = applySpeakers(emptyMemoryData(), messages, { cast, skipNames: ['เซเรน่า', 'หลุย'] });
  const mother = data.people.find((p) => p.name === 'คุณอรอนงค์');
  assert.equal(mother.spoke, 2);
  assert.equal(mother.role, 'แม่ของเซเรน่า');
  assert.equal(data.people.find((p) => p.name === 'พิมพ์ชนก (พิม)').spoke, 1);
  // counts add up over batches and attach to the person the model already reported
  const reported = applyDelta(emptyMemoryData(), { chapter: 'x', people: [{ name: 'อรอนงค์', role: 'ประธาน' }] }, { castNames: ['คุณอรอนงค์'] });
  const again = applySpeakers(applySpeakers(reported, messages, { cast }), messages, { cast });
  assert.equal(again.people.filter((p) => p.name.includes('อรอนงค์')).length, 1);
  assert.equal(again.people.find((p) => p.name.includes('อรอนงค์')).spoke, 4);
  assert.ok(renderMemory(again).includes('พูดในฉาก 4 ข้อความ'));
});

test('groups and "not known" answers are not kept as people', () => {
  const data = applyDelta(emptyMemoryData(), {
    chapter: 'x',
    people: [{ name: 'คณะกรรมการบอร์ด', meetings: ['ประชุม'] }, { name: 'ทีมกฎหมาย' }, { name: 'คุณวิชัย', knows: 'ไม่ระบุ', meetings: ['ไซต์งาน'] }],
  });
  assert.deepEqual(data.people.map((p) => p.name), ['คุณวิชัย']);
  assert.equal(data.people[0].knows, '');
});

test('facts that outgrow their budget are folded only into a shorter list', () => {
  const facts = Array.from({ length: 14 }, (_, i) => `ข้อเท็จจริง ${i} ${'ก'.repeat(260)}`);
  const data = { ...emptyMemoryData(), facts };
  assert.deepEqual(factsToCompact(data), facts);
  assert.equal(factsToCompact({ ...emptyMemoryData(), facts: ['สั้น'] }), null);
  assert.equal(applyFactsCompaction(data, '- เหลือข้อเดียว'), data);
  const folded = applyFactsCompaction(data, Array.from({ length: 6 }, (_, i) => `- รวม ${i}`).join('\n'));
  assert.equal(folded.facts.length, 6);
});

test('a person\'s role is set once; a later vaguer answer does not overwrite it, but what they know can change', () => {
  let data = applyDelta(emptyMemoryData(), { chapter: 'x', people: [{ name: 'คุณอรอนงค์', role: 'แม่ของเซเรน่า', knows: 'แฟนปลอม' }] });
  data = applyDelta(data, { chapter: 'y', people: [{ name: 'คุณอรอนงค์', role: 'บุคคลที่ถูกกล่าวถึง', knows: 'แฟนจริง' }] });
  assert.equal(data.people[0].role, 'แม่ของเซเรน่า');
  assert.equal(data.people[0].knows, 'แฟนจริง');
});
