# Khui AI Personal - Roleplay Web Application

เว็บแอปพลิเคชันสำหรับการสนทนาและสวมบทบาทกับตัวละครปัญญาประดิษฐ์ (AI Persona Roleplay) สำหรับการใช้งานส่วนบุคคล พัฒนาด้วย Next.js (App Router), React, Tailwind CSS และเชื่อมต่อกับ Google Gemini API

---

## ฟังก์ชันการทำงานหลัก (Key Features)

- **ระบบสวมบทบาทตัวละคร (Character Persona)**: ตัวละครตอบสนองตามบทบาท นิสัย และความสัมพันธ์ที่กำหนด พร้อมบรรยายอารมณ์และการกระทำ `*(action)*`
- **ระบบจัดเก็บข้อมูลในตัว (Local Persistence)**: บันทึกประวัติการสนทนาและตัวละครที่สร้างขึ้นใหม่ผ่าน Web Storage (`localStorage`)
- **การจัดการ API Key แบบยืดหยุ่น**: รองรับการกำหนด API Key ผ่านตัวแปรสภาพแวดล้อม (`.env.local`) หรือผ่านหน้าต่างการตั้งค่า (Settings) บนหน้าเว็บ
- **ดีไซน์ที่ทันสมัย (Modern Minimal Dark Theme)**: ออกแบบด้วย Tailwind CSS รองรับการใช้งานทั้งบนหน้าจอ Desktop และ Mobile
- **สถาปัตยกรรมแบบแยกส่วน (Component-Based Architecture)**: โค้ดได้รับการจัดโครงสร้างให้เป็นระเบียบ ง่ายต่อการดูแลรักษาและพัฒนาต่อยอด

---

## เทคโนโลยีที่ใช้งาน (Tech Stack)

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **UI Library**: [React](https://react.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **AI SDK**: [@google/generative-ai](https://www.npmjs.com/package/@google/generative-ai)

---

## การติดตั้งและการเริ่มต้นใช้งาน (Getting Started)

### 1. โคลนคลังข้อมูล (Clone Repository)
```bash
git clone <URL_ของ_GITHUB_REPOSITORY>
cd my-ai-roleplay
```

### 2. ติดตั้ง Dependencies
```bash
npm install
```

### 3. ตั้งค่าตัวแปรสภาพแวดล้อม (Environment Variables)
คัดลอกไฟล์ `.env.example` เป็น `.env.local`:
```bash
cp .env.example .env.local
```
จากนั้นกรอก Gemini API Key ที่ได้รับจาก [Google AI Studio](https://aistudio.google.com/):
```env
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
```
*(หรือสามารถกรอกผ่านหน้าต่าง Settings บนหน้าเว็บแอปพลิเคชันได้เช่นกัน)*

### 4. รันแอปพลิเคชันในโหมดพัฒนา (Development Server)
```bash
npm run dev
```
เข้าใช้งานผ่านเบราว์เซอร์ที่ [http://localhost:3000](http://localhost:3000)

---

## โครงสร้างโปรเจกต์ (Project Structure)

```text
├── app/
│   ├── api/chat/route.js     # API Route สำหรับสื่อสารกับ Gemini SDK
│   ├── globals.css           # สไตล์โกลบอลและ Tailwind Directive
│   ├── layout.js             # Root Layout ของระบบ
│   └── page.js               # หน้าหลัก (Main Orchestrator Component)
├── components/
│   ├── CharacterCard.jsx     # คอมโพเนนต์การ์ดแสดงตัวละคร
│   ├── ChatInput.jsx         # กล่องรับข้อความและปุ่มส่ง
│   ├── ChatMessage.jsx       # บับเบิลข้อความพร้อมจัดฟอร์แมต *(action)*
│   ├── ChatWindow.jsx        # หน้าต่างแชทและข้อความต้อนรับ
│   ├── CreateCharacterModal.jsx # หน้าต่างสร้างตัวละครใหม่
│   ├── SettingsModal.jsx     # หน้าต่างจัดการ API Key
│   └── Sidebar.jsx           # แถบด้านข้างสำหรับจัดการตัวละคร
├── constants/
│   └── characters.js         # ข้อมูลตัวละครพรีเซ็ตเริ่มต้น
├── .env.example              # ตัวอย่างไฟล์การตั้งค่า Environment Variables
├── .gitignore                # รายการไฟล์และโฟลเดอร์ที่ไม่นำขึ้นระบบ Git
└── package.json              # รายการแพ็กเกจและสคริปต์ของโปรเจกต์
```
