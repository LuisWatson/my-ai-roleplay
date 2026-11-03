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

## Realistic recipe (2026-11-03, owner's pick: "must look like a real person")

The owner wants real-person faces like popular tensor.art posts, not the semi style look. Their posts use the same 8-step
Krea speed but a different base and stacked LoRAs. Recipe (tested on Noelle, owner liked "picture 3"):

- Base: **REAL PHOTOGRAPHY (realism/photorealistic)**, version **KREA 2** (base picker: search "REAL PHOTOGRAPHY KREA", the
  card defaults to version MOSS; switch the dropdown to KREA 2).
- LoRAs: **Angel Face (Krea2) 0.8** + **Cherish ! <3 0.4** + **SerenFace (version "Testing") 0.3**. Fastest set-up: open the
  Angel Face model page, click its first sample image, press "ทำซ้ำ" and decline the "recommended parameters" dialog.
- 768×1152, 8 steps, CFG 1, euler/simple. Text2Img 0.8 credit; Img2Img 2.8 credits.
- Prompt: beauty words + Noelle's look + confident expression + warm cinematic light. A pure beauty prompt (douyin makeup,
  blush, bright beauty lighting) looked prettier but flat and doll-like; mixing both looked best. Template used:
  `1girl, solo, beautiful young Asian woman, 24 years old adult, gorgeous delicate face, small face with defined jawline,
  flawless fair skin, smooth natural skin texture, large sharp almond-shaped <eye colour> eyes, aegyo-sal, long fluttery
  eyelashes, soft natural makeup, gradient pink glossy lips, <hair>, <expression>, <outfit>, <pose>, <place>, softly blurred
  background, warm cinematic lighting with gentle shadows, soft key light on her face, cinematic photography, realistic skin
  texture, upper body, looking directly at viewer, highly detailed`.
- Negative must include `other people, person in background`: a restaurant kitchen made the model add staff behind her.
  With CFG 1 the negative is weak; the Img2Img expressions still got a person in the background.
- Expressions by Img2Img from that picture, same base + LoRAs, denoise 0.72: the face held (happy was good; angry came out
  sulky, needs a stronger prompt).
- Cut-out test (rembg) on the kitchen version: face and hair clean, but the stove, dark smudges and the ponytail cut by the
  top edge stayed. The owner then chose **no cut-outs** for realistic characters: scene as the chat backdrop, expression
  pictures as mood cards (leave `cutouts` out). So expressions come straight from the kitchen picture, no white backdrop.
- Wired for Noelle (2026-11-03): main = picture 3 (`drafts/noelle_v2_base.png`), happy/shy/sad/angry by Img2Img, all cropped
  768×1152 → 768×1024 from the top, saved with new names (`noelle_r*.webp`) so phones don't show cached old pictures.
- Earlier results stay in tensor.art's task list (งาน tab, Img2Img/Text2Img filters): reuse them before paying again. The
  list is virtualised, so collect `img` URLs (`workspace/generation`) while scrolling it.

## Expressions (happy / shy / sad / angry)

Hands and extra people (Serena's 4 newer expressions): asking for a new hand pose (finger on chin, hand near the mouth,
holding her arm) gave an arm growing from the chest, a finger stuck to the lips and a stranger's hand on her arm. Keep the
source pose (`same pose as the source, one hand resting on her hip`) and change only the face. Do not write "alone",
"no other people" or "no one" in the prompt: those words brought people into the background. Put them in the negative
prompt instead (open it with the Negative button; append `(extra arms, extra hands, other people, another person, hand of
another person:1.3), finger in mouth, hand on face`). Untick A1111. Check every picture zoomed in (hands, background) before
showing the owner. With the pose locked, a mild expression ("thoughtful", "teasing smirk") at denoise 0.65 looked the
same as the portrait; ask for something visible in the face (eyes looking up to the side, a wink) and use denoise ~0.72.

Warning: with the Krea + semi style recipe Img2Img did not keep Serena's face (bangs and a hair clip appeared, face shape drifted even at denoise 0.65), so her expression set was dropped; raising denoise changes the face, lowering it leaves the expression unchanged. Judge each set against the main portrait before wiring it in. What was tried: Img2Img from the main portrait with the main portrait uploaded as the source (copy the PNG into the scratchpad first, the upload tool only reads session folders), Krea-2 Turbo + semi style **0.7**, **denoise 0.65** (0.8 changed her face), ~2.8 credits each, prompt = weighted **eye colour first** (`(amber brown eyes:1.4), (golden brown irises:1.3)`: without it the eyes turn grey; weights of 1.5 or more raise a warning dialog) + weighted expression + pose + hair/dress/place, e.g. `(gentle warm closed-mouth smile:1.4), (happy bright eyes:1.3), head slightly tilted, ...`.

Do not use text-to-image again (the face changes). Use **Img2Img** from the main portrait: same model + LoRA 0.5, strength **0.8**, about 1.26 credits each, and describe a different pose in the prompt. The upload field only accepts JPEG/PNG (not WebP). The free account runs about 2 tasks at once. For the Krea set-up above (Vivienne): Img2Img locks the size to the source image (768×1024 is fine), LoRA 1.0 barely changes the expression, so set both LoRAs to **0.7** with a high denoise; too low a LoRA drifts the face. Use a short prompt that starts with the weighted expression and pose, e.g. `(gentle warm smile:1.4), (happy bright eyes:1.3), head tilted, one hand brushing hair behind her ear, different pose, 1girl, <hair>, <dress>, <necklace>, upper body, photorealistic, glowing porcelain skin, ...`; leave out face/hair/eye detail the source image already has. Its cost is about 2.8 credits per image.
Save as `public/characters/expressions/<id>_{happy,shy,sad,angry}.webp` (768×1024) and set `expressions` on the character.

## Expressions with a changed pose + cut-outs (Noelle, 2026-11-03: the recipe to use now)

The older notes above say the pose must stay and Serena's set was dropped; Noelle's set worked like this, so prefer it.

1. **Source portrait on a white high-key backdrop** with headroom above the hair (a dark jacket on a dark backdrop cuts out
   badly, and a clipped ponytail looks "แหว่ง" as a backdrop). Use it only as the Img2Img source and the rembg source.
2. **8 expressions** (happy, shy, sad, angry, thinking, surprised, teasing, worried), each a visibly different pose:
   Img2Img from that source, Krea-2 Turbo + semi style LoRA **0.7**, **denoise 0.72**, prompt = weighted eye colour first,
   then weighted expression + pose, then the short look. An angry face needs a strong prompt (frown, narrowed eyes,
   crossed arms); the first try looked not angry. Zoom on every picture (hands, extra people). Known leftover: shy,
   thinking and teasing may show slight bangs that the main portrait does not have; the owner accepted that.
3. **Cut-outs**: rembg through its **Python API** (the CLI crashes on gradio / `HfFolder`; pip must be upgraded first),
   model `isnet-general-use`, alpha matting on. Run it in a venv inside the session scratchpad. Save as
   `public/characters/cutouts/<id>.webp` (main) and `<id>_<key>.webp`, transparent WebP 768×1024.
4. Contact-sheet all 9 cut-outs before wiring `expressions` and `cutouts` in `constants/characters.js`.

## Downloading many pictures from tensor.art

The "download" helper kept returning the wrong image (a thumbnail or the previous result) and a Create click was dropped
when the prompt box had grown. What worked: set the prompt with a script, click Create by script, wait for the task to
finish, take the **largest** result `<img>` in DOM order, and check its `src` differs from the previous one before saving.
Chrome leaves some downloads as `<uuid>.tmp`; match them by byte size, then look at a contact sheet. Delete duplicates by
hand. Leftovers in `Downloads` (`.tmp`, `botbaat-*.png`) are the owner's to clean.

## Main portrait needs a background (Noelle, 2026-11-03)

A white-backdrop portrait (made so the cut-out is clean) must NOT be the card avatar: on the home grid it looks empty next to
the others. Keep the white one only as the rembg source; make `public/characters/<id>.webp` by compositing the cut-out
(`cutouts/<id>.webp`) over the character's first scene (cover-resize to height 1024, crop centre 768, blur ~6, brightness 0.8)
with `sharp`. No credits needed.

## Scene backgrounds (characters with a `sceneSet`)

Prompt: `masterpiece, best quality, semi-realistic, <place>, no people, cinematic, dim moody lighting, bokeh, wide shot, background scenery`.
Noelle's 8 scenes used **Krea-2 Turbo with no LoRA**, 1152×768 (not Z-Image-Turbo). Write the place as **empty** (`empty cafe`,
`empty market stalls`): "no people" alone still brought a blurred crowd. Small text on signs/chalkboards comes out garbled;
dimmed and blurred in the chat it is fine. Check each scene for tiny figures at the edges. Save as `public/characters/backgrounds/<id>/<scene>.webp` (1152×768, quality 82) and set each scene's `src`.

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
