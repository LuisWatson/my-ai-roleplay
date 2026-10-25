# Botbaat — notes for Claude

Thai AI roleplay chat app (Next.js 15 App Router, React 18, Tailwind 3.4, Gemini via `@google/generative-ai`).
The owner builds it for themselves and their partner. Reply to the owner in Thai.

## Run

- `npm install`, then `npm run dev` → http://localhost:3000
- Gemini key: `GEMINI_API_KEY` in `.env.local` (git-ignored), or typed into the in-app Settings (that one wins).
  The owner and partner share the server key; a Settings key stays on its own device.
- Login: set `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`. Left empty, the app runs
  as before (no login, localStorage only) — fine in dev; `/api/chat` refuses in production without them.
- Don't run a second `next dev` in this folder: both share `.next` and one's env leaks into the other.
- No test suite. Verify changes in the browser; for prompt/parser logic, import the module in Node
  (imports have no `.js` extension, so a small resolve hook is needed).
- **Testing without logging in** (Claude can't sign in to Google for the owner): copy the project to a temp folder
  (robocopy, skip `.next`/`.git`), give the copy a `.env.local` with only `GEMINI_API_KEY`, run `npx next dev -p 3002`
  there. No Supabase vars → no login, localStorage only. Delete the copy afterwards. Also `next build` there
  before pushing, since the main folder's `.next` belongs to the running dev server.
- Shell heredocs in this environment mangle backslashes (`\n`, `\\s`): write edit scripts / regexes with the
  editor tools, not inline `node - <<EOF`.

## Continuing on another computer

1. `git clone https://github.com/LuisWatson/my-ai-roleplay.git` (private repo — sign in to GitHub), then `npm install`.
2. Create `.env.local` (never committed):
   - `GEMINI_API_KEY=` — the owner's key (aistudio.google.com → API keys)
   - `NEXT_PUBLIC_SUPABASE_URL=https://xksnjxsbpacsxmuhcrue.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=` — publishable key `sb_publishable_…` (Supabase → Project Settings → API Keys,
     or copy from Vercel → Settings → Environment Variables)
3. `npm run dev` → http://localhost:3000 — Google login works there (localhost is an allowed redirect/origin).
4. Read `worklog.md` (newest first) for what was done and what is open. Pushing to `main` deploys to production.

## Deploy

- Live: https://my-ai-roleplay-one.vercel.app (Vercel Hobby). **Every push to `main` deploys to production.**
- Env vars live in Vercel (Production). `NEXT_PUBLIC_*` must be type Config, not Secret; changing them needs a Redeploy.
- A new domain must be added to Supabase → Auth → URL Configuration (Redirect URLs) and to the Google OAuth
  client's JavaScript origins, or Google login on it fails.

## Where things live

- `app/page.js` — all app state. Reads/writes go through a `store` prop with the localStorage API (`lib/store.js`):
  with login, the signed-in user's Supabase `user_kv` rows (one row per old localStorage key); without, localStorage.
- `components/AuthGate.jsx` — Google login, allowlist check (`is_allowed()`), loads the cloud store,
  offers to copy this browser's old localStorage data into an empty account.
- `supabase/schema.sql` — tables `user_kv`, `allowed_emails`, RLS, `is_allowed()`. Run in Supabase SQL Editor.
- `app/api/chat/route.js` — streams Gemini replies; builds the system prompt with `lib/prompt.js`.
  With Supabase configured it requires `Authorization: Bearer <token>` of an allowlisted account.
- `lib/prompt.js` — system instruction: persona, user role, memory, novel-style format rules, trailing scene tag;
  also `buildSummaryPrompt` for memory.
- `lib/memory.js` + `app/api/memory/route.js` — long-term memory: older chat is summarized into
  `chat_memory_<id>` and sent with each message; raw history = everything after the summary's end (normally
  ~12–18k characters, up to 60k while the summary lags). Over-long summaries are shortened by `/api/memory`, and the
  chat prompt cuts the oldest lines, never the newest. A message Google won't summarize is kept as a raw note.
- `lib/geminiServer.js` — shared by API routes: `authorize`, `resolveApiKey`, `tryModels` (fallback + skip
  models whose daily quota is gone).
- `lib/scene.js` — parses the tag the model ends every reply with:
  `[ฉาก: สถานที่=...; เวลา=...; พื้นหลัง=<id>; ความทรงจำ=<title>; ความสัมพันธ์=ผูกพัน N, ไว้ใจ N, อารมณ์ x;
  ตัวเลือก=a | b | c]` (everything after เวลา optional; labeled `key=value` parts, unlabeled ones fall back to
  location/time/background). Keep it lenient.
- `constants/models.js` — model list = default (first) + fallback order. Free tier only (owner's choice):
  Pro models return 429; newer Flash models allow only **20 requests/day each**, Flash Lite much more.
  **Don't spend the owner's quota on tests** — one short call per model at most.
  `/api/chat` remembers models whose daily quota is gone and skips them until reset (in memory).
- Never `confirm()` either: use `useConfirm()` from `components/ConfirmDialog.jsx`.
- Errors: never `alert()`. Chat errors → notice card in `ChatWindow` (by `kind` from `/api/chat`); elsewhere → `Toast`.
  Waiting text stays in-story (character narration), never about the app/AI.
- `constants/characters.js` — 14 preset characters (12 + the `ellie` and `ash` story characters; `ash` has no portrait yet). Optional fields:
  `avatar`, `background`, `defaultUserRole { description, background }`, `fixedBackground`, `userRoleHint`,
  `profile { age, occupation, appearance, personality, likes, dislikes, story }` and
  `cast: [{ name, relation, personality }]` (presets get both from `constants/characterProfiles.js`; custom
  characters from the create form). Both go into the prompt (`profileText` / `castText`).
- Story setup (`lib/story.js`): optional `situation` (premise + open questions), `userSecret` (the user's side; the
  character must not know it), `opening { time, place, mood, background }` (card above the first message, `OpeningCard`)
  and `storyHooks` (events the model may bring in, rule 11). Sent only for chats whose first message has `storyStart`
  (`openingMessage`), so chats from before keep their own story. `ellie` is the owner-written test character for this.
- Hidden story truth (`constants/storyArcs.js` → `character.truthStages`, `lib/truth.js`): staged and paced by the app.
  **The owner chose to be surprised: never print, quote or summarize the stage texts (not in chat, worklog, commits);
  don't show them in the UI.** The stage is derived from `reveal` on model messages (tag part `; เฉลย=<n>`); the next stage
  is due after N player turns (24, or 16/10 at trust level 3/4). Only told + due stages are sent (`truthFor`); told stages override the situation/hooks (no re-hiding); once all are
  told (`complete`), rule 11 stops "keep secrets alive". If a due stage's reply has no tag, `/api/suggest` asks a separate
  Lite yes/no (`revealCheck` → `revealed`, never mixed into the suggestion prompt) and `markRevealed` sets `reveal`.
  The memory panel shows only the count told/total (`truthCount`); the persona
  sent never carries `truthStages`. Only `ellie` and `ash` have one.
- `components/CharacterProfile.jsx` — tapping a card on the home grid opens the character's profile sheet
  (bio / your role / people around them / greeting, relation + journal count, "เริ่มแชท"/"คุยต่อ");
  the sidebar chat list still opens chats directly.
- Other people in a scene: rule 11 lets the model voice them; rule 4 makes it prefix their speech with `name:`;
  `lib/roleplayFormat.js` turns that into `speaker` and `ChatMessage` shows a name label in that person's colour.
- `constants/sceneBackgrounds.js` — 8 scene background ids → `public/characters/backgrounds/scenes/<id>.webp`.
- `components/ChatWindow.jsx` — blurred backdrop (scene background, else character background), floating scene pill,
  a divider (place · time) before the first scene and wherever the place changes (`sceneDividers`).
- Story layout (`formatStoryText` in `ChatMessage`): novel-mode character replies have no outer bubble — narration
  on the backdrop, each spoken line in its own bubble. User messages, DM mode and the profile greeting keep the old box.
- Character thought (rule 16): `; ความคิด=<emoji> <thought>` in the scene tag → `thought` on the reply (and swipes),
  shown as a "ความคิด" pill under it. Always asked for; not sent back to the model.
- Expression pictures (`lib/expressions.js`, `components/PortraitView.jsx`): optional `character.expressions { happy, shy,
  sad, angry }` (paths under `public/characters/expressions/`; only `ellie` has them, made on tensor.art with Img2Img at
  strength ~0.8 from her main portrait). The emoji at the start of a reply's thought picks one (`pictureFor`); no match →
  the main portrait. Shown as the header picture (tap = full size), the small avatar beside each reply, and a `MoodCard`
  at the end of a reply, above the thought pill, when the expression changed (`moodChanges`). No side panel (owner removed it).
- Swipes: a regenerated model message keeps `alts: [{ text, scene }]` + `altIndex` (only the last reply);
  dropped when the user sends the next message.
- Story direction ("กำกับเรื่อง", `ChatInput`): one-shot out-of-story instruction sent as `direction`; never saved.
- "+" menu (`ChatInput`): suggest replies on demand (`/api/suggest`, Lite models first; stored as `choices` +
  `choicesAsked` on the last reply), story direction, novel/DM switch, memory, my role.
- Continue (⏩ in the send slot when the input is empty): `continueStory` — no user message is added; the server sends
  `CONTINUE_MESSAGE` as the user turn. History that starts with model turns (greeting) gets that same stand-in turn
  in front instead of being dropped.
- `components/MemoryModal.jsx` — tabs: memory journal (`components/JournalList.jsx`) and pins (`chat_pins_<id>`,
  always sent, survive clearing the chat) + the editable auto summary. Shows a **pending badge** (amber) only when
  `nextMemoryBatch(messages, memory)` returns non-null — meaning older messages past the recent raw window have
  accumulated enough chars to queue a new summary. Never fires on a normal in-progress chat.
- `lib/chatExport.js` + `components/ExportChatModal.jsx` — "ส่งออก" button in the chat header opens a modal with:
  `.txt` (human-readable novel-format transcript) and `.json` (single-character backup,
  `app: 'my-ai-roleplay-single-chat'`, includes messages/pins/journal/memory/userRole).
  The modal also has a **"นำเข้า .json"** button that restores from such a file via `handleImportData` in `app/page.js`
  (dedicated branch for `my-ai-roleplay-single-chat`; separate from full-app backup restore).
- `lib/chatHelpers.js` — shared client-side helpers extracted from `app/page.js`: `REPLY_ERRORS`, `readChatActivity`,
  `lastMessagePreview`, `withoutImages`, `withoutSwipes`, `savedHistoryOrGreeting`, `markRolePrompted`.
- Memory journal (`lib/journal.js`, `chat_journal_<id>`): the model flags key moments with an extra
  `; ความทรงจำ=<title>` part in the scene tag (rule 13, only when the journal setting isn't 'off');
  messages carry `moment: { title, state, entryId }`; saved moments are sent with every message.
- Character photos (`lib/imageResize.js`): uploads become 450×600 JPEG data URLs inside the character;
  `withoutImages()` keeps them out of `/api/chat` requests.
- Round 2 (`lib/relation.js`, rule 14 in `lib/prompt.js`): relationship meters stored on replies as `relation`
  (points, no upper limit; the model reports changes like `ผูกพัน +2, ไว้ใจ 0`, capped per reply; shown and sent to
  the model as levels via `levelOf`); per-chat `chat_style_<id>` = 'dm' switches to short messaging-app chat
  (`style: 'dm'` on messages). Settings `suggestions` / `relationship` turn them off.
- Suggested replies (`choices` on the last reply): made by a separate Lite call, `/api/suggest`, after every reply
  (`requestSuggestions` in `app/page.js`, `auto: true` → Lite models only; the 💡 button may fall back to Flash).
  They are NOT written by the chat model any more: inside the reply (old rule 15) they kept turning into what the
  character does next. The suggest prompt (`buildSuggestPrompt`) says the last message is the character's, lists her
  last spoken lines as "do not repeat", asks for a "มุมของ <user>:" line first, then 5 candidates; `pickChoices`
  (`lib/choices.js`) keeps the first 3 that pass `choiceProblem`: no user's own name, no echo of the character's
  last words (even reworded), no lead-in line, no foreign-script letter. Old saved replies may still carry choices
  written in the tag (`lib/scene.js` keeps parsing them).
- Installable app: `app/manifest.js`, `appleWebApp` in `app/layout.js`, icons in `public/icons/` + `app/*icon.png`.
- `components/UserRoleModal.jsx` — "บทบาทของฉัน"; opens by itself the first time a character is opened (`user_role_prompted` in the store). Nothing is required; empty fields use `defaultUserRole`.
- `.claude/skills/character-portrait/` — how to generate a character portrait on tensor.art and wire it in.

## Conventions

- **Worklog: whenever you finish a piece of work, add an entry to `worklog.md`** (newest on top: date, what
  changed, files, how it was verified, what is left). Keep Status/TODO below in sync too.
- UI text is Thai; code, comments and commit messages are English (older commits are Thai).
- Commit style: conventional commits (`feat:`, `fix(ui):`, `chore:`), one topic per commit.
- Images: portraits and backgrounds are WebP via `sharp` (already in node_modules); portraits 768×1024 in
  `public/characters/<id>.webp`, quality 82.
- Mobile matters (owner tests on iPhone Safari): use `h-dvh`, not `h-screen`; inputs 16px on phones.

## Status (2026-10-25)

Done: chat input redesign, rename to Botbaat, Ava portrait, scene backgrounds, role form, iPhone layout fix,
Google login + cloud data, Vercel deploy, model fallback, in-app dialogs, multi-device refresh, long-term memory,
round 1 (swipes, story direction, memory panel, installable app), memory journal, photo upload, round 2,
blocked-reply handling, relationship in header, speaker labels, character profiles + supporting cast,
story layout + character thoughts + scene dividers (2026-10-23).
Create-character form (background/fixedBackground/defaultUserRole), chat export (.txt + .json), single-chat JSON
restore, model-fallback Toast, memory pending badge fix, shared chatHelpers, AGENTS.md (2026-10-25).

## TODO

1. **Login + per-user data** — done and tested with a real Google login on localhost (2026-10-21, see `worklog.md`).
   Supabase project `xksnjxsbpacsxmuhcrue`; Google OAuth client is in Testing mode. Decided: one shared Gemini key.
   Deployed to Vercel 2026-10-21. Partner's email added to `allowed_emails` and Google Test users 2026-10-22
   (a new account needs both). Partner has logged in.
2. Portraits — done 2026-10-22: all 12 presets have photorealistic PNGs (Z-Image-Turbo; "anime" in the prompt
   gives 3D-cartoon results, use "photorealistic, realistic photo"). Free tensor.art runs one task at a time.
3. Create-character form — done 2026-10-25: added `background` (chat backdrop with presets & URL), `fixedBackground`, and `defaultUserRole { description, background }` + `userRoleHint`. Profiles could later get a picture gallery (several images, swipe 1/3) once portraits exist.
4. Portraits as WebP — done 2026-10-22 (10 MB of PNG → 434 KB).
5. **Parked 2026-10-22:** sexier "Khui AI style" 2nd image per character (profile gallery). Notes and the prompt in
   `drafts/sexy-portrait-handoff.md` (git-ignored). Tried tensor.art Z-Image (too mild, strips "cleavage"), Perchance
   (filter off by owner; face stays ordinary — the look needs a model like majicMIX realistic), tensor.art majicMIX
   (owner unhappy with result). Claude Code auto mode blocked driving Chrome for this. Rules: adult-looking faces,
   never Tonkla, no school uniforms, clothed.
6. Not yet checked with real Gemini replies: does the model always add `พื้นหลัง=`?
6. **Feature rounds agreed with the owner** (one round at a time, used for a few days before the next):
   - Round 1 — done 2026-10-21, live; home-screen install + login on iPhone confirmed working.
   - Round 2 — memory journal, suggested replies, relationship meters, DM mode: done 2026-10-22.
     Left: prompt tuning from the owner's examples of bad replies; maybe cap temperature for Lite models
     (they make more Thai typos — owner declined for now).
   - Round 3 — dropped by the owner 2026-10-22 ("not useful"): several stories per character, share custom
     characters, read aloud, special-day letters, lorebook. Don't propose these again unless asked.
   - Not now: group chat, character messages first, images in chat (no free image quota), Next 16 upgrade.

## Security note

`/api/chat` checks auth only when the Supabase env vars are set (production refuses chat without them).
Never deploy before the Supabase setup and the `allowed_emails` list are done.
