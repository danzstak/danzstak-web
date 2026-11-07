"use strict";

const CACHE = "danzstak-shell-v698";
const SHELL = [
  "/assets/offline.js", "/assets/identity-media.js", "/assets/user-content-links.js", "/assets/user-content-links.css",
  "/assets/icon-buttons.js", "/assets/icon-buttons.css", "/assets/mobile-design-system.css", "/assets/danzstak-original-feed.css", "/assets/responsive-media.js", "/assets/responsive-media.css",
  "/assets/media-tags.js",
  "/assets/post-sharing.js", "/assets/post-views.js",
  "/assets/profile-sharing.js",
  "/assets/facebook-import.js", "/assets/facebook-import.css", "/assets/facebook-import-worker.js", "/assets/facebook-import-core.js", "/assets/vendor/fflate-0.8.3.js",
  "/assets/people-search.js",
  "/assets/mobile-keyboard.js",
  "/assets/languages.js", "/assets/brand-language-aliases.js", "/assets/i18n.js",
  "/", "/index.html", "/feed.html", "/messages.html", "/profile.html", "/privacy.html", "/terms.html", "/support.html", "/booking.html", "/booking-selections.html", "/booking-opt-out.html", "/record-stores.html", "/epk.html",
  "/manifest.webmanifest", "/assets/danzstak-d-icon.png", "/assets/favicon-32.png", "/assets/favicon-192.png", "/assets/favicon-512.png", "/assets/apple-touch-icon.png", "/assets/danzstak-logo.png", "/assets/danzstak-share-apps-v3.png",
  "/assets/media-visibility.js", "/assets/text-emojis.js", "/assets/story-book.svg", "/assets/device-settings.js", "/assets/home.js", "/assets/app-feedback.js", "/assets/app-feedback.css", "/assets/pwa.js", "/assets/app-downloads.js", "/assets/logout.js", "/assets/session-cleanup.js", "/assets/session-activity.js", "/assets/profile.js", "/assets/profile-editor.js",
  "/assets/profile-collections.js", "/assets/activity-history-core.js", "/assets/account-export-core.js", "/assets/account-export.js",
  "/assets/support.css", "/assets/support.js", "/assets/booking-agent.css", "/assets/booking-agent-driver.css", "/assets/booking-discovery.css", "/assets/booking-agent.js", "/assets/booking-identity.js", "/assets/booking-conversation.js", "/assets/booking-discovery.js", "/assets/booking-map.js", "/assets/booking-selections.css", "/assets/booking-selections.js", "/assets/booking-billing.js", "/assets/booking-opt-out.css", "/assets/booking-opt-out.js", "/assets/record-stores.css", "/assets/record-placement.css", "/assets/record-stores-pagination.css", "/assets/record-stores.js", "/assets/epk.css", "/assets/epk-media.css", "/assets/epk.js",
  "/assets/profile-editor.css", "/assets/profile-onboarding.css", "/assets/profile-onboarding.js", "/assets/display-preferences.js", "/assets/feed-enhancements.js", "/assets/push-notifications.js", "/assets/call-devices.js", "/assets/direct-messages.js", "/assets/make-plans.js", "/assets/make-plans.css", "/assets/incoming-calls.js", "/assets/incoming-calls.css",
  "/assets/feed-enhancements.css", "/assets/chat.js", "/assets/chat.css", "/assets/sync.css", "/assets/legal.css", "/assets/soft-ui.css", "/assets/accessibility.css",
  "/assets/notification-badge.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
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
    silent: false,
    vibrate: call ? [400, 180, 400, 180, 400] : [120],
    requireInteraction: call,
    actions: call ? [{ action: "answer", title: String(payload.answerTitle || "Answer").slice(0, 40) }, { action: "dismiss", title: String(payload.dismissTitle || "Dismiss").slice(0, 40) }] : [],
    data: { url, type: call ? "call" : "notification", callId: call && String(payload.tag || "").startsWith("call-") ? String(payload.tag).slice(5) : "" }
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  if (event.action === "dismiss") return;
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
