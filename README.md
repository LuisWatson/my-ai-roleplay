# Verse - Roleplay Web Application

เว็บแอปพลิเคชันสำหรับการสนทนาและสวมบทบาทกับตัวละครปัญญาประดิษฐ์ (AI Persona Roleplay) สำหรับการใช้งานส่วนบุคคล พัฒนาด้วย Next.js (App Router), React, Tailwind CSS และเชื่อมต่อกับ Google Gemini API

---

## ฟังก์ชันการทำงานหลัก (Key Features)

- **ตัวละครพรีเซ็ต 6 ตัว**: แต่ละตัวมีบุคลิก รูป และบริบทของตัวเอง พร้อมค้นหาและกรองตามหมวดหมู่
- **สร้างและแก้ไขตัวละครเอง**: กำหนดชื่อ หมวดหมู่ บุคลิก ประโยคทักทาย รูป พื้นหลัง และบทบาทเริ่มต้นของผู้เล่น แก้ไขหรือลบได้ภายหลัง
- **บทบาทของฉันแยกรายตัวละคร**: กด "บทบาทของฉัน" ในหน้าแชทเพื่อกำหนดชื่อ คำเรียก ความสัมพันธ์ นิสัย สิ่งที่ชอบ/ไม่ชอบ ให้ต่างกันในแต่ละตัวละคร (เช่น เป็นเพื่อนร่วมงานของมิว แต่เป็นแฟนของไอริน) ช่องที่เว้นว่างจะใช้ค่าจาก "โปรไฟล์ทั่วไป" ใน Settings
- **ตอบกลับแบบ Streaming**: แสดงคำตอบระหว่างสร้าง มีปุ่มหยุด และระบบสลับโมเดลสำรอง
- **จัดการบทสนทนา**: สร้างคำตอบใหม่และสลับเวอร์ชันคำตอบ (swipes), แก้ไขหรือลบข้อความ และให้ตัวละครเล่าเรื่องต่อโดยไม่ต้องส่งข้อความใหม่
- **รูปแบบแชทและฉาก**: เลือกการเล่าแบบนิยายหรือ DM; ฉากหลังและรูปสีหน้าของตัวละครเปลี่ยนตามบทสนทนา
- **ปรับสไตล์คำตอบ**: เลือกความยาว (สั้น/กลาง/ยาว) และ temperature ในแท็บ "การตอบกลับ"
- **ความจำและบันทึกเรื่อง**: สรุปแชทเป็นความจำระยะยาว พร้อมรายการปักหมุดและบันทึกเหตุการณ์สำคัญที่เรียกดูหรือแก้ไขได้
- **คำแนะนำคำตอบ**: สร้างตัวเลือกคำตอบจากบริบท แล้วกรองตัวเลือกซ้ำก่อนแสดง
- **เลือกโมเดล Gemini**: เลือกได้ในหน้า Settings มีระบบสลับไปโมเดลสำรองอัตโนมัติเมื่อโมเดลที่เลือกใช้ไม่ได้ (รอโมเดลละไม่เกิน 20 วินาทีก่อนสลับ)
- **ส่งออกและสำรองข้อมูล**: ส่งออกบทสนทนาเป็น `.txt` หรือ JSON รายแชท; สำรอง/นำเข้าข้อมูลทั้งแอปได้ โดยไม่รวม API Key
- **เข้าสู่ระบบด้วย Google + เก็บข้อมูลบนบัญชี**: ผ่าน Supabase จำกัดเฉพาะอีเมลที่อนุญาต ใช้ได้ทุกเครื่อง (ถ้าไม่ตั้งค่า Supabase จะเก็บใน `localStorage` ของเบราว์เซอร์แทน)
- **รองรับมือถือและติดตั้งเป็นเว็บแอป**: Dark Theme ใช้ได้ทั้ง Desktop และ Mobile และเพิ่มแอปไว้บนหน้าจอหลักได้

---

## เทคโนโลยีที่ใช้งาน (Tech Stack)

- **Framework**: [Next.js](https://nextjs.org/) 15 (App Router)
- **UI Library**: [React](https://react.dev/) 18
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **AI SDK**: [@google/generative-ai](https://www.npmjs.com/package/@google/generative-ai)

---

## การติดตั้งและการเริ่มต้นใช้งาน (Getting Started)

รันทดสอบทั้งหมดโดยไม่เรียก Gemini:
```bash
node --test tests/*.test.mjs
```

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

### 5. ตั้งค่าระบบเข้าสู่ระบบ (Supabase + Google) — ไม่บังคับตอนรันบนเครื่อง

ถ้าข้ามขั้นนี้ แอปจะไม่มีหน้าล็อกอินและเก็บข้อมูลในเบราว์เซอร์อย่างเดียว ถ้าตั้งค่าแล้ว แต่ละคนล็อกอินด้วย Google
และเห็นแชท/บทบาท/ตัวละครของตัวเองได้ทุกเครื่อง

1. **สร้างโปรเจกต์ Supabase** ที่ [supabase.com](https://supabase.com) (แพ็กเกจฟรีพอ)
2. **สร้างตาราง**: Supabase → SQL Editor → วางเนื้อหาไฟล์ `supabase/schema.sql` แล้วกด Run
3. **ใส่อีเมลที่อนุญาต**: ใน SQL Editor รัน
   ```sql
   insert into public.allowed_emails (email) values ('you@gmail.com'), ('partner@gmail.com') on conflict do nothing;
   ```
4. **สร้าง Google OAuth Client** ที่ [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Create credentials → OAuth client ID → ชนิด **Web application** (ถ้าถูกถามให้ตั้ง OAuth consent screen ก่อน ให้ตั้งเป็น External แล้วเพิ่มอีเมลทั้งสองเป็น Test users)
   - Authorized redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback` (คัดลอกได้จาก Supabase ในขั้นถัดไป)
5. **เปิด Google ใน Supabase**: Authentication → Sign In / Providers → Google → ใส่ Client ID และ Client Secret จากขั้น 4
6. **ตั้ง URL ที่ให้กลับมา**: Authentication → URL Configuration → Site URL `http://localhost:3000`
   และเพิ่ม Redirect URL `http://localhost:3000` (ตอน deploy ค่อยเพิ่ม URL ของ Vercel)
7. **ใส่ค่าใน `.env.local`** (Supabase → Project Settings → API):
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon หรือ publishable key>
   ```
   แล้วรีสตาร์ต `npm run dev`

ล็อกอินครั้งแรก ถ้าเบราว์เซอร์นั้นมีข้อมูลเก่าอยู่ แอปจะถามว่าจะย้ายขึ้นบัญชีไหม

> **หมายเหตุด้านความปลอดภัย**: เมื่อตั้งค่า Supabase แล้ว `/api/chat` จะรับเฉพาะคำขอจากบัญชีที่อยู่ใน `allowed_emails`
> ถ้า deploy (production) โดยไม่ตั้งค่า Supabase เซิร์ฟเวอร์จะปฏิเสธทุกคำขอแชท เพื่อไม่ให้คนอื่นใช้ `GEMINI_API_KEY` ได้

---

## โครงสร้างโปรเจกต์ (Project Structure)

```text
├── app/
│   ├── api/
│   │   ├── chat/route.js         # สตรีมคำตอบจาก Gemini
│   │   ├── memory/route.js       # สรุปและอัปเดตความจำ
│   │   └── suggest/route.js      # สร้างคำแนะนำคำตอบ
│   ├── globals.css               # สไตล์โกลบอลและ Tailwind
│   ├── layout.js                 # Root layout และ metadata
│   └── page.js                   # หน้าหลักและ state ของแอป
├── components/                   # หน้าต่างแชท ตัวละคร Settings และ dialogs
├── constants/                    # ตัวละคร โมเดล และค่าตั้งต้น
├── lib/                          # Prompt, memory, scene parsing, storage และ helpers
├── public/                       # รูปตัวละคร ฉาก และไอคอน
├── supabase/schema.sql           # Schema, RLS และ access control
├── tests/                        # Node.js tests (ไม่เรียก Gemini)
├── .env.example                  # ตัวอย่าง Environment Variables
└── package.json                  # Dependencies และ scripts
```

---

## การจัดเก็บข้อมูล

เมื่อไม่ได้ตั้งค่า Supabase ข้อมูลจะอยู่ใน `localStorage` ของเบราว์เซอร์นั้น เมื่อตั้งค่า Supabase แล้ว ข้อมูลของบัญชีจะเก็บใน `user_kv` และโหลดกลับเมื่อเข้าสู่ระบบจากอุปกรณ์อื่น API Key ไม่รวมอยู่ในไฟล์สำรองข้อมูล
