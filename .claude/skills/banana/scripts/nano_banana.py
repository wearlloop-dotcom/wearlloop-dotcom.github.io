#!/usr/bin/env python3
"""Generate or edit images with Google Gemini image models (Nano Banana).

Standalone REST client — no third-party dependencies.

Usage:
  # text-to-image
  python3 nano_banana.py --prompt "..." --out out.png

  # image editing / redesign (pass one or more reference images)
  python3 nano_banana.py --prompt "..." --image room.jpg --out redesign.png

API key: reads GOOGLE_AI_API_KEY (or GEMINI_API_KEY / GOOGLE_API_KEY) from the
environment, or --api-key. Get a free key at https://aistudio.google.com/apikey
"""

import argparse
import base64
import json
import mimetypes
import os
import sys
import time
import urllib.error
import urllib.request

API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
DEFAULT_MODEL = "gemini-3.1-flash-image-preview"
# Fallbacks tried in order if the default model returns 404 (name rotation).
FALLBACK_MODELS = [
    "gemini-2.5-flash-image",
    "gemini-2.0-flash-preview-image-generation",
]


def build_payload(prompt, image_paths, aspect_ratio):
    parts = []
    for path in image_paths:
        mime = mimetypes.guess_type(path)[0] or "image/jpeg"
        with open(path, "rb") as f:
            data = base64.b64encode(f.read()).decode("ascii")
        parts.append({"inline_data": {"mime_type": mime, "data": data}})
    parts.append({"text": prompt})

    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]},
    }
    if aspect_ratio:
        payload["generationConfig"]["imageConfig"] = {"aspectRatio": aspect_ratio}
    return payload


def call_api(model, payload, api_key, max_retries=3):
    url = f"{API_BASE}/{model}:generateContent"
    data = json.dumps(payload).encode("utf-8")
    last_err = None
    for attempt in range(max_retries):
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": api_key,
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                return json.loads(resp.read().decode("utf-8")), None
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            if e.code == 429 and attempt < max_retries - 1:
                time.sleep(2 ** (attempt + 1))
                last_err = f"429 rate limited: {body[:300]}"
                continue
            return None, f"HTTP {e.code}: {body[:500]}"
        except urllib.error.URLError as e:
            if attempt < max_retries - 1:
                time.sleep(2 ** (attempt + 1))
                last_err = f"network error: {e.reason}"
                continue
            return None, f"network error: {e.reason}"
    return None, last_err or "unknown error"


def extract_image(response):
    """Return (bytes, mime) of the first image part, or (None, finish_reason)."""
    for cand in response.get("candidates", []):
        for part in cand.get("content", {}).get("parts", []):
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and inline.get("data"):
                mime = inline.get("mimeType") or inline.get("mime_type") or "image/png"
                return base64.b64decode(inline["data"]), mime
    reason = ""
    if response.get("candidates"):
        reason = response["candidates"][0].get("finishReason", "")
    return None, reason


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--prompt", required=True, help="Full engineered prompt")
    p.add_argument("--image", action="append", default=[],
                   help="Reference/input image path (repeatable, for editing)")
    p.add_argument("--out", required=True, help="Output image path (.png)")
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.add_argument("--aspect-ratio", default=None,
                   help='e.g. "1:1", "16:9", "4:3", "3:4", "9:16"')
    p.add_argument("--api-key", default=None)
    args = p.parse_args()

    api_key = (args.api_key or os.environ.get("GOOGLE_AI_API_KEY")
               or os.environ.get("GEMINI_API_KEY")
               or os.environ.get("GOOGLE_API_KEY"))
    if not api_key:
        print(json.dumps({"error": True, "message":
                          "No API key. Set GOOGLE_AI_API_KEY env var "
                          "(free key: https://aistudio.google.com/apikey)"}))
        sys.exit(1)

    for path in args.image:
        if not os.path.isfile(path):
            print(json.dumps({"error": True, "message": f"Input image not found: {path}"}))
            sys.exit(1)

    payload = build_payload(args.prompt, args.image, args.aspect_ratio)

    models = [args.model] + [m for m in FALLBACK_MODELS if m != args.model]
    response, err = None, None
    used_model = None
    for model in models:
        response, err = call_api(model, payload, api_key)
        if response is not None:
            used_model = model
            break
        if err and not err.startswith("HTTP 404"):
            break  # only rotate models on 404 (unknown model name)

    if response is None:
        print(json.dumps({"error": True, "message": err}))
        sys.exit(1)

    image_bytes, mime_or_reason = extract_image(response)
    if image_bytes is None:
        print(json.dumps({"error": True,
                          "message": f"No image in response (finishReason={mime_or_reason or 'unknown'}). "
                                     "If IMAGE_SAFETY, rephrase the prompt and retry."}))
        sys.exit(1)

    out_dir = os.path.dirname(os.path.abspath(args.out))
    os.makedirs(out_dir, exist_ok=True)
    with open(args.out, "wb") as f:
        f.write(image_bytes)

    print(json.dumps({"ok": True, "path": os.path.abspath(args.out),
                      "model": used_model, "bytes": len(image_bytes)}))


if __name__ == "__main__":
    main()
