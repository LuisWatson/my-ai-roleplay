# Antigravity Guidelines for Botbaat (`my-ai-roleplay`)

Thai AI roleplay chat web app (Next.js 15 App Router, React 18, Tailwind CSS 3.4, Gemini via `@google/generative-ai`, Supabase).
Developed by the owner for themselves and their partner.

---

## 1. Communication & Language Rules
- **ตอบเป็นภาษาไทยเสมอ (Always reply to the owner in Thai)** ไม่ว่าจะพิมพ์คำสั่งเป็นภาษาอังกฤษหรือภาษาไทย
- คำศัพท์เฉพาะทางเทคนิค (เช่น ชื่อฟังก์ชัน, ตัวแปร, Component, API, Libraries) ให้คงไว้เป็นภาษาอังกฤษ
- ข้อความบนหน้าจอ (UI Text) ใช้ภาษาไทย / โค้ด, คอมเมนต์ในโค้ด และ Git Commit Messages ใช้ภาษาอังกฤษ

---

## 2. Worklog & Commit Conventions
- **Worklog**: เมื่อทำงานเสร็จแต่ละชิ้น ให้บันทึกความเปลี่ยนแปลงลงใน [`worklog.md`](file:///d:/my-ai-roleplay/worklog.md) เสมอ (วางหัวข้อใหม่สุดไว้ด้านบนสุด ระบุวันที่, อาการ/สิ่งที่เปลี่ยน, ไฟล์ที่แก้, วิธีตรวจสอบ, และสิ่งที่เหลือ)
- **Commit Style**: ใช้ Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`) หนึ่งหัวข้อต่อหนึ่ง commit
- **UI Dialogs**: ห้ามใช้ `alert()` หรือ `confirm()` ของเบราว์เซอร์ ให้ใช้ `useConfirm()` จาก [`components/ConfirmDialog.jsx`](file:///d:/my-ai-roleplay/components/ConfirmDialog.jsx) หรือ `Toast` แทน

---

## 3. Story Secrets & Spoilers Policy (CRITICAL)
- **Hidden Story Truth (`truthStages`)**: ใน [`constants/storyArcs.js`](file:///d:/my-ai-roleplay/constants/storyArcs.js) มีปมความจริงที่ซ่อนอยู่ของตัวละคร (เช่น `ellie`)
- **เจ้าของเลือกที่จะไม่ถูกสปอยล์**: **ห้าม** พิมพ์ อ้างอิง หรือสรุปข้อความที่เป็นเนื้อหาความจริงของขั้นต่างๆ ลงในแชท, `worklog.md`, commit messages หรือแสดงผลบน UI เด็ดขาด

---

## 4. API & Model Quota Safety
- **Free Tier Quota**: โมเดล Gemini Flash มีโควตาจำกัดต่อวัน (~20 requests/day) โดยมี Flash Lite ช่วยรับภาระงานเบื้องหลัง (เช่น `/api/suggest`, `/api/memory`)
- **ห้ามผลาญโควตาของผู้ใช้ในการทดสอบ**: อย่ารัน automated loop หรือยิง API ซ้ำๆ เพื่อเทส ถ้าจะทดสอบ logic ของ prompt หรือ parser ให้ทดสอบผ่าน Node unit / mock object แทน

---

## 5. Mobile & Layout Considerations
- เว็บแอปเน้นใช้งานบนมือถือ (iPhone Safari):
  - ใช้ `h-dvh` เสมอ ห้ามใช้ `h-screen`
  - Input fields บนมือถือต้องมีขนาดฟอนต์อย่างน้อย 16px เพื่อป้องกัน Safari ซูมหน้าจออัตโนมัติ
  - ป้องกันแนวนอนล้นด้วย `overflow-x-hidden` และ `overflow-wrap: anywhere`
