import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req) {
  try {
    const { message, history, persona, apiKey } = await req.json();
    
    const activeKey = process.env.GEMINI_API_KEY || apiKey;

    if (!activeKey) {
      return new Response(JSON.stringify({ error: 'ไม่พบ Gemini API Key กรุณาตั้งค่าใน .env.local หรือหน้า Settings' }), { status: 400 });
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

    // ดึงโมเดล gemini-2.5-flash พร้อมใส่ systemInstruction
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      systemInstruction: systemInstruction
    });

    // แปลงประวัติแชทเข้า Format ของ SDK
    const formattedHistory = history.map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    }));

    // เริ่มสร้าง Chat Session
    const chat = model.startChat({
      history: formattedHistory,
      generationConfig: {
        temperature: 0.95,
      }
    });

    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    return new Response(JSON.stringify({ text: responseText }), { status: 200 });

  } catch (error) {
    console.error('Chat API Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'เกิดข้อผิดพลาดในการประมวลผล' }), { status: 500 });
  }
}