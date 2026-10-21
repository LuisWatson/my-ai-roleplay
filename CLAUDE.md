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
- `lib/prompt.js` — system instruction: persona, user role, novel-style format rules, trailing scene tag.
- `lib/scene.js` — parses the tag the model ends every reply with:
  `[ฉาก: สถานที่=...; เวลา=...; พื้นหลัง=<id>]` (the `พื้นหลัง=` part is optional).
- `constants/models.js` — model list = default (first) + fallback order. Free tier only (owner's choice):
  Pro models return 429; newer Flash models allow only **20 requests/day each**, Flash Lite much more.
  **Don't spend the owner's quota on tests** — one short call per model at most.
  `/api/chat` remembers models whose daily quota is gone and skips them until reset (in memory).
- Never `confirm()` either: use `useConfirm()` from `components/ConfirmDialog.jsx`.
- Errors: never `alert()`. Chat errors → notice card in `ChatWindow` (by `kind` from `/api/chat`); elsewhere → `Toast`.
  Waiting text stays in-story (character narration), never about the app/AI.
- `constants/characters.js` — 12 preset characters. Optional fields:
  `avatar`, `background`, `defaultUserRole { description, background }`, `fixedBackground`, `userRoleHint`.
- `constants/sceneBackgrounds.js` — 8 scene background ids → `public/characters/backgrounds/scenes/<id>.webp`.
- `components/ChatWindow.jsx` — blurred backdrop (scene background, else character background), floating scene pill.
- `components/UserRoleModal.jsx` — "บทบาทของฉัน"; opens by itself the first time a character is opened (`user_role_prompted` in the store). Nothing is required; empty fields use `defaultUserRole`.
- `.claude/skills/character-portrait/` — how to generate a character portrait on tensor.art and wire it in.

## Conventions

- **Worklog: whenever you finish a piece of work, add an entry to `worklog.md`** (newest on top: date, what
  changed, files, how it was verified, what is left). Keep Status/TODO below in sync too.
- UI text is Thai; code, comments and commit messages are English (older commits are Thai).
- Commit style: conventional commits (`feat:`, `fix(ui):`, `chore:`), one topic per commit.
- Images: portraits PNG 768×1024 in `public/characters/`, backgrounds WebP via `sharp` (already in node_modules).
- Mobile matters (owner tests on iPhone Safari): use `h-dvh`, not `h-screen`; inputs 16px on phones.

## Status (2026-10-21)

Done: chat input redesign with `**` / `""` insert buttons, rename to Botbaat, Ava portrait,
blurred chat backgrounds that follow the scene, softer bubble colors, role form + per-character defaults, iPhone layout fix.

## TODO

1. **Login + per-user data** — done and tested with a real Google login on localhost (2026-10-21, see `worklog.md`).
   Supabase project `xksnjxsbpacsxmuhcrue`; Google OAuth client is in Testing mode. Decided: one shared Gemini key.
   Deployed to Vercel 2026-10-21. Left: partner's email (add to `allowed_emails` AND Google Auth Platform →
   Audience → Test users); test login on the live site and on iPhone.
2. Portraits for the other 11 characters (only Ava has one) — use the `character-portrait` skill.
3. Create-character form: no fields yet for `background` or `defaultUserRole`.
4. Ava portrait is a 924 KB PNG; could be WebP (~100 KB).
5. Not yet checked with real Gemini replies: does the model always add `พื้นหลัง=`?

## Security note

`/api/chat` checks auth only when the Supabase env vars are set (production refuses chat without them).
Never deploy before the Supabase setup and the `allowed_emails` list are done.
