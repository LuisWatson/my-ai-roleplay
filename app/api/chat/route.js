import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Handles incoming chat messages and streams responses back from Google Gemini.
 */
export async function POST(req) {
  try {
    const { message, history, persona, apiKey, model: requestedModel } = await req.json();

    const activeKey = process.env.GEMINI_API_KEY || apiKey;

    if (!activeKey) {
      return new Response(
        JSON.stringify({ error: 'ไม่พบ Gemini API Key กรุณาตั้งค่าใน .env.local หรือหน้า Settings' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const genAI = new GoogleGenerativeAI(activeKey);

    const systemInstruction = `
คุณคือตัวละครชื่อ "${persona.name}"
รายละเอียดและบทบาท: ${persona.description}

[กฎการตอบกลับ]:
1. สวมบทบาทเป็น ${persona.name} อย่างเคร่งครัด ห้ามหลุดออกจากบทบาทเด็ดขาด
2. ตอบกลับเป็นภาษาไทยที่เป็นธรรมชาติ สอดคล้องกับบุคลิก
3. บรรยายการกระทำ สีหน้า หรืออารมณ์ ไว้ในวงเล็บดอกจันเสมอ เช่น *(ยิ้มหวานพร้อมจิบกาแฟ)*
4. ให้ตอบกลับสั้นยาวตามความเหมาะสมของบทสนทนา
`;

    // Use requested model or fallback to gemini-1.5-flash for reliability
    const modelName = requestedModel || 'gemini-1.5-flash';
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: systemInstruction,
    });

    // Format previous chat history to match the Gemini SDK structure
    const formattedHistory = (history || []).map((h) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }],
    }));

    // Initialize chat session
    const chat = model.startChat({
      history: formattedHistory,
      generationConfig: {
        temperature: 0.95,
      },
    });

    // Request a streaming response from Gemini
    const resultStream = await chat.sendMessageStream(message);

    // Stream text chunks directly using ReadableStream
    const encoder = new TextEncoder();
    const customStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of resultStream.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
              controller.enqueue(encoder.encode(chunkText));
            }
          }
          controller.close();
        } catch (streamError) {
          console.error('Streaming error during chunk generation:', streamError);
          controller.error(streamError);
        }
      },
    });

    return new Response(customStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('Chat API Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'เกิดข้อผิดพลาดในการประมวลผล' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}