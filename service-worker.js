"use strict";

const CACHE = "danzstak-shell-v213";
const SHELL = [
  "/assets/languages.js", "/assets/i18n.js",
  "/", "/index.html", "/feed.html", "/messages.html", "/profile.html", "/privacy.html", "/terms.html",
  "/manifest.webmanifest", "/assets/app-icon.svg", "/assets/favicon-32.png", "/assets/favicon-192.png", "/assets/favicon-512.png", "/assets/apple-touch-icon.png", "/assets/danzstak-logo.png", "/assets/danzstak-share-fb-v2.jpg",
  "/assets/media-visibility.js", "/assets/text-emojis.js", "/assets/story-book.svg", "/assets/device-settings.js", "/assets/home.js", "/assets/pwa.js", "/assets/logout.js", "/assets/session-cleanup.js", "/assets/session-activity.js", "/assets/profile.js", "/assets/profile-editor.js",
  "/assets/profile-editor.css", "/assets/display-preferences.js", "/assets/feed-enhancements.js", "/assets/push-notifications.js", "/assets/direct-messages.js", "/assets/incoming-calls.js", "/assets/incoming-calls.css",
  "/assets/feed-enhancements.css", "/assets/chat.js", "/assets/chat.css", "/assets/legal.css", "/assets/soft-ui.css",
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

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data?.json() || {}; }
  catch { payload = { body: event.data?.text() || "You have a new DanzStak notification." }; }
  const title = String(payload.title || "DanzStak").slice(0, 80);
  const body = String(payload.body || "You have a new notification.").slice(0, 240);
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
    actions: call ? [{ action: "answer", title: "Answer" }, { action: "dismiss", title: "Dismiss" }] : [],
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
