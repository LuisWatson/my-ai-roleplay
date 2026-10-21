# Botbaat — notes for Claude

Thai AI roleplay chat app (Next.js 15 App Router, React 18, Tailwind 3.4, Gemini via `@google/generative-ai`).
The owner builds it for themselves and their partner. Reply to the owner in Thai.

## Run

- `npm install`, then `npm run dev` → http://localhost:3000
- Gemini key: `GEMINI_API_KEY` in `.env.local` (git-ignored), or typed into the in-app Settings (that one wins).
- No test suite. Verify changes in the browser; for prompt/parser logic, import the module in Node
  (imports have no `.js` extension, so a small resolve hook is needed).

## Where things live

- `app/page.js` — all app state; everything is saved in **localStorage** (chats, roles, custom characters, settings). No backend storage, no login.
- `app/api/chat/route.js` — streams Gemini replies; builds the system prompt with `lib/prompt.js`.
- `lib/prompt.js` — system instruction: persona, user role, novel-style format rules, trailing scene tag.
- `lib/scene.js` — parses the tag the model ends every reply with:
  `[ฉาก: สถานที่=...; เวลา=...; พื้นหลัง=<id>]` (the `พื้นหลัง=` part is optional).
- `constants/characters.js` — 12 preset characters. Optional fields:
  `avatar`, `background`, `defaultUserRole { description, background }`, `fixedBackground`, `userRoleHint`.
- `constants/sceneBackgrounds.js` — 8 scene background ids → `public/characters/backgrounds/scenes/<id>.webp`.
- `components/ChatWindow.jsx` — blurred backdrop (scene background, else character background), floating scene pill.
- `components/UserRoleModal.jsx` — "บทบาทของฉัน"; opens by itself the first time a character is opened (`user_role_prompted` in localStorage). Nothing is required; empty fields use `defaultUserRole`.
- `.claude/skills/character-portrait/` — how to generate a character portrait on tensor.art and wire it in.

## Conventions

- UI text is Thai; code, comments and commit messages are English (older commits are Thai).
- Commit style: conventional commits (`feat:`, `fix(ui):`, `chore:`), one topic per commit.
- Images: portraits PNG 768×1024 in `public/characters/`, backgrounds WebP via `sharp` (already in node_modules).
- Mobile matters (owner tests on iPhone Safari): use `h-dvh`, not `h-screen`; inputs 16px on phones.

## Status (2026-10-21)

Done: chat input redesign with `**` / `""` insert buttons, rename to Botbaat, Ava portrait,
blurred chat backgrounds that follow the scene, softer bubble colors, role form + per-character defaults, iPhone layout fix.

## TODO (agreed, not started)

1. **Login + per-user data for the owner and their partner** (biggest). Plan: Supabase Google login,
   tables per user (chats, roles, custom characters, settings), replace localStorage in `app/page.js`,
   migrate old chats via the existing Backup export/import, lock `/api/chat` to an allowlist of the two emails,
   deploy on Vercel. Open questions: share one Gemini key or each their own; the two emails. ~1–2 days.
2. Portraits for the other 11 characters (only Ava has one) — use the `character-portrait` skill.
3. Create-character form: no fields yet for `background` or `defaultUserRole`.
4. Ava portrait is a 924 KB PNG; could be WebP (~100 KB).
5. Not yet checked with real Gemini replies: does the model always add `พื้นหลัง=`?

## Security note

`/api/chat` has no auth. Never deploy publicly with `GEMINI_API_KEY` set on the server until TODO 1 is done —
anyone with the URL could use the key.
