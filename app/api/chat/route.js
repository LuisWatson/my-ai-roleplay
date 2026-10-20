import { GoogleGenerativeAI } from '@google/generative-ai';

const CANDIDATE_MODELS = ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest'];

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
ประโยคที่คุณได้ทักทายผู้ใช้ไปตอนแรกคือ: "${persona.greeting || ''}"

[กฎการตอบกลับ]:
1. สวมบทบาทเป็น ${persona.name} อย่างเคร่งครัด ห้ามหลุดออกจากบทบาทเด็ดขาด
2. ตอบกลับเป็นภาษาไทยที่เป็นธรรมชาติ สอดคล้องกับบุคลิก
3. บรรยายการกระทำ สีหน้า หรืออารมณ์ ไว้ในวงเล็บดอกจันเสมอ เช่น *(ยิ้มหวานพร้อมจิบกาแฟ)*
4. ให้ตอบกลับสั้นยาวตามความเหมาะสมของบทสนทนา
`;

    // Ensure chat history conforms to Gemini SDK requirements:
    // 1. First message must be from 'user'
    // 2. Roles must strictly alternate between 'user' and 'model'
    let rawHistory = (history || []).filter((h) => h.text && h.text.trim().length > 0);
    while (rawHistory.length > 0 && rawHistory[0].role !== 'user') {
      rawHistory.shift();
    }

    const formattedHistory = [];
    for (const item of rawHistory) {
      const role = item.role === 'user' ? 'user' : 'model';
      if (formattedHistory.length > 0 && formattedHistory[formattedHistory.length - 1].role === role) {
        formattedHistory[formattedHistory.length - 1].parts[0].text += `\n${item.text}`;
      } else {
        formattedHistory.push({
          role: role,
          parts: [{ text: item.text }],
        });
      }
    }

    // Try primary requested model or fallback through available fast models
    const modelsToTry = requestedModel
      ? [requestedModel, ...CANDIDATE_MODELS.filter((m) => m !== requestedModel)]
      : CANDIDATE_MODELS;

    let resultStream = null;
    let lastError = null;

    for (const mName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({
          model: mName,
          systemInstruction: systemInstruction,
        });

        const chat = model.startChat({
          history: formattedHistory,
          generationConfig: {
            temperature: 0.95,
          },
        });

        resultStream = await chat.sendMessageStream(message);
        break; // Successfully initiated stream
      } catch (err) {
        lastError = err;
        console.warn(`Model ${mName} failed, trying fallback:`, err.message);
      }
    }

    if (!resultStream) {
      throw lastError || new Error('ไม่สามารถเชื่อมต่อโมเดล AI ได้ในขณะนี้');
    }

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