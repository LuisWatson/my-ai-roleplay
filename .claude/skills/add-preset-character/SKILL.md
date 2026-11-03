---
name: add-preset-character
description: Checklist for adding a new preset character to Botbaat (data, profile, hidden story truth, portrait, expressions, cut-outs, scene set, test, deploy). Use when the owner pastes a plot/character card and asks for a new character ("อยากได้ตัวละครใหม่", "เพิ่มตัวละคร", "add a preset").
---

# Add a preset character

Worked example: Noelle (2026-11-03, see `worklog.md`). Reply to the owner in Thai.

## 1. Data (files to touch)

- `constants/characters.js` — new entry in `BASE_CHARACTERS`: `id`, `name`, `tagline`, `description`, `greeting`, `exampleDialogue`,
  `category`, `scenario`, `realism`, `userRoleHint`, `defaultUserRole`, `situation`, `opening { time, place, mood, background }`,
  `avatar`, `background`, `sceneSet`, `expressions`, `cutouts`. `userSecret` only if the plot gives the player a secret.
- `constants/characterProfiles.js` — `profile`, `cast` (supporting people), `storyHooks` (events the model may bring in).
- `constants/storyArcs.js` — `STORY_ARCS.<id>`: the hidden `truthStages` (see 2).
- `CLAUDE.md` (preset count, lists of truth / cut-outs / sceneSet) and `worklog.md` (newest entry on top).

`situation` must state the open questions and tell the model NOT to decide the answers. Anything the story leans on that the
model would otherwise invent on turn 1 (an ingredient, a person, an object) must be named once, with no reason, or replies
contradict the hidden story. Noelle's real test showed exactly this.

## 2. Hidden truth — the owner must stay surprised

Never print, quote or summarize stage texts (chat, worklog, commits, UI). Delegate to a subagent: it writes `STORY_ARCS.<id>`
and edits stages on request, and reports only lengths and booleans. Stage text <= 1800 chars. Check in code that the other
characters still have 4 stages and the prompt builds. If the owner says "ขั้นที่ N ไม่เข้า", send that to the subagent blind.
Don't open `constants/storyArcs.js` with Read/Grep output you will show.

## 3. Pictures (skill `character-portrait`)

Order: main portrait on a white high-key backdrop -> 8 expressions (changed pose) -> rembg cut-outs -> main portrait
composited over a scene (the card avatar must have a background) -> 8 scenes in `public/characters/backgrounds/<id>/`.
Everything WebP via `sharp` (portraits 768×1024 q82, scenes 1152×768). Show the owner each picture type before the next:
faces must not look like an existing character (Serena/Vivienne).

## 4. Verify

- Node check scripts need a resolve hook because imports have no `.js` extension (see `CLAUDE.md`): data merges, prompt builds,
  `truthFor` stages, 8 expression + 9 cut-out files exist, all `sceneSet` paths exist.
- Run the app without login: main folder, `NEXT_PUBLIC_SUPABASE_URL=` and `NEXT_PUBLIC_SUPABASE_ANON_KEY=` set empty,
  `npx next dev -p 3002` (a temp copy with a `node_modules` junction breaks webpack). Check card, profile sheet, opening card,
  backdrop, cut-out.
- One real Gemini message (quota is tiny; never loop). Look for: in character, no invented facts, scene tag present.
- `next build` before pushing.

## 5. Ship

One commit for assets + data, separate commits for later fixes. Pushing to `main` deploys production: confirm with the owner
first. After deploy, open the live card and check the asset URLs return 200.

## Gotchas

- The shell here mangles backslashes in heredocs; write scripts with the Write tool.
- dcg blocks recursive `Remove-Item`, runtime-expanded PowerShell launchers and `sleep` chains: use Monitor plus run scripts.
- Raw `{😠}` mood markers must not show in the chat-list preview (`lastMessagePreview` strips them).
