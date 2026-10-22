---
name: character-portrait
description: Generate an AI portrait for a Botbaat character on tensor.art (in the user's Chrome), save it to public/characters/<id>.webp and set it as that character's avatar in constants/characters.js. Use when the user asks to make, generate, or redo a picture/avatar/รูป for a character (e.g. "ทำรูปให้เลโอ", "gen avatar for mew", "เปลี่ยนรูปเอวาใหม่").
---

# Character portrait

Makes one portrait per character with the same size and prompt shape, so every card in the grid looks consistent.

## 1. Build the prompt

1. Find the character in `constants/characters.js` by `id` or `name`. Read `description`, `tagline`, `scenario`, `category`.
2. There is no appearance field. Pick a look that fits the personality and setting (hair, outfit, background). If the user gave a look, use theirs. Keep the look you chose in your reply so it can be reused.
3. Age: always an adult. Use the age from `description` if it is 20 or older, otherwise write `25 years old`. Always include `adult`.
4. Fill this template (keep the order; swap only the `<...>` parts):

```
masterpiece, best quality, semi-realistic, 2.5D anime style, portrait of a young adult <woman|man>, <age> years old, <hair>, <expression that fits the personality>, <outfit>, soft cinematic lighting, <background from scenario>, bokeh, upper body, looking at viewer
```

Keep it safe-for-work: no nudity, no suggestive poses or wording.

## 2. Generate on tensor.art (Claude in Chrome)

The built-in browser pane gets stuck on Cloudflare at tensor.art, so use Claude in Chrome (load the `anthropic-skills:chrome-browser` skill first).

1. `tabs_context_mcp`, open a new tab, go to `https://tensor.art`.
2. If it shows **Sign In** at top right, stop and ask the user to sign in themselves (never type credentials, never tick the Cloudflare box). Continue after they confirm.
3. Click the **Create / สร้าง** button in the top bar. Do not navigate to `/create`: that URL shows "This content is unavailable".
4. In the left panel, leave the default model (Z-Image-Turbo) unless the user asks for another. Under aspect ratio choose **custom**, set width `768`, height `1024`.
5. Click the prompt box at the top, type the prompt, click the green **สร้าง / Create** button (about 0.36 credits per image; mention the cost and remaining credits shown at top left).
6. Wait about 30 seconds, screenshot, and show the user a zoomed preview. Ask if they want to keep it or regenerate (different seed or tweaked prompt). Do not download before they say yes.

Known result: Z-Image-Turbo comes out photo-realistic even with "anime" in the prompt. For a real 2.5D anime look, add a semi-realistic / Niji style LoRA via **เพิ่ม LoRA** (only if the user asks).

## 3. Download into the project

The full-size image URL is a signed link the browser tool hides, so use the site's own download button.

1. Note the time, then hover the result image and click the download icon in its top-right toolbar (middle icon of the three).
2. In a shell, wait for a new file in `C:/Users/User/Downloads` named like `TA-<date>-<time>-masterpiec-<seed>.png` (ignore `.crdownload`).
3. Convert it with `sharp` (in node_modules) to `public/characters/<id>.webp`, quality 82 — about 30–50 KB instead of
   ~850 KB. Check it is 768×1024. Do not commit the PNG.

Several at once: Chrome blocks a site's second automatic download until the user allows "multiple downloads" for
tensor.art (ask them; never accept it yourself). After that, a page script can `fetch()` each result `<img>`'s
`currentSrc` and save it via an `<a download="botbaat-<id>.png">`. Some files stay as `<uuid>.tmp` though complete —
match them by byte size, then check a contact sheet so no two characters are swapped.

## 4. Set the avatar

1. In `constants/characters.js`, change that character's `avatar:` to `'/characters/<id>.webp'`.
2. Preset avatars come straight from code (only custom characters live in localStorage), so no cache clearing is needed.
3. If the dev server runs, open `http://localhost:3000` and check the card's `<img alt="<name>">` loads `/characters/<id>.webp` with natural size 768×1024.

Do not commit unless the user asks. Leave the tensor.art tab open if the user may do another character; close it otherwise.
