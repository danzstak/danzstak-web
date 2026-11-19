# 34: "Get SYNC as its own app" must put a SYNC icon on the home screen (owner, 2026-11-18)

**Owner:** "When users add SYNC as its own app it should save it to the desktop" (phone home screen). Today the row in SYNC ⋮ → "Get SYNC as its own app" doesn't install anything on the owner's Android phone.

## Likely root cause
`sync.webmanifest` has `"scope": "/"` — the same scope as the main DanzStak app (`manifest.webmanifest`). Chrome on Android installs one app (WebAPK) per scope, so with DanzStak already installed it treats SYNC as "already installed": `beforeinstallprompt` never fires and the button can't install. (Check with `chrome://webapks` and DevTools → Application → Manifest on a real phone.)

## Build
1. Give SYNC its **own scope**: serve SYNC under `/sync/` (e.g. `/sync/` → the SYNC shell via an Amplify rewrite in `infrastructure/amplify-custom-rules.json`, or move the standalone page there), `"scope": "/sync/"`, `"start_url": "/sync/?app=sync"`, keep `"id": "/sync"`. Everything SYNC navigates to while installed (chat list, threads, calls, answer links) must stay inside `/sync/`; links out to Mix/profile open the DanzStak app or browser.
2. The service worker must control `/sync/` (same worker, root scope) so offline/push work; push notifications for calls/messages open the SYNC app when it's installed.
3. The row "Get SYNC as its own app": if `beforeinstallprompt` is available → one tap shows the install prompt; if not (iPhone, or browser without the prompt) → clear steps with the phone's own words (Android: ⋮ → "Install app" / "Add to Home screen"; iPhone: Share → "Add to Home Screen"), opened from `/sync/` so the right manifest is used; if already installed (`display-mode: standalone` under `/sync/`) → "SYNC is installed on this phone".
4. Same account, no second login (cookie session is shared on the origin).

## Tests
- Manifest test: SYNC scope ≠ DanzStak scope, start_url inside scope, icons present, id `/sync`.
- Browser check: `/sync/` loads the chat list; the install row shows the right state for prompt-available / not-available / installed.
- Owner real-phone test on Android with DanzStak already installed: install SYNC → a second icon "SYNC" appears and opens straight to chats.
