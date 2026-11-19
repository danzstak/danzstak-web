# 37 — Media at 720p for faster loading (owner 2026-11-19)

Owner: "I need all the video and images scaled to 720p for faster load time" — "vertical and horizontal scaling for the boxes".

720p box: **landscape fits 1280×720, portrait fits 720×1280**, never scaled up, aspect ratio kept (no stretching, no crop).

## Part 1 — photos (done in this PR, browser only, no deploy)
`assets/media-scale.js`: every photo picked in any file picker on Mix, profile, Tribes, SYNC, EPK and events is scaled
in the phone before upload (JPEG/WebP quality 0.82, PNG stays PNG). GIFs, HEIC the browser can't draw and non-images
pass through; `data-no-scale` opts an input out. Smaller uploads, smaller downloads, same upload API.

## Part 2 — videos (needs the owner's go-ahead: new AWS service + cost)
Phones can't re-encode video reliably in the browser, so videos are scaled on the server:
- S3 `ObjectCreated` on the uploads prefix → small Lambda → **AWS Elemental MediaConvert** job: H.264 MP4, fit inside
  1280×720 / 720×1280 (QVBR, ~2.5 Mbps cap), AAC audio kept, `+faststart` for quick start, plus a poster JPEG.
- Output written next to the original (`…/720p.mp4`); the post/Daily/Roll record gets `mediaKey720` and the signed URL
  prefers it; the original stays until the 720p copy exists (nothing breaks while a job runs). Delete everywhere removes both.
- Cost to check before enabling: MediaConvert is billed per output minute (Basic tier, SD/HD). Owner approves the
  region (us-west-1), the IAM role and the cost.
- Existing videos: a one-off batch (same job per existing mediaKey), dry run first.
- Alternative if MediaConvert is not wanted: a Lambda container with ffmpeg (no per-minute fee, slower, 15-minute limit).

## Part 3 — existing photos
One-off script: re-encode stored photos larger than 720p with `sharp` into the same keys' `720p` variant, dry run first.
