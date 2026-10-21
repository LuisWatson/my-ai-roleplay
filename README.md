# Khui AI Personal - Roleplay Web Application

เว็บแอปพลิเคชันสำหรับการสนทนาและสวมบทบาทกับตัวละครปัญญาประดิษฐ์ (AI Persona Roleplay) สำหรับการใช้งานส่วนบุคคล พัฒนาด้วย Next.js (App Router), React, Tailwind CSS และเชื่อมต่อกับ Google Gemini API

---

## ฟังก์ชันการทำงานหลัก (Key Features)

- **ตัวละครพรีเซ็ต 12 ตัว**: เพื่อนสนิท รุ่นพี่ เพื่อนร่วมงาน อาจารย์ แฟน เจ้านาย น้องข้างบ้าน เชฟ แม่มด กัปตันยานอวกาศ บาร์เทนเดอร์ และโค้ชฟิตเนส แต่ละตัวมีบทบาท น้ำเสียง และตัวอย่างบทพูดของตัวเอง พร้อมช่องค้นหาและกรองตามหมวดหมู่
- **สร้างและแก้ไขตัวละครเอง**: กำหนดชื่อ หมวดหมู่ บุคลิก ประโยคทักทาย รูป และตัวอย่างบทพูด (ไม่บังคับ) แก้ไขหรือลบได้ภายหลัง
- **บทบาทของฉันแยกรายตัวละคร**: กด "บทบาทของฉัน" ในหน้าแชทเพื่อกำหนดชื่อ คำเรียก ความสัมพันธ์ นิสัย สิ่งที่ชอบ/ไม่ชอบ ให้ต่างกันในแต่ละตัวละคร (เช่น เป็นเพื่อนร่วมงานของมิว แต่เป็นแฟนของไอริน) ช่องที่เว้นว่างจะใช้ค่าจาก "โปรไฟล์ทั่วไป" ใน Settings
- **ตอบกลับแบบ Streaming**: แสดงคำตอบทีละคำ มีปุ่มหยุดตอบ และสลับตัวละครระหว่างตอบได้โดยไม่ปนกัน
- **จัดการข้อความ**: สร้างคำตอบใหม่ (regenerate), แก้ไขข้อความ (แก้ข้อความผู้ใช้จะตอบใหม่จากจุดนั้น), และลบข้อความ
- **ปรับสไตล์คำตอบ**: เลือกความยาว (สั้น/กลาง/ยาว) และ temperature ในแท็บ "การตอบกลับ"
- **ความจำในบทสนทนา**: ส่งประวัติแชทล่าสุดให้โมเดลตามงบตัวอักษร (ดูค่า `HISTORY_CHAR_BUDGET` ใน `constants/chatSettings.js`) ช่วงต้นของแชทที่ยาวมากจะถูกตัดออก
- **เลือกโมเดล Gemini**: เลือกได้ในหน้า Settings มีระบบสลับไปโมเดลสำรองอัตโนมัติเมื่อโมเดลที่เลือกใช้ไม่ได้ (รอโมเดลละไม่เกิน 20 วินาทีก่อนสลับ)
- **สำรอง/นำเข้าข้อมูล**: Export/Import ไฟล์ JSON ของตัวละครที่สร้างเอง ประวัติแชท โปรไฟล์ บทบาทรายตัวละคร โมเดล และการตั้งค่าคำตอบ (ไม่รวม API Key)
- **เก็บข้อมูลในเบราว์เซอร์**: ทุกอย่างบันทึกใน `localStorage` ไม่มีฐานข้อมูลฝั่งเซิร์ฟเวอร์
- **ดีไซน์ Dark Theme**: Tailwind CSS รองรับทั้ง Desktop และ Mobile (ปุ่มจัดการบนจอสัมผัสแสดงตลอด)

---

## เทคโนโลยีที่ใช้งาน (Tech Stack)

- **Framework**: [Next.js](https://nextjs.org/) 15 (App Router)
- **UI Library**: [React](https://react.dev/) 18
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **AI SDK**: [@google/generative-ai](https://www.npmjs.com/package/@google/generative-ai)

---

## การติดตั้งและการเริ่มต้นใช้งาน (Getting Started)

### 1. โคลนคลังข้อมูล (Clone Repository)
```bash
git clone https://github.com/LuisWatson/my-ai-roleplay.git
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
หากกรอก API Key ในหน้า Settings ด้วย ระบบจะใช้ key จากหน้า Settings ก่อน และใช้ `GEMINI_API_KEY` เมื่อหน้า Settings เว้นว่าง

### 4. รันแอปพลิเคชันในโหมดพัฒนา (Development Server)
```bash
npm run dev
```
เข้าใช้งานผ่านเบราว์เซอร์ที่ [http://localhost:3000](http://localhost:3000)

> **หมายเหตุด้านความปลอดภัย**: `/api/chat` ไม่มีระบบยืนยันตัวตนหรือจำกัดอัตราการเรียก เหมาะกับการรันบนเครื่องตัวเอง หากนำไป deploy สาธารณะโดยตั้ง `GEMINI_API_KEY` ไว้บนเซิร์ฟเวอร์ ผู้ที่รู้ URL จะใช้ key นั้นได้ ควรเพิ่มการยืนยันตัวตนก่อน

---

## โครงสร้างโปรเจกต์ (Project Structure)

```text
├── app/
│   ├── api/chat/route.js        # API Route สตรีมคำตอบจาก Gemini พร้อมสลับโมเดลสำรอง
│   ├── globals.css              # สไตล์โกลบอลและ Tailwind Directive
│   ├── layout.js                # Root Layout ของระบบ
│   └── page.js                  # หน้าหลัก คุม state, localStorage, streaming, Backup
├── components/
│   ├── CharacterCard.jsx        # การ์ดตัวละคร (แก้ไข/ลบสำหรับตัวละครที่สร้างเอง)
│   ├── ChatInput.jsx            # กล่องพิมพ์ข้อความ ปุ่มส่ง/หยุดตอบ
│   ├── ChatMessage.jsx          # บับเบิลข้อความ จัดฟอร์แมตแบบนิยาย ("คำพูด" / *การกระทำ*) และปุ่มแก้ไข/ลบ/สร้างใหม่
│   ├── ChatWindow.jsx           # หน้าต่างแชท Header และ Auto-scroll
│   ├── CreateCharacterModal.jsx # สร้าง/แก้ไขตัวละคร
│   ├── SettingsModal.jsx        # ตั้งค่า: โปรไฟล์ทั่วไป การตอบกลับ API Key และโมเดล
│   ├── Sidebar.jsx              # รายการตัวละคร ค้นหา/กรอง สร้างตัวละคร Backup
│   └── UserRoleModal.jsx        # กำหนดบทบาทของผู้ใช้ต่อตัวละครหนึ่งตัว
├── constants/
│   ├── characters.js            # ตัวละครพรีเซ็ต
│   ├── chatSettings.js          # ค่าความยาวคำตอบ temperature และงบประวัติแชท
│   └── models.js                # รายการโมเดล Gemini
├── lib/
│   ├── prompt.js                # สร้าง system instruction สำหรับรักษาบทบาท
│   ├── userRole.js              # ตรวจและรวมบทบาทผู้ใช้กับโปรไฟล์ทั่วไป
│   └── withTimeout.js           # จำกัดเวลารอโมเดลตอบสนอง
├── .env.example                 # ตัวอย่างไฟล์ Environment Variables
├── .gitignore                   # รายการไฟล์ที่ไม่นำขึ้น Git
└── package.json                 # แพ็กเกจและสคริปต์ของโปรเจกต์
```

---

## ข้อมูลที่เก็บใน localStorage

| Key | เนื้อหา |
|---|---|
| `user_gemini_api_key` | API Key จากหน้า Settings |
| `user_gemini_model` | โมเดลที่เลือก |
| `user_response_settings` | ความยาวคำตอบและ temperature |
| `user_roleplay_profile` | โปรไฟล์ทั่วไปของผู้ใช้ |
| `user_character_roles` | บทบาทของผู้ใช้แยกรายตัวละคร |
| `user_custom_chars` | ตัวละครที่สร้างเอง |
| `chat_history_<id ตัวละคร>` | ประวัติแชทของแต่ละตัวละคร |
