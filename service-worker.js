"use strict";

const CACHE = "danzstak-shell-v969";
const SHELL = [
  "/assets/offline.js", "/assets/identity-media.js", "/assets/user-content-links.js", "/assets/user-content-links.css", "/assets/invite-sharing.js", "/assets/invite-sharing.css",
  "/assets/fonts/archivo.woff2", "/assets/fonts/jetbrains-mono.woff2", "/assets/fonts/anton.woff2", "/assets/fonts/special-elite.woff2", "/assets/fonts/work-sans.woff2", "/assets/fonts/pirata-one.woff2", "/assets/fonts/oswald.woff2", "/assets/fonts/source-serif-4.woff2", "/assets/fonts/syne.woff2", "/assets/fonts/dm-sans.woff2",
  "/assets/icon-buttons.js", "/assets/icon-buttons.css", "/assets/mobile-design-system.css", "/assets/profile-app-header.css", "/assets/danzstak-original-feed.css", "/assets/responsive-media.js", "/assets/responsive-media.css",
  "/assets/media-tags.js",
  "/assets/post-sharing.js", "/assets/post-views.js",
  "/assets/profile-sharing.js",
  "/assets/facebook-import.js", "/assets/facebook-import.css", "/assets/facebook-import-worker.js", "/assets/facebook-import-core.js", "/assets/pivot.js", "/assets/pivot.css", "/assets/vendor/fflate-0.8.3.js",
  "/assets/people-search.js", "/assets/top-search.js", "/assets/top-search.css", "/assets/buttons.css", "/assets/i18n-people.js", "/assets/app-bar.js", "/assets/app-bar.css", "/assets/site-chrome.js", "/assets/site-chrome.css",
  "/assets/mobile-keyboard.js",
  "/assets/languages.js", "/assets/brand-language-aliases.js", "/assets/i18n-music.js", "/assets/i18n.js",
  "/", "/index.html", "/feed.html", "/messages.html", "/profile.html", "/privacy.html", "/terms.html", "/support.html", "/booking.html", "/booking-selections.html", "/booking-opt-out.html", "/booking-reply.html", "/answer.html", "/record-stores.html", "/epk.html", "/store.html", "/bazaar.html", "/moving-day.html", "/product.html", "/event.html",
  "/manifest.webmanifest", "/assets/danzstak-d-icon.png", "/assets/danzstak-score-pattern.svg", "/assets/favicon-32.png", "/assets/favicon-192.png", "/assets/favicon-512.png", "/assets/apple-touch-icon.png", "/assets/danzstak-logo.png", "/assets/danzstak-share-apps-v3.png",
  "/assets/media-visibility.js", "/assets/text-emojis.js", "/assets/story-book.svg", "/assets/device-settings.js", "/assets/home.js", "/assets/app-feedback.js", "/assets/app-feedback.css", "/assets/pwa.js", "/assets/app-downloads.js", "/assets/logout.js", "/assets/session-cleanup.js", "/assets/session-activity.js", "/assets/profile.js", "/assets/profile-editor.js", "/assets/profile-dailies.js", "/assets/profile-nav.js",
  "/assets/profile-collections.js", "/assets/activity-history-core.js", "/assets/account-export-core.js", "/assets/account-export.js",
  "/assets/booking-workspace.css", "/assets/store.css", "/assets/store.js", "/assets/friendly-error.js", "/assets/bazaar.css", "/assets/bazaar.js", "/assets/product.js", "/assets/event.css", "/assets/event.js",
  "/assets/link-preview-cards.css", "/assets/roll-reels.css", "/assets/tribes-polish.css", "/assets/tribes-home.css", "/assets/tribes-art.js", "/assets/tribe-create.js", "/assets/tribe-create.css", "/assets/profile-friend.js", "/assets/link-preview-cards.js", "/assets/support.css", "/assets/support.js", "/assets/booking-agent.css", "/assets/booking-agent-driver.css", "/assets/booking-discovery.css", "/assets/booking-agent.js", "/assets/booking-legs.js", "/assets/booking-identity.js", "/assets/booking-conversation.js", "/assets/booking-discovery.js", "/assets/booking-map.js", "/assets/booking-selections.css", "/assets/booking-selections.js", "/assets/booking-pipeline.js", "/assets/booking-freshness.js", "/assets/booking-billing.js", "/assets/purchase-terms.js", "/assets/media-fit.js", "/assets/media-fit.css", "/assets/mix-polish.css", "/assets/profile-polish.css", "/assets/profile-shop.css", "/assets/signup-onboarding.js", "/assets/signup-onboarding.css", "/assets/purchase-terms.css", "/assets/booking-opt-out.css", "/assets/booking-opt-out.js", "/assets/booking-reply.css", "/assets/booking-reply.js", "/assets/booking-sync.js", "/assets/record-stores.css", "/assets/record-placement.css", "/assets/record-stores-pagination.css", "/assets/record-stores.js", "/assets/epk.css", "/assets/epk-looks.css", "/assets/epk-production.css", "/assets/epk-reviews.css", "/assets/epk-media.css", "/assets/epk-production.js", "/assets/epk-reviews.js", "/assets/epk.js", "/assets/epk-skin.css", "/assets/epk-laminate.js", "/assets/profile-editor.css", "/assets/profile-interactions.css", "/assets/profile-interactions.js", "/assets/profile-onboarding.css", "/assets/profile-onboarding.js", "/assets/display-preferences.js", "/assets/feed-enhancements.js", "/assets/push-notifications.js", "/assets/call-devices.js", "/assets/call-setup.js", "/assets/call-setup.css", "/assets/phone-setup.js", "/assets/sync-tones.js", "/assets/sync-privacy.js", "/assets/sync-reply.js", "/assets/sync-make-it-yours.js", "/sync.html", "/sync.webmanifest", "/assets/sync-standalone.js", "/assets/sync-standalone.css", "/assets/sync-icon-192.png", "/assets/sync-icon-512.png", "/assets/sync-apple-touch-icon.png", "/assets/sync-make-it-yours.css", "/assets/sync-reply.css", "/assets/sync-tones.css", "/assets/sync-settings.js", "/assets/call-ringer.js", "/assets/call-ringer.css", "/assets/call-note.js", "/assets/call-note.css", "/assets/sync-wallpaper.js", "/assets/sync-wallpaper.css", "/assets/phone-verification.js", "/assets/i18n-sync.js", "/assets/phone-verification.css", "/assets/sync-network-number.js", "/assets/sync-network-number.css", "/assets/direct-messages.js", "/assets/make-plans.js", "/assets/make-plans.css", "/assets/incoming-calls.js", "/assets/incoming-calls.css", "/assets/call-screen.js", "/assets/call-screen.css", "/assets/sync-list-polish.js", "/assets/sync-list-polish.css", "/assets/call-invite.js", "/assets/call-invite.css", "/assets/answer.js", "/assets/answer.css",
  "/assets/feed-enhancements.css", "/assets/artist-hq.js", "/assets/artist-hq.css", "/assets/chat.js", "/assets/chat.css", "/assets/sync.css", "/assets/legal.css", "/assets/soft-ui.css", "/assets/accessibility.css",
  "/assets/sync-shell.css", "/assets/sync-shell.js", 
  "/assets/notification-badge.png"
];

self.addEventListener("install", event => {
  // Cache.addAll() rejects the whole install when a URL is listed twice, which left new phones without a working
  // service worker (no offline shell, no push, so "Call alerts" never finished). De-duplicate before caching.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([...new Set(SHELL)])));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
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

let lastShellRefresh = 0;
async function refreshAppShell() {
  if (Date.now() - lastShellRefresh < 60 * 60 * 1000) return;
  lastShellRefresh = Date.now();
  const cache = await caches.open(CACHE);
  await Promise.allSettled(SHELL.map(async path => {
    const response = await fetch(path, { cache: "no-store" });
    if (response.ok) await cache.put(path, response.clone());
  }));
}

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "REFRESH_SHELL" && event.data?.allow !== false) event.waitUntil(refreshAppShell());
});

self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data?.json() || {}; }
  catch { payload = {}; }
  if (payload.type === "call-resolved") {
    const callId = String(payload.callId || "");
    if (!/^[a-f0-9-]{36}$/.test(callId)) return;
    event.waitUntil(Promise.all([
      self.registration.getNotifications({ tag: `call-${callId}` })
        .then(notifications => notifications.forEach(notification => notification.close())),
      self.clients.matchAll({ type: "window", includeUncontrolled: true })
        .then(clients => clients.forEach(client => client.postMessage({ type: "DANZSTAK_CALL_RESOLVED", callId })))
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
  const call = payload.type === "call";
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "/assets/favicon-192.png",
    badge: "/assets/notification-badge.png",
    tag: String(payload.tag || "danzstak-alert").slice(0, 80),
    renotify: true,
    silent: payload.silent === true, // 16-H quiet hours: delivered without sound or vibration
    vibrate: payload.silent === true ? [] : call ? [400, 180, 400, 180, 400] : [120],
    requireInteraction: call,
    // 16-F: the lock-screen ring has Accept and Decline. Decline refuses the call without opening the app.
    actions: call ? [{ action: "answer", title: String(payload.answerTitle || "Accept").slice(0, 40) }, { action: "decline", title: String(payload.declineTitle || payload.dismissTitle || "Decline").slice(0, 40) }] : [],
    data: { url, type: call ? "call" : payload.type === "booking" ? "booking" : "notification", callId: call && String(payload.tag || "").startsWith("call-") ? String(payload.tag).slice(5) : "" }
  }));
});

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

self.addEventListener("notificationclick", event => {
  event.notification.close();
  if (event.action === "dismiss") return;
  if (event.action === "decline") { if (event.notification.data?.type === "call") event.waitUntil(declineCallFromNotification(String(event.notification.data.callId || ""))); return; }
  const destinationUrl = new URL(event.notification.data?.url || "/feed.html", self.location.origin);
  if (event.action === "answer" && event.notification.data?.type === "call") destinationUrl.searchParams.set("answer", "1");
  if (event.action === "answer" && event.notification.data?.type === "call" && event.notification.data?.callId) destinationUrl.searchParams.set("callId", event.notification.data.callId);
  const destination = destinationUrl.href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async clients => {
    for (const client of clients) {
      if (new URL(client.url).origin !== self.location.origin || client.frameType === "nested") continue;
      try {
        // Focus while the notification tap still supplies user activation.
        await client.focus();
        const navigated = await client.navigate(destination);
        if (navigated) return navigated;
      } catch { /* A closed or unavailable window must not swallow the tap. */ }
    }
    const opened = await self.clients.openWindow(destination);
    if (opened) return opened.focus().catch(() => opened);
    return opened;
  }));
});
