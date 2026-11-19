# 32: Share a phone photo straight to DanzStak (owner, 2026-11-18)

**Owner:** "When users take a photo with their cell I want them to be able to share to DanzStak."

Make the installed DanzStak app show up in the phone's **Share** menu (Android Chrome/Edge/Samsung Internet support the Web Share Target API for installed PWAs; iPhone Safari does not yet, so iPhone users keep using the + photo button).

## Build
1. `manifest.webmanifest`: add `share_target` → `{"action": "/share-target", "method": "POST", "enctype": "multipart/form-data", "params": {"title": "title", "text": "text", "url": "url", "files": [{"name": "media", "accept": ["image/jpeg","image/png","image/webp","image/heic","image/gif","video/mp4","video/quicktime","video/webm"]}]}}`. **No audio types** (CLAUDE.md: never music files).
2. `service-worker.js`: handle `POST /share-target`: read the form data, keep the shared files in a short-lived Cache/IndexedDB entry (deleted after use or after 10 minutes), then `Response.redirect("/feed.html?share=1", 303)`.
3. Mix: on `?share=1`, open the post composer with the shared photos/videos already attached and any shared text in the box; the member picks the audience and taps Post (nothing posts on its own). Signed out → sign in first, then come back to the composer with the files.
4. Shared photos/videos are saved into the member's **"Phone photos"** album (created on first share; the member can rename it, e.g. "Cell photos"), and the composer offers a small album picker so they can choose another album (e.g. "Concert pictures") before posting. Albums: CLAUDE.md plan step 2.
5. Shared posts follow the normal rules (Dailies 24 h, videos to The Roll, ownership, Delete everywhere).
6. Update the manifest version and the PWA tests; the member may need to reinstall or reopen the app once for Android to pick up the new share target — say so in the release note.

## Tests
- Unit test the service-worker share handler (files kept, redirect, cleanup, audio rejected).
- Browser check: POST multipart to `/share-target` through the worker → composer shows the files at 360/390px.
- Owner real-phone test on Android: Camera/Gallery → Share → DanzStak.
