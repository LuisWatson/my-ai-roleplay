---
name: character-look
description: Design a Botbaat character's face and pick the tensor.art LoRA "preset" for it from the ORIGINAL CHARACTER (OC) channel, so every character gets its own look instead of copying a previous recipe. Use before any portrait of a new or redone character ("ทำรูปตัวละคร", "หน้าเหมือนตัวเก่า", "เลือก preset", "หาสไตล์หน้า"), then generate with the character-portrait skill.
---

# Character look (OC presets on tensor.art)

Owner's rule (2026-11-11): the face comes from the character's role. **The model/LoRAs may repeat; the prompt must be
the character's own, never copied from an earlier character.** Yuna got Noelle's exact recipe (Angel Face 0.8 + Cherish + SerenFace, "aegyo-sal, glossy lips") and
came out with Noelle's face. Also: no white backdrop and no cut-outs; the main portrait is made in the character's own
setting and is the card avatar as-is.

Owner's taste (2026-11-12): Vivienne and Serena are the favourites, semi-real 2.5D on the official **Krea-2 Turbo** base.
Start there. REAL PHOTOGRAPHY KREA 2 (Noelle's photo look) made Yuna look like Noelle even with another LoRA.
tensor.art blocks some words (e.g. "cleavage": use "deep V neckline"); the free account runs 1 task at a time (a
second Create jumps to the Pro purchase page); set the prompt by script only while the prompt box is expanded.

## 1. Read the role, write the face design

From `constants/characters.js` + `constants/characterProfiles.js` (`description`, `profile.appearance`, `personality`,
`scenario`, `category`, `tagline`) decide, and tell the owner in 2-3 Thai lines before spending credits:

- **Vibe in 3 words** (e.g. Yuna: quiet, otherworldly, warm-sad; Noelle: bright, cocky, sweet).
- **Face**: shape (oval / long / round / sharp jaw), eyes (monolid / hooded / cat-eye / round, upturned or downturned),
  brows, nose, lips (thin / full, glossy or bare), makeup level, skin (porcelain, freckles, mole), apparent age.
- **Hair + outfit + setting + light** from the story (the opening scene is a good backdrop).
- **What must differ** from every existing preset (look at `public/characters/*.webp` first: name the closest one and
  the 2 features that will be different).

## 2. Pick the preset from the OC channel

Channel: `https://tensor.art/channels/107?tab=models&tag=606434981446745735` (ตัวละคร → ORIGINAL CHARACTER, tab โมเดล).
Only **KREA_2** LoRAs work with the realistic base (REAL PHOTOGRAPHY KREA 2 or official Krea-2 Turbo).

Look at thumbnails, not names. `sheet.js` (next to this file) builds a numbered thumbnail sheet of the top KREA_2 LoRAs
in the open channel tab: run it with the Chrome `javascript_tool`, screenshot, remove it with
`document.getElementById('ocsheet').remove()`.

Catalogue (top KREA_2 LoRAs by uses, 2026-11-11; my reading of each sample picture):

| LoRA (search name) | look | used by |
|---|---|---|
| Doll-Faced Angel (NxyF!ng) | bright anime-doll, big eyes, sunny pop | |
| korean Doll (moéline) | soft K-beauty, warm natural light, girl-next-door | |
| Doll Face & Milky (NxyF!ng) | douyin doll, milky pale skin, glossy lips | |
| Sweet doll (veloura) | pale ethereal, black hair, cool soft light, quiet | |
| Veloura Doll & Beauty Body | bright summer, curvy, holiday | |
| Semi-Realistic Anime Style & Lighting (NxFang) | anime-leaning semi-real, vivid light | |
| Angel Face (moéline) | angelic doll face, white lace | **Noelle 0.8** |
| Meowing (Mirená) | ornate dark glam | |
| Bad Habit (Nini.Nozomi) | dark moody gothic, cold, tattoos | |
| seraphim (veloura) | blonde gothic-lolita, dramatic | |
| Dreamy Beauty (Nini.Nozomi) | warm golden, soft romantic | |
| sharp cat eyes (NxFang) | sharp upturned eyes, cool elegant, oriental dress | |
| CateyesGirl (Jeneen Luna) | delicate cat-eye, lace, bridal soft | |
| Highly (Iris s) | pastel pink fantasy | |
| Qingxi (veloura) | dark Chinese-classic elegance, red/black, fan | |
| Semi Realistic (NxyF!ng) | clean semi-real, everyday, glasses | |
| La Roselle (maryjanier) | monochrome gothic lace | |
| Vivienne - Fiòrella (moéline) | vintage romantic, roses, hats | |
| hime face (moéline) | hime cut, cozy indoor | |
| Lunaria (Nini.Nozomi) | candlelit ethereal blonde | |
| Haunted Melody (Nini.Nozomi) | ghostly pale, dark, haunting | |
| Cherry Gloss (Nini.Nozomi) | candlelit vintage, veils, warm | |
| semi style | clean semi-real (owner's favourite look) | **Serena 1.0**, **Yuna 1.0** (expressions 0.7), **Camille 0.4** (at 1.0 it gave her Serena's face) |
| TrustTheProcess-Beta (Nini.Nozomi, trigger `ninilux`) | Western-leaning glam face, defined cheekbones, warm skin; ignores body words alone, needs semi style 0.4 for a curvy figure | **Camille 0.6** |
| GlowFace & PearlGlow (NxyF!ng) | porcelain glow | **Vivienne** (gives her face to all) |
| SerenFace (moéline) | soft natural face | Noelle 0.3 |
| Cherish (ᴍ1nd) | realistic skin/finish helper | Noelle 0.4 |
| Male: Softvisuals, Hyper-detailed, Bad Romeo, JJJ Facet, Semi-realism Hyper, คนนสเปค SemiReal, BODY V-Taper | male looks | |

Rules:
- Owner (2026-11-11): **models/LoRAs may be reused across characters; the prompt may not.** Each character's prompt is
  written fresh from its own face design (step 1): never paste or lightly edit another character's prompt or its beauty
  words. Pick the LoRA that fits the role, whether or not another preset uses it (keep the "used by" column current).
- Keep a face LoRA at 0.5-0.7 so the prompt's face design still counts; at 0.8+ the LoRA overrides the prompt and two
  characters on the same LoRA end up with the same face.
- Open the chosen model page before using it: read its trigger words, recommended base, weight, steps/CFG; copy them.
- Prompt = the face design from step 1 in plain words, then hair/outfit/pose/setting/light. Leave out generic beauty words
  (aegyo-sal, glossy lips, flawless, gorgeous) unless the design asks for them. Put unwanted features in the negative
  (e.g. `aegyo-sal, double eyelids` for a monolid design) plus `other people, person in background`.
- Make 2 pictures, compare them side by side with the closest existing preset before showing the owner. If the face is
  close to an existing one, change the LoRA or its weight, not just the seed.

## 3. Then

Generate, download, expressions and scenes with the `character-portrait` skill (settings: 768×1152 portrait, 8 steps,
CFG 1). Record the chosen LoRA + weights + face design in `worklog.md` and in the table above.
