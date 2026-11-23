---
name: add-preset-character
description: Checklist for adding a new preset character to Botbaat (data, profile, hidden story truth, look, portrait, expressions, scene set, test, deploy). Use when the owner pastes a plot/character card and asks for a new character ("อยากได้ตัวละครใหม่", "เพิ่มตัวละคร", "add a preset").
---

# Add a preset character

Worked example: Noelle (2026-11-03, see `worklog.md`). Reply to the owner in Thai.

## 0. Intake (Camille, 2026-11-22)

The owner may have ChatGPT write the card: give them `card-template.md` (this folder), then read the saved `.md`. Before coding,
review the card and tell the owner the fixes in Thai (they said "decide yourself" and "go"):
- `name` short (the long title goes into the tagline); `category` reuses an existing tab (a new word adds a new tab on the home screen).
- The opening place must be one of the 8 scenes (Camille's card started in "Staff Reception" but the scene list had none).
- Do NOT import the card's "roleplay rules" and "relationship stages": they duplicate `lib/prompt.js` and the relationship meters;
  fold one line of them into `description` / `situation` instead.
- If an open question forces the hidden truth (e.g. "why is she not surprised"), tell the subagent that constraint, never the answer.
- The owner's taste for these portraits: glamorous and sexy like Serena/Vivienne/Yuna (see `character-look`), clothed. A plain office look
  was rejected as "not sexy, not chatty".

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

First the look: skill `character-look` (face design from the role + a LoRA from the tensor.art OC channel). LoRAs may
repeat across characters; the prompt must be written for this character, never copied.

Order (owner, 2026-11-11: **no white backdrop, no cut-outs**): main portrait made in the character's own setting (it is the
card avatar as-is) -> 8 expressions by Img2Img from it (changed pose) -> 8 scenes in `public/characters/backgrounds/<id>/`.
Chat = scene backdrop + expression pictures as mood cards (leave `cutouts` out). Everything WebP via `sharp` (portraits
768×1024 q82, scenes 1152×768). Show the owner each picture type before the next.

## 4. Verify

- Node check scripts need a resolve hook because imports have no `.js` extension (see `CLAUDE.md`): data merges, prompt builds,
  `truthFor` stages, 8 expression files exist, all `sceneSet` paths exist.
- Run the app without login: main folder, `NEXT_PUBLIC_SUPABASE_URL=` and `NEXT_PUBLIC_SUPABASE_ANON_KEY=` set empty,
  `npx next dev -p 3002` (a temp copy with a `node_modules` junction breaks webpack). Check card, profile sheet, opening card,
  backdrop, mood cards.
- One real Gemini message (quota is tiny; never loop). Look for: in character, no invented facts, scene tag present.
- `next build` before pushing (Camille was pushed on the owner's order without it; do the build first, it takes a minute).
- Quick UI check without login: `preview_start` name `nologin-main` (port 3002, in `.claude/launch.json`), open the card, the profile
  sheet, then "เริ่มแชท": the role dialog opens first (close it), then the opening card + backdrop show.
- Credits: a whole character costs about 40-45 tensor.art credits with retries (portrait tests 0.8 each, 8 expressions 2.8 each,
  8 scenes 0.8 each). Check the balance before starting.

## 5. Ship

One commit for assets + data, separate commits for later fixes. Pushing to `main` deploys production: confirm with the owner
first. After deploy, open the live card and check the asset URLs return 200.

## Gotchas

- The shell here mangles backslashes in heredocs; write scripts with the Write tool.
- dcg blocks recursive `Remove-Item`, runtime-expanded PowerShell launchers and `sleep` chains: use Monitor plus run scripts.
- Raw `{😠}` mood markers must not show in the chat-list preview (`lastMessagePreview` strips them).
