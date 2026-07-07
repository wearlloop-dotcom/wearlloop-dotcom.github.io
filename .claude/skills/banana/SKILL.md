---
name: banana
description: "AI image generation and photo editing powered by Google Gemini image models (Nano Banana). Use for ANY request to generate an image, edit/redesign a photo, redesign a room like an interior designer, restyle a product photo, create a banner/logo/visual, or any /banana command. Supports text-to-image and image-to-image editing with reference photos."
argument-hint: "[generate|edit] <idea or image + instructions>"
---

# Banana — AI Image Generation & Redesign (Gemini Nano Banana)

Generate new images or intelligently edit/redesign uploaded photos via the
Google Gemini image API. The classic use case: user uploads a photo of a room
and asks to "redesign this room like a professional interior designer" — you
act as the creative director, engineer a strong prompt, and call the script.

## Requirements

- Env var `GOOGLE_AI_API_KEY` must be set (free key: https://aistudio.google.com/apikey).
  If it is missing, stop and tell the user to add `GOOGLE_AI_API_KEY` in their
  Claude Code environment settings (or paste a key to use for this session only —
  never write the key into any repo file).

## Workflow

1. **Understand intent.** Is this text-to-image (generate) or editing an
   existing photo (edit/redesign)? If the user attached an image, it is almost
   always an edit. If the request is ambiguous, ask one short question.
2. **Engineer the prompt — never pass raw user text.** Build a rich prompt with
   this structure: *Subject → Action/Change → Setting/Context → Composition &
   camera → Style/Lighting/Mood*. Written in English (translate Thai requests),
   concrete and visual, 50–150 words.
   - **Interior redesign**: name the design style (e.g. warm minimal, Japandi,
     mid-century modern), palette, materials, furniture changes, lighting, and
     what must stay (windows, room geometry, structural walls). Say "keep the
     same room layout, walls, windows and perspective" unless the user wants a
     new layout.
   - **Editing**: describe only the change plus "keep everything else identical."
   - **Product/fashion photos** (LLOOP use case): specify garment fidelity —
     "keep the garment's exact color, pattern and shape."
3. **Run the script** (from this skill's directory):
   ```
   python3 scripts/nano_banana.py \
     --prompt "<engineered prompt>" \
     [--image <input photo> ...] \
     --aspect-ratio 4:3 \
     --out <scratchpad>/banana/<short-name>.png
   ```
   Save outputs to the session scratchpad, NOT into the repo. Use
   `--aspect-ratio` matching the input photo for edits (omit to let the model
   decide). Repeat `--image` to pass multiple reference photos.
4. **Check the JSON result.** On `"ok": true`, send the image to the user with
   SendUserFile (display: render) and describe in 1–2 sentences the design
   choices you made. On error:
   - `IMAGE_SAFETY` → rephrase the prompt more neutrally and retry (max 2).
   - `HTTP 400` mentioning billing/precondition → tell the user to enable
     billing or use a model available on the free tier; do not retry.
   - `HTTP 404` → the script already rotates model names; report the error.
   - Missing API key → see Requirements above.
5. **Iterate.** The user will ask for tweaks ("เปลี่ยนโซฟาเป็นสีครีม",
   "โทนอบอุ่นขึ้น", "จัด layout ใหม่"). For each tweak, pass the **previous
   output image** as `--image` with an edit prompt describing only the change.
   Keep filenames versioned (`room-v1.png`, `room-v2.png`) so the user can compare.

## Commands

| Command | Behavior |
|---|---|
| `/banana <idea>` | Detect intent, engineer prompt, generate |
| `/banana generate <idea>` | Text-to-image |
| `/banana edit <path or attached image> <instructions>` | Edit/redesign the photo |

## Notes

- Never report success until the output file exists.
- Never commit generated images or the API key to the repository.
- Each image costs roughly $0.01–$0.15 depending on the model; mention cost
  only if the user asks or requests a large batch.
