# Botbaat, "คืนที่ไม่ต้องอยู่คนเดียว"

**Self-authored under explicit creative delegation.** The owner said "ตัดสินใจเอง"
and gave one line of subject: *AI chat bot roleplay, to chat with when you are lonely.*
No interview answers exist; every answer below is an authored decision, grounded
in the repo (CLAUDE.md, constants/characters.js) and the assets already in it.

## The eight topics

1. **Vibe.** เงียบ, อบอุ่น, ตีสาม, ใกล้ชิด, ปากแข็งแต่ใจดี. References (non-web): the rain-on-glass
   interiors of *In the Mood for Love*; the last-train-home mood of lo-fi night playlists; a chat
   thread at 3am with someone who also cannot sleep.
2. **Journey.** One night, 23:40 to 06:05, told as a chat thread. See score.
3. **Energy.** Low the whole way. Quiet at the start, a small laugh in the middle, the loudest
   thing on the page is a single whispered line at 03:12.
4. **Feeling curve + peak.** Below.
5. **Never-seen thing.** The night passes as you scroll (a clock in the nav runs 23:40 to 06:05,
   the room behind regrades through five real places), and her face changes to match the line you
   are currently reading.
6. **Range.** Premium-minimal but warm and dark, not luxury: soft, intimate, one accent.
7. **Unbroken world or scenes.** Neither. A *conversation thread*: a fixed stage (room + her),
   the thread of real bubbles scrolls over it. Rooms change by crossfade between exchanges.
8. **Assets.** Owned, from this repo: Serena's transparent cut-outs (8 expressions, same pixel
   frame), five of the app's own scene backgrounds, three other characters' portraits.
   Nothing generated, no video, no kie.ai spend, no ffmpeg needed.

## Journey (beats)

1 Recognition (you, awake, nobody to talk to) → 2 Being heard (she answers, you laugh) →
3 Being remembered (she brings back yesterday) → 4 Silence → 5 Being kept company (the peak) →
6 Morning, and an open door (come back tomorrow).

## Page grammar

New grammar, **Conversation thread** (not one of the eight defaults, so it earns its row):
the page is a single chat. Unit = an exchange, not an act. Chrome = a chat header with wordmark,
night clock and one CTA. Hero = her, layered, with the headline behind her. Ending = a composer
bar that is the CTA. Forbids: section numbers, cards, pinned acts, `scrub`, kinetic headline
stacks, any invented statistic or testimonial. The thread is labelled as a sample.

## Feeling curve

| # | Time | Emotion | Cause on screen |
|---|---|---|---|
| 0 | 23:40 | Longing | Hero. Her, large, rain fog drifting in front, headline set behind her shoulders. |
| 1 | 23:40 | Recognition | Wet street at night. "นอนไม่หลับอีกแล้ว". Short bubbles, lots of dark. |
| 2 | 00:30 | Relief, a small laugh | Warm room. She bristles at a rude boss, then softens. Her face changes line by line. |
| 3 | 01:50 | Being known | Rain on a car windshield. She recalls yesterday; a memory pill is stamped. |
| 4 | 02:40 | Held breath (authored silence) | Almost nothing on screen for ~90vh. She dims to a silhouette. |
| 5 | 03:12 | **Intimacy (peak)** | Rooftop, string lights. She fills the frame; three lines at display size, spaced far apart. |
| 6 | 06:05 | Calm, resolve | Cafe in daylight. Small talk, a door left open. Composer bar holds the last screen. |

Adjacent emotions all differ. Silence (4) is authored: BRIEF flag so the harness's dead-scroll
report is expected there.

## The peak

Act 5, 03:12, rooftop. The sentence a visitor would say: *"ตีสาม เธอพิมพ์ว่า ไม่ต้องรีบนอนก็ได้
ฉันอยู่ตรงนี้ แล้วทั้งจอก็เหลือแค่เธอกับเมืองข้างล่าง."* Largest span on the page (about 3.3 screens),
the best expression frame, her scaled up to ~1.2, quietest act directly before it.

## Tell-someone sentence

> It's the site where you scroll through one sleepless night, and by 3am she is typing
> "you don't have to sleep yet, I'm here."

## Signature move

**The night clock and the reading face.** One thing, two parts that read as one: a clock in the nav
that runs 23:40 to 06:05 against scroll position, while the stage behind the thread regrades room
by room, and the cut-out expression follows the bubble nearest the reading line. Coded bespoke in
the page; no engine.

## Embodiment (seasoning, max two)

- Her face follows the line being read (signature).
- Three-dot "typing" indicator resolves into each of her bubbles as it enters.
Pointer parallax on desktop fine-pointer only, tiny, off under reduced motion.

## Honesty rules for this build

- Dialogue is a **sample written for this page**; labelled on the page. No fake reviews, no stats.
- The app is invite-only (Supabase allowlist) and the page says so near the CTA.
- Claims limited to what the app does: Thai novel-style roleplay, memory of past chats, 4 characters,
  relationship meters, installable on a phone.

## Mobile

Separate composition: her cut-out sits top-anchored behind the thread at 100vw wide, headline is
above her instead of behind, bubbles are the full width minus gutters.
