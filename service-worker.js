"use strict";

const CACHE = "danzstak-shell-v1066";
const SHELL = [
  "/assets/offline.js", "/assets/identity-media.js", "/assets/time-label.js", "/assets/page-missing.js", "/assets/scramble-by-seller.js", "/assets/user-content-links.js", "/assets/user-content-links.css", "/assets/invite-sharing.js", "/assets/invite-sharing.css",
  "/assets/fonts/archivo.woff2", "/assets/fonts/jetbrains-mono.woff2", "/assets/fonts/anton.woff2", "/assets/fonts/special-elite.woff2", "/assets/fonts/work-sans.woff2", "/assets/fonts/pirata-one.woff2", "/assets/fonts/oswald.woff2", "/assets/fonts/source-serif-4.woff2", "/assets/fonts/syne.woff2", "/assets/fonts/dm-sans.woff2",
  "/assets/icon-buttons.js", "/assets/icon-buttons.css", "/assets/mobile-design-system.css", "/assets/profile-app-header.css", "/assets/danzstak-original-feed.css", "/assets/responsive-media.js", "/assets/responsive-media.css",
  "/assets/media-tags.js",
  "/assets/post-sharing.js", "/assets/post-views.js",
  "/assets/profile-sharing.js",
  "/assets/facebook-import.js", "/assets/facebook-import.css", "/assets/facebook-import-worker.js", "/assets/facebook-import-core.js", "/assets/pivot.js", "/assets/pivot.css", "/assets/vendor/fflate-0.8.3.js",
  "/assets/people-search.js", "/assets/top-search.js", "/assets/top-search.css", "/assets/buttons.css", "/assets/i18n-people.js", "/assets/app-bar.js", "/assets/app-tabs.js", "/assets/app-bar.css", "/assets/app-tabs.css", "/assets/site-chrome.js", "/assets/site-chrome.css",
  "/assets/mobile-keyboard.js",
  "/assets/languages.js", "/assets/brand-language-aliases.js", "/assets/i18n-music.js", "/assets/i18n.js",
  "/", "/index.html", "/feed.html", "/messages.html", "/profile.html", "/privacy.html", "/terms.html", "/support.html", "/booking.html", "/booking-selections.html", "/booking-opt-out.html", "/booking-reply.html", "/answer.html", "/record-stores.html", "/epk.html", "/store.html", "/bazaar.html", "/moving-day.html", "/product.html", "/event.html",
  "/manifest.webmanifest", "/assets/danzstak-d-icon.png", "/assets/danzstak-score-pattern.svg", "/assets/favicon-32.png", "/assets/favicon-192.png", "/assets/favicon-512.png", "/assets/apple-touch-icon.png", "/assets/danzstak-logo.png", "/assets/danzstak-share-apps-v3.png",
  "/assets/media-visibility.js", "/assets/text-emojis.js", "/assets/story-book.svg", "/assets/device-settings.js", "/assets/home.js", "/assets/app-feedback.js", "/assets/app-feedback.css", "/assets/pwa.js", "/assets/app-downloads.js", "/assets/logout.js", "/assets/session-cleanup.js", "/assets/session-activity.js", "/assets/session-guard.js", "/assets/profile.js", "/assets/profile-editor.js", "/assets/profile-dailies.js", "/assets/profile-nav.js",
  "/assets/share-card-tools.js", "/assets/epk-share-card.js", "/assets/profile-share-card.js", "/assets/signed-out.js", "/assets/profile-collections.js", "/friends.html", "/assets/friends-screen.js", "/assets/friends-screen.css", "/assets/activity-history-core.js", "/assets/account-export-core.js", "/assets/account-export.js",
  "/assets/profile-albums.js", "/assets/profile-albums.css",
  "/assets/call-alerts.js", "/assets/epk-verify.js", "/assets/epk-verify.css", "/assets/booking-workspace.css", "/assets/store.css", "/assets/store.js", "/shop-example.html", "/assets/shop-example.js", "/assets/shop-example.css", "/assets/friendly-error.js", "/assets/bazaar.css", "/assets/bazaar.js", "/assets/product.js", "/assets/event.css", "/assets/event.js",
  "/assets/link-preview-cards.css", "/assets/roll-reels.css", "/assets/tribes-polish.css", "/assets/tribes-home.css", "/assets/tribes-art.js", "/assets/tribe-create.js", "/assets/tribe-create.css", "/assets/share-receive.js", "/assets/profile-friend.js", "/assets/link-preview-cards.js", "/assets/support.css", "/assets/support.js", "/assets/booking-agent.css", "/assets/booking-agent-driver.css", "/assets/booking-discovery.css", "/assets/booking-agent.js", "/assets/booking-legs.js", "/assets/booking-identity.js", "/assets/booking-conversation.js", "/assets/booking-discovery.js", "/assets/booking-map.js", "/assets/booking-selections.css", "/assets/booking-selections.js", "/assets/booking-pipeline.js", "/assets/booking-freshness.js", "/assets/booking-billing.js", "/assets/purchase-terms.js", "/assets/fees.js", "/assets/media-fit.js", "/assets/media-scale.js", "/assets/media-fit.css", "/assets/media-viewer.js", "/assets/media-viewer.css", "/assets/image-position.js", "/assets/image-position.css", "/assets/media-actions.js", "/assets/media-actions.css", "/assets/post-photos.js", "/assets/post-photos.css", "/assets/mix-polish.css", "/assets/profile-polish.css", "/assets/profile-shop.css", "/assets/signup-onboarding.js", "/assets/signup-onboarding.css", "/assets/purchase-terms.css", "/assets/booking-opt-out.css", "/assets/booking-opt-out.js", "/assets/booking-reply.css", "/assets/booking-reply.js", "/assets/booking-sync.js", "/assets/record-stores.css", "/assets/record-placement.css", "/assets/record-stores-pagination.css", "/assets/record-stores.js", "/assets/epk.css", "/assets/epk-looks.css", "/assets/epk-hometown.css", "/assets/hometown-looks.js", "/assets/tour-hometown.css", "/assets/tour-hometown.js", "/assets/epk-production.css", "/assets/epk-reviews.css", "/assets/epk-media.css", "/assets/epk-production.js", "/assets/epk-reviews.js", "/assets/epk.js", "/assets/epk-video-check.js", "/assets/epk-versions.js", "/assets/epk-ai.js", "/assets/epk-ai.css", "/assets/profile-ai.js", "/assets/shop-ai.js", "/assets/epk-skin.css", "/assets/epk-laminate.js", "/assets/profile-editor.css", "/assets/profile-interactions.css", "/assets/profile-interactions.js", "/assets/profile-onboarding.css", "/assets/profile-onboarding.js", "/assets/display-preferences.js", "/assets/feed-enhancements.js", "/assets/device-reminder.js", "/assets/ds-tokens.css", "/assets/ds.css", "/assets/icons.svg", "/assets/ds-icon.js", "/assets/ds-sheet.js", "/assets/notifications.js", "/assets/push-notifications.js", "/assets/call-devices.js", "/assets/call-setup.js", "/assets/call-setup.css", "/assets/phone-setup.js", "/assets/sync-tones.js", "/assets/sync-privacy.js", "/assets/sync-reply.js", "/assets/sync-make-it-yours.js", "/sync.html", "/sync.webmanifest", "/assets/sync-standalone.js", "/assets/sync-standalone.css", "/assets/sync-icon-192.png", "/assets/sync-icon-512.png", "/assets/shop-icon-96.png", "/assets/shop-icon-192.png", "/assets/sync-apple-touch-icon.png", "/assets/sync-make-it-yours.css", "/assets/sync-reply.css", "/assets/sync-tones.css", "/assets/sync-settings.js", "/assets/call-ringer.js", "/assets/call-ringer.css", "/assets/call-note.js", "/assets/call-note.css", "/assets/sync-wallpaper.js", "/assets/sync-wallpaper.css", "/assets/phone-verification.js", "/assets/i18n-sync.js", "/assets/phone-verification.css", "/assets/sync-network-number.js", "/assets/sync-network-number.css", "/assets/direct-messages.js", "/assets/make-plans.js", "/assets/make-plans.css", "/assets/incoming-calls.js", "/assets/incoming-calls.css", "/assets/call-screen.js", "/assets/sync-call-ui.js", "/assets/sync-call-ui.css", "/assets/call-screen.css", "/assets/sync-list-polish.js", "/assets/sync-list-polish.css", "/assets/call-invite.js", "/assets/call-invite.css", "/assets/answer.js", "/assets/answer.css", "/sync/", "/assets/sync-app.js", "/assets/sync-app.css",
  "/assets/feed-enhancements.css", "/assets/artist-hq.js", "/assets/artist-hq.css", "/assets/chat.js", "/assets/chat.css", "/assets/sync.css", "/assets/legal.css", "/assets/soft-ui.css", "/assets/accessibility.css", "/assets/events-page.css", "/assets/events-page.js", "/assets/i18n-events.js",
  "/assets/sync-shell.css", "/assets/sync-shell.js",
  "/assets/bazaar-examples.js",
  "/assets/profile-videos.css", "/assets/profile-videos.js",
  "/assets/notification-badge.png"
];

self.addEventListener("install", event => {
  // Cache.addAll() rejects the whole install when a URL is listed twice, which left new phones without a working
  // service worker (no offline shell, no push, so "Call alerts" never finished). De-duplicate before caching.
  // A fresh install is a fresh copy: the hourly refresh (refreshAppShell) starts counting from here.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([...new Set(SHELL)]).then(() => cache.put(SHELL_REFRESHED, new Response(String(Date.now()))))));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== CACHE && key !== MEDIA_CACHE && key !== HANDLED_CALLS && key !== SHARE_CACHE).map(key => caches.delete(key))))
    .then(() => caches.open(SHARE_CACHE).then(dropExpiredShares)) // a share in progress survives an update; old ones go
    .then(() => self.clients.claim()));
});

const MEDIA_CDN_ORIGIN = "https://dk7kawr758jtd.cloudfront.net";
const MEDIA_CACHE = "danzstak-media-v1", MEDIA_MAX_ENTRIES = 400, MEDIA_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
async function cdnImage(request, url) {
  const cache = await caches.open(MEDIA_CACHE), key = url.origin + url.pathname;
  const hit = await cache.match(key);
  if (hit && Date.now() - Number(hit.headers.get("x-danzstak-cached") || 0) < MEDIA_MAX_AGE_MS) return hit;
  try {
    const response = await fetch(request);
    if (response.ok && response.type !== "opaque") {
      const headers = new Headers(response.headers); headers.set("x-danzstak-cached", String(Date.now()));
      const body = await response.clone().blob();
      await cache.put(key, new Response(body, { status: 200, headers }));
      const keys = await cache.keys();
      if (keys.length > MEDIA_MAX_ENTRIES) await Promise.all(keys.slice(0, keys.length - MEDIA_MAX_ENTRIES).map(old => cache.delete(old)));
    }
    return response;
  } catch (error) { if (hit) return hit; throw error; }
}

// Task 32 (owner 2026-11-18): DanzStak in the phone's Share menu. What the member shares is kept for up to 10 minutes in a
// private cache on this phone, then Mix opens the composer with it attached; the member chooses to post (assets/
// share-receive.js deletes it once it is in the composer). Only types Mix can post: no HEIC, never audio (CLAUDE.md: no
// music files). A post holds up to 20 photos (owner 2026-11-22, post-photos.js) or one video: photos win when both are
// shared, and whatever can't go in one post is counted so Mix can say so.
const SHARE_CACHE = "danzstak-share", SHARE_TTL_MS = 10 * 60 * 1000, SHARE_MAX_BYTES = 100 * 1024 * 1024, SHARE_MAX_PHOTOS = 20;
const SHARE_TYPES = /^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm|quicktime))$/i;
async function dropExpiredShares(cache) {
  for (const key of await cache.keys()) { const at = Number(new URL(key.url).searchParams.get("at") || 0); if (!(Date.now() - at <= SHARE_TTL_MS)) await cache.delete(key); }
}
async function receiveShare(request) {
  try {
    const form = await request.formData();
    const shared = form.getAll("media").filter(item => item && typeof item !== "string");
    const usable = shared.filter(item => SHARE_TYPES.test(item.type) && item.size <= SHARE_MAX_BYTES);
    const photos = usable.filter(item => item.type.startsWith("image/"));
    const files = photos.length ? photos.slice(0, SHARE_MAX_PHOTOS) : usable.slice(0, 1);
    const text = ["title", "text", "url"].map(key => String(form.get(key) || "").trim()).filter(Boolean).filter((v, i, all) => all.indexOf(v) === i).join(" ").slice(0, 2000);
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8), at = Date.now();
    const cache = await caches.open(SHARE_CACHE);
    await dropExpiredShares(cache);
    for (const [index, file] of files.entries()) await cache.put(`/share-target/${id}/file/${index}?at=${at}`, new Response(file, { headers: { "content-type": file.type, "x-file-name": encodeURIComponent(file.name || "shared") } }));
    await cache.put(`/share-target/${id}/meta?at=${at}`, new Response(JSON.stringify({ text, files: files.length, left: usable.length - files.length, rejected: shared.length - usable.length }), { headers: { "content-type": "application/json" } }));
    return Response.redirect(`/feed.html?share=${id}`, 303);
  } catch { return Response.redirect("/feed.html?share=failed", 303); }
}

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method === "POST" && url.origin === self.location.origin && url.pathname === "/share-target") { event.respondWith(receiveShare(request)); return; }
  // Task 38: photos from the media CDN are immutable (a new upload = a new key), so the app keeps them by path: the signed
  // query changes every few hours but the picture never does. Images only (videos stream with Range requests and rely on
  // the browser's HTTP cache); capped and aged out so the phone never fills up.
  if (request.method === "GET" && url.origin === MEDIA_CDN_ORIGIN && request.destination === "image") { event.respondWith(cdnImage(request, url)); return; }
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/auth/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone();
      if (response.ok) caches.open(CACHE).then(cache => cache.put(url.pathname, copy));
      return response;
    }).catch(() => caches.match(url.pathname).then(hit => hit || caches.match("/index.html"))));
    return;
  }
  const isCodeOrStyle = /\.(?:css|js)$/.test(url.pathname);
  if (isCodeOrStyle) {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(() => caches.match(request).then(hit => hit || caches.match(url.pathname))));
    return;
  }
  event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(response => {
    if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
    return response;
  })));
});

// Keeps the offline copy fresh between updates. Owner 2026-11-23 ("Update is hanging"): this used to re-download every
// shell file (7 MB, no-store) each time the app came back to the front, because the once-an-hour guard lived in memory and
// the browser restarts the worker after half a minute idle. While it ran, an update had to wait for it. Now:
// - at most once an hour, remembered in the cache itself;
// - "no-cache" asks the server whether each file changed, so an unchanged file costs a 304, not the file;
// - never while a newer version is installing or waiting, and it stops as soon as one turns up or the page asks
//   (STOP_SHELL_REFRESH, sent when the member updates).
const SHELL_REFRESHED = "/__danzstak-shell-refreshed";
let shellRefresh = null;
function stopShellRefresh() { shellRefresh?.abort(); shellRefresh = null; }
self.registration?.addEventListener?.("updatefound", stopShellRefresh);
async function refreshAppShell() {
  if (shellRefresh || self.registration?.installing || self.registration?.waiting) return;
  const controller = shellRefresh = new AbortController();
  try {
    const cache = await caches.open(CACHE);
    const last = Number(await (await cache.match(SHELL_REFRESHED))?.text() || 0);
    if (Date.now() - last < 60 * 60 * 1000 || controller.signal.aborted) return;
    await cache.put(SHELL_REFRESHED, new Response(String(Date.now())));
    await Promise.allSettled(SHELL.map(async path => {
      const response = await fetch(path, { cache: "no-cache", signal: controller.signal });
      if (response.ok && !controller.signal.aborted) await cache.put(path, response.clone());
    }));
  } finally { if (shellRefresh === controller) shellRefresh = null; }
}

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "STOP_SHELL_REFRESH") stopShellRefresh(); // the member is updating: don't hold the update up
  if (event.data?.type === "REFRESH_SHELL" && event.data?.allow !== false) event.waitUntil(refreshAppShell());
  if (event.data?.type === "CLEAR_MEDIA_CACHE") event.waitUntil(Promise.all([caches.delete(MEDIA_CACHE), caches.delete(SHARE_CACHE)])); // log out / account switch
  if (event.data?.type === "DANZSTAK_CALL_HANDLED") callHandled(event); // 5a00: answered or declined in an open window
});

self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data?.json() || {}; }
  catch { payload = {}; }
  if (payload.type === "call-resolved") {
    const callId = String(payload.callId || "");
    if (!/^[a-f0-9-]{36}$/.test(callId)) return;
    const reason = ["answered", "declined", "cancelled"].includes(payload.reason) ? payload.reason : "";
    event.waitUntil(Promise.all([
      markCallHandled(callId),
      self.registration.getNotifications({ tag: `call-${callId}` })
        .then(notifications => notifications.forEach(notification => notification.close())),
      self.clients.matchAll({ type: "window", includeUncontrolled: true })
        .then(clients => clients.forEach(client => client.postMessage(reason ? { type: "DANZSTAK_CALL_RESOLVED", callId, reason } : { type: "DANZSTAK_CALL_RESOLVED", callId })))
    ]));
    return;
  }
  const title = String(payload.title || "DanzStak").slice(0, 80);
  const body = String(payload.body || "").slice(0, 240);
  let url = "/feed.html";
  try {
    const candidate = new URL(String(payload.url || url), self.location.origin);
    if (candidate.origin === self.location.origin && /^\/(?:feed|messages|profile)\.html$/.test(candidate.pathname)) url = candidate.pathname + candidate.search + candidate.hash;
  } catch { /* Keep the safe feed destination. */ }
  const call = payload.type === "call", test = call && payload.test === true; // SYNC ⋮ → Test ringer rings once
  const friendRequest = payload.type === "friend_request" && /^[a-f0-9-]{36}$/.test(String(payload.memberId || ""));
  const options = {
    body,
    icon: "/assets/favicon-192.png",
    badge: "/assets/notification-badge.png",
    tag: String(payload.tag || "danzstak-alert").slice(0, 80),
    renotify: true,
    silent: payload.silent === true, // 16-H quiet hours: delivered without sound or vibration
    vibrate: payload.silent === true ? [] : call ? [400, 180, 400, 180, 400] : [120],
    requireInteraction: call,
    // 16-F: the lock-screen ring has Accept and Decline. Decline refuses the call without opening the app.
    // 5a3: a friend request has Accept and Delete right on the notification (answered without opening the app).
    actions: call ? [{ action: "answer", title: String(payload.answerTitle || "Accept").slice(0, 40) }, { action: "decline", title: String(payload.declineTitle || payload.dismissTitle || "Decline").slice(0, 40) }]
      : friendRequest ? [{ action: "friend-accept", title: String(payload.acceptTitle || "Accept").slice(0, 40) }, { action: "friend-delete", title: String(payload.deleteTitle || "Delete").slice(0, 40) }] : [],
    data: { url, type: call ? "call" : payload.type === "booking" ? "booking" : friendRequest ? "friend_request" : "notification", callId: call && !test && String(payload.tag || "").startsWith("call-") ? String(payload.tag).slice(5) : "", memberId: friendRequest ? String(payload.memberId) : "" }
  };
  event.waitUntil((async () => {
    // Answered, declined or ended on this phone before its push got here: it doesn't come back.
    if (options.data.callId && await callWasHandled(options.data.callId)) return;
    return call && !test && payload.silent !== true ? ringCallNotification(title, options) : self.registration.showNotification(title, options);
  })());
});

// Owner 2026-11-24: "notification for incoming calls stay on top even after answering". The app can see the call (its own
// inbox check) before the push service delivers the call push, so a call answered in the app could still put its
// notification up afterwards, and stay there (it waits for a tap). The calls answered, declined or ended on this phone are
// remembered for 10 minutes, in a cache the pages can write too (a page the worker doesn't control can't message it).
const HANDLED_CALLS = "danzstak-handled-calls", HANDLED_CALL_MS = 10 * 60 * 1000;
const handledCallKey = callId => `/handled-call/${callId}`;
async function markCallHandled(callId) {
  if (!/^[a-f0-9-]{36}$/.test(String(callId || ""))) return;
  try {
    const cache = await caches.open(HANDLED_CALLS);
    await cache.put(handledCallKey(callId), new Response(String(Date.now())));
    for (const request of await cache.keys()) {
      const at = Number(await (await cache.match(request))?.text());
      if (!(Date.now() - at < HANDLED_CALL_MS)) await cache.delete(request);
    }
  } catch { /* storage is optional: the close below still happens */ }
}
async function callWasHandled(callId) {
  try {
    const hit = await (await caches.open(HANDLED_CALLS)).match(handledCallKey(callId));
    return Boolean(hit) && Date.now() - Number(await hit.text()) < HANDLED_CALL_MS;
  } catch { return false; }
}

// Owner 2026-11-19 (screenshot): the call notification arrived but "still not ringing". A web push plays the phone's
// notification sound once, not a ringtone. So while the call is still waiting (the notification is still there: not
// answered, declined or ended, which close it), show it again every few seconds with renotify, so the phone sounds and
// vibrates again, for about as long as an in-app ring (25 s).
const CALL_RING_REPEATS = 6, CALL_RING_EVERY_MS = 4000;
async function ringCallNotification(title, options) {
  await self.registration.showNotification(title, options);
  for (let i = 0; i < CALL_RING_REPEATS; i++) {
    await new Promise(resolve => setTimeout(resolve, CALL_RING_EVERY_MS));
    const open = await self.registration.getNotifications({ tag: options.tag });
    if (!open.length) return; // answered, declined, dismissed or the call ended (call-resolved push)
    if (await callWasHandled(options.data.callId)) { open.forEach(notification => notification.close()); return; }
    await self.registration.showNotification(title, { ...options, renotify: true });
  }
}

// A call answered or declined in an open DanzStak window: close its notification, which also ends the re-ring above.
// (Called from the single "message" listener above.)
function callHandled(event) {
  const callId = String(event.data.callId || "");
  if (!/^[a-f0-9-]{36}$/.test(callId)) return;
  event.waitUntil?.(Promise.all([markCallHandled(callId), self.registration.getNotifications({ tag: `call-${callId}` }).then(list => list.forEach(notification => notification.close()))]));
}

// 16-F: Decline from the lock screen. The server refuses the offer (cookie session, no camera or microphone) and tells the
// caller; open SYNC windows stop ringing. If the network is down the caller's ring simply times out.
async function declineCallFromNotification(callId) {
  if (!/^[a-f0-9-]{36}$/.test(callId)) return;
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  clients.forEach(client => client.postMessage({ type: "DANZSTAK_CALL_RESOLVED", callId }));
  try {
    await fetch("https://api.danzstak.com/calls/decline", { method: "POST", credentials: "include", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ callId }) });
  } catch { /* offline: the caller's ring times out */ }
}

// 5a3: Accept or Delete a friend request from the lock screen (cookie session, same as call Decline). If it fails, the
// tap opens the notifications list so the member can answer there.
async function answerFriendRequestFromNotification(memberId, accept, url) {
  try {
    const response = await fetch("https://api.danzstak.com/friends/respond", { method: "POST", credentials: "include", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ memberId, accept }) });
    if (response.ok || response.status === 404) return;
  } catch { /* offline: fall through and open the list */ }
  await self.clients.openWindow(url || "/feed.html#notifications");
}

self.addEventListener("notificationclick", event => {
  event.notification.close();
  if ((event.action === "friend-accept" || event.action === "friend-delete") && event.notification.data?.type === "friend_request") {
    event.waitUntil(answerFriendRequestFromNotification(String(event.notification.data.memberId || ""), event.action === "friend-accept", event.notification.data.url));
    return;
  }
  // A tapped call (Accept, Decline or the call itself) doesn't ring again from here; the app takes over.
  if (event.notification.data?.type === "call" && event.notification.data?.callId) event.waitUntil(markCallHandled(event.notification.data.callId));
  if (event.action === "dismiss") return;
  if (event.action === "decline") { if (event.notification.data?.type === "call") event.waitUntil(declineCallFromNotification(String(event.notification.data.callId || ""))); return; }
  const destinationUrl = new URL(event.notification.data?.url || "/feed.html", self.location.origin);
  if (event.action === "answer" && event.notification.data?.type === "call") destinationUrl.searchParams.set("answer", "1");
  if (event.action === "answer" && event.notification.data?.type === "call" && event.notification.data?.callId) destinationUrl.searchParams.set("callId", event.notification.data.callId);
  // Task 34: SYNC lives under /sync/ (its own installable app). A SYNC notification opens /sync/, so Android opens the
  // installed SYNC app when there is one; an open SYNC window is reused first.
  if (destinationUrl.origin === self.location.origin && destinationUrl.pathname === "/messages.html") destinationUrl.pathname = "/sync/";
  const destination = destinationUrl.href;
  const syncDestination = destinationUrl.pathname.startsWith("/sync/");
  // Owner 2026-11-19: on a phone, tapping a notification "should open the danzstak app … go to sync or open the stand
  // alone sync app", but it left him on the home screen. A phone can't always bring an app window that sits in the
  // background forward from here, so the tap navigated a window nobody could see. Opening the address always launches
  // the installed app (SYNC's own app for /sync/ when it is installed), so on a phone only a window already on screen is
  // reused; computers still bring their open window forward. A step that hangs never swallows the tap either.
  const phone = /Android|iPhone|iPad|iPod/i.test(self.navigator?.userAgent || "");
  const inTime = (promise, ms = 1500) => Promise.race([promise, new Promise(resolve => setTimeout(() => resolve(null), ms))]);
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async found => {
    const ours = found.filter(client => new URL(client.url).origin === self.location.origin && client.frameType !== "nested" && (!phone || client.focused || client.visibilityState === "visible"));
    const clients = syncDestination ? ours.sort((a, b) => Number(new URL(b.url).pathname.startsWith("/sync/")) - Number(new URL(a.url).pathname.startsWith("/sync/"))) : ours;
    for (const client of clients) {
      try {
        // Focus while the notification tap still supplies user activation.
        await inTime(client.focus());
        const navigated = await inTime(client.navigate(destination));
        if (navigated) return navigated;
      } catch { /* A closed or unavailable window must not swallow the tap. */ }
    }
    const opened = await self.clients.openWindow(destination);
    if (opened) return opened.focus().catch(() => opened);
    return opened;
  }));
});
