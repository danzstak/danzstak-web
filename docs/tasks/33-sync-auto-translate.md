# 33: SYNC auto-translates messages into your language (owner, 2026-11-18)

**Owner:** "If you could get SYNC to auto translate text into native language if users turn on auto translate." Also: "real-time translations as well" — calls are covered by task 21 (live captions); this task is **text messages**.

Read first: `CLAUDE.md` (SYNC rules, independence rule: no Google/Apple services), `assets/direct-messages.js` (message rendering), `assets/sync-settings.js`, `assets/i18n.js` (app language), `infrastructure/auth-api/index.mjs` (route style), `docs/tasks/21-call-translation.md` (same provider).

## Build
1. **Setting:** SYNC ⋮ → **Auto-translate messages** (off by default) and **Translate into:** the member's app language (changeable). Per chat override in the chat ⋮ ("Translate this chat": On / Off / Use my setting).
2. **What happens when it's on:** an incoming message whose language differs from the target is shown **translated**, with a small line under the bubble "Translated from Italian · **Show original**" (tap toggles). The member's own messages are never translated. Music cards, links, @mentions, emoji-only and code-like text are left as they are. Voice messages are not translated here (task 21 later).
3. **Server:** `POST /sync/translate` on the Auth API: `{ messageIds[], target }` → translations for messages the caller is allowed to read (server checks the conversation membership; never translate arbitrary text sent by the client). Provider: **Amazon Translate** (`TranslateText`, auto-detect source), swappable like the AI provider. Cache each result per message + target language in DynamoDB (TTL 30 days); **Delete everywhere** deletes the cached translations too.
4. **Privacy:** only the receiver's own choice sends a message to the translation service; nothing is used for training; copy in Settings: "Messages you receive are sent to Amazon Translate to translate them. Machine translation can be wrong."
5. **Limits:** max 4,000 characters per message; fair-use cap per member (e.g. 3,000 messages/day) with a polite message when reached. **Price: owner decision pending** — build it free behind a flag `SYNC_TRANSLATE_ENABLED`; if the owner later wants a paid pack it reuses the Translation pack from task 21.
6. **Fail-closed:** without the provider permission or with the flag off, the setting shows "Auto-translate coming soon" and nothing is sent.
7. Batch: translate visible messages in one request when a chat opens; new messages as they arrive; never block showing the original.

## Deploy notes (owner's session)
- Managed policy on the Auth API role: `translate:TranslateText` and `comprehend:DetectDominantLanguage` (Amazon Translate's auto-detect uses it); new route; new cache table or item type.

## Tests
- Server: membership check, cache hit, delete-everywhere purge, fail-closed, limits.
- Browser: toggle on → Italian message shows English with "Show original"; own messages untouched; 360/390px screenshots; it/fr/es/de/pt strings.
