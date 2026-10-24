/**
 * Helpers for exporting a single character's chat history as readable text or backup JSON.
 */

export function exportChatAsText({ character, userProfile, messages }) {
  const charName = character?.name || 'ตัวละคร';
  const userName = userProfile?.name || 'คุณ';
  const dateStr = new Date().toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const divider = '='.repeat(60);
  const thinDivider = '-'.repeat(60);

  const lines = [
    divider,
    `บันทึกบทสนทนา: ${charName} กับ ${userName}`,
    `วันที่ส่งออก: ${dateStr}`,
    `จำนวนข้อความ: ${messages.length} ข้อความ`,
    divider,
    '',
  ];

  for (const msg of messages) {
    if (msg.scene?.location) {
      lines.push('');
      lines.push(`[สถานที่: ${msg.scene.location}${msg.scene.time ? ` · เวลา: ${msg.scene.time}` : ''}]`);
      lines.push('');
    }

    const speaker = msg.role === 'user' ? userName : charName;
    lines.push(`[${speaker}]`);
    lines.push(msg.text || '');
    if (msg.thought) {
      lines.push(`(ความคิด: ${msg.thought})`);
    }
    lines.push('');
  }

  lines.push(thinDivider);
  lines.push('จบบันทึกบทสนทนา (Botbaat)');
  lines.push(thinDivider);

  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeName = charName.replace(/[\\/:*?"<>|]/g, '_').slice(0, 30);
  link.download = `botbaat-chat-${safeName}-${new Date().toISOString().slice(0, 10)}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportChatAsJson({ character, userProfile, messages, pins, journal, memory, userRole }) {
  const backup = {
    app: 'my-ai-roleplay-single-chat',
    version: 1,
    exportedAt: new Date().toISOString(),
    character: {
      id: character?.id,
      name: character?.name,
      tagline: character?.tagline,
      category: character?.category,
    },
    userProfile: {
      name: userProfile?.name || '',
      callMe: userProfile?.callMe || '',
    },
    userRole: userRole || null,
    messages: messages || [],
    pins: pins || [],
    journal: journal || [],
    memory: memory || null,
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeName = (character?.name || 'chat').replace(/[\\/:*?"<>|]/g, '_').slice(0, 30);
  link.download = `botbaat-chat-${safeName}-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
