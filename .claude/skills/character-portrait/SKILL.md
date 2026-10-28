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
4. In the left panel, pick the model **ZiT | Niji Style** and add the LoRA **NijiReal Silky Soft** (the owner's "ORIGINAL CHARACTER" look, same as Ellie and Ash) at strength **0.5**. At 0.8 the face drifts toward Ellie's, so use 0.5 for a new face. Under aspect ratio choose **custom**, set width `768`, height `1024`. Scene backgrounds are the exception: default Z-Image-Turbo, Landscape 1152×768, no LoRA.
5. Click the prompt box at the top, type the prompt, click the green **สร้าง / Create** button (about 0.36 credits per image; mention the cost and remaining credits shown at top left).
6. Wait about 30 seconds, screenshot, and show the user a zoomed preview. Ask if they want to keep it or regenerate (different seed or tweaked prompt). Do not download before they say yes.

Known result: plain Z-Image-Turbo comes out photo-realistic even with "anime" in the prompt, hence the Niji model + LoRA above. Write the exact appearance the owner gave (hair, eye colour, accessories) into the prompt; a small detail such as a mole may still not show.

Face-similarity lesson (Vivienne): the NijiReal LoRA gives every character the same doll face, even at 0.2. For a character who must look different, use **Krea-2-Turbo** + LoRA **GlowFace & PearlGlow** + **semi style** (both 1.0; open the GlowFace model page and press Run so base + LoRA load together), Text2Img 768×1024, prompt starting `masterpiece, best quality, photorealistic, glowing porcelain skin, soft pearl glow, 1girl, ...`.

Prompt box tip (embedded browser): the textarea is hidden, so fill it with `typeInPage` using the textbox ref from `readPage`. The ref changes after every generated image, so look it up again each time. Setting `.value` by script is ignored by the page ("Prompt cannot be null").

Standard recipe from Serena (2026-10-28), use this for new characters: official **Krea-2 Turbo** base + only the **semi style** LoRA (1.0, opens with its page's Run button; accept the "recommended parameters" dialogs), no GlowFace (it gives Vivienne's face to everyone), 768×1024, 8 steps. Let the prompt decide the face: `masterpiece, best quality, semi-realistic, 1girl, <age> years old adult <ethnicity> woman, <face shape>, <eyes>, <lips>, <hair>, <outfit>, <expression/pose>, <place>, soft cinematic lighting, bokeh, upper body, looking at viewer`. Keep outfits clothed. Tensor.art tips: the prompt textarea is the one whose text contains your prompt (set it with a script: native value setter + `input` event, then click Create); the LoRA picker only lists LoRAs for the current base model, so switch the base first (base picker → OFFICIAL MODEL → Krea-2 Turbo); the result's send-arrow icon opens a public *Post* dialog, do not use it; the download icon is the middle one; a click on Create while the previous task is still queued is dropped, so wait.

## Expressions (happy / shy / sad / angry)

Warning: with the Krea + semi style recipe Img2Img did not keep Serena's face (bangs and a hair clip appeared, face shape drifted even at denoise 0.65), so her expression set was dropped; raising denoise changes the face, lowering it leaves the expression unchanged. Judge each set against the main portrait before wiring it in. What was tried: Img2Img from the main portrait with the main portrait uploaded as the source (copy the PNG into the scratchpad first, the upload tool only reads session folders), Krea-2 Turbo + semi style **0.7**, **denoise 0.65** (0.8 changed her face), ~2.8 credits each, prompt = weighted **eye colour first** (`(amber brown eyes:1.4), (golden brown irises:1.3)`: without it the eyes turn grey; weights of 1.5 or more raise a warning dialog) + weighted expression + pose + hair/dress/place, e.g. `(gentle warm closed-mouth smile:1.4), (happy bright eyes:1.3), head slightly tilted, ...`.

Do not use text-to-image again (the face changes). Use **Img2Img** from the main portrait: same model + LoRA 0.5, strength **0.8**, about 1.26 credits each, and describe a different pose in the prompt. The upload field only accepts JPEG/PNG (not WebP). The free account runs about 2 tasks at once. For the Krea set-up above (Vivienne): Img2Img locks the size to the source image (768×1024 is fine), LoRA 1.0 barely changes the expression, so set both LoRAs to **0.7** with a high denoise; too low a LoRA drifts the face. Use a short prompt that starts with the weighted expression and pose, e.g. `(gentle warm smile:1.4), (happy bright eyes:1.3), head tilted, one hand brushing hair behind her ear, different pose, 1girl, <hair>, <dress>, <necklace>, upper body, photorealistic, glowing porcelain skin, ...`; leave out face/hair/eye detail the source image already has. Its cost is about 2.8 credits per image.
Save as `public/characters/expressions/<id>_{happy,shy,sad,angry}.webp` (768×1024) and set `expressions` on the character.

## Scene backgrounds (characters with a `sceneSet`)

Prompt: `masterpiece, best quality, semi-realistic, <place>, no people, cinematic, dim moody lighting, bokeh, wide shot, background scenery`. Save as `public/characters/backgrounds/<id>/<scene>.webp` (1152×768, quality 82) and set each scene's `src`.

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
