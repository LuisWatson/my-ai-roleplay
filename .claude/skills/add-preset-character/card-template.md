# Character card prompt for ChatGPT (owner copies it, then pastes or saves the answer)

Used for Camille (noexit, 2026-11-22). Fill the theme line, send to ChatGPT, save its answer as a `.md` and read the file.
ChatGPT must NOT write the hidden truth: the truth stages are written by a subagent that nobody reads (see SKILL.md step 2).

```text
ช่วยออกแบบตัวละครสำหรับแอปแชทโรลเพลย์ภาษาไทย (ผู้เล่นคุยกับตัวละครคนเดียว)
ธีม/แนวที่อยากได้: [ใส่แนวเรื่อง]
ตอบเป็นภาษาไทย แยกหัวข้อตามด้านล่างให้ครบทุกข้อ

1. ชื่อ (id ภาษาอังกฤษตัวเล็กสั้นๆ + ชื่อที่แสดงสั้นๆ)
2. tagline: 1 บรรทัด
3. description: 2-3 ประโยค
4. category และ realism
5. profile: อายุ (ผู้ใหญ่เท่านั้น), อาชีพ, หน้าตา (ผม ตา ส่วนสูง การแต่งตัว), นิสัย (ที่เห็น + ที่ซ่อน), ชอบ/ไม่ชอบ, เรื่องราวในอดีต
6. บทบาทผู้เล่น: defaultUserRole (ใคร + อยู่ที่ไหน), userRoleHint, userSecret (ไม่บังคับ)
7. situation: ที่มาของเรื่อง + "คำถามที่ยังเปิดอยู่" 3-5 ข้อ (ห้ามเฉลย) + สิ่งที่เรื่องต้องพึ่งตั้งชื่อครั้งเดียวไม่ต้องอธิบายเหตุผล
8. opening: เวลา / สถานที่ / อารมณ์ / พื้นหลัง
9. greeting: ข้อความแรกของตัวละคร นิยายบุรุษที่สาม 1-2 ย่อหน้า
10. exampleDialogue: 4-6 ตา
11. cast 2-4 คน: ชื่อ / ความสัมพันธ์ / นิสัย
12. storyHooks 6-8 ข้อ
13. ฉากพื้นหลัง 8 ฉาก: ชื่อ + คำอธิบายภาพ 1 ประโยค (ฉากแรกต้องเป็นสถานที่เดียวกับ opening)
14. สีหน้า 8 แบบ: happy, shy, sad, angry, thinking, surprised, teasing, worried (ลักษณะสีหน้า/ท่าทางเฉพาะตัวละคร)

ห้ามเขียนความลับที่ซ่อนอยู่หรือเฉลยเรื่องในข้อใดเลย ตอนท้ายให้ใส่ "ธีมของความลับ" ประโยคเดียวกว้างๆ
```
