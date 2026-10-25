"use strict";

const CACHE = "danzstak-shell-v161";
const SHELL = [
  "/", "/index.html", "/feed.html", "/messages.html", "/profile.html", "/privacy.html", "/terms.html",
  "/manifest.webmanifest", "/assets/app-icon.svg", "/assets/favicon-32.png", "/assets/favicon-192.png", "/assets/favicon-512.png", "/assets/apple-touch-icon.png", "/assets/danzstak-logo.png", "/assets/danzstak-share-fb-v2.jpg",
  "/assets/home.js", "/assets/pwa.js", "/assets/logout.js", "/assets/session-cleanup.js", "/assets/session-activity.js", "/assets/profile.js", "/assets/profile-editor.js",
  "/assets/profile-editor.css", "/assets/display-preferences.js", "/assets/feed-enhancements.js", "/assets/push-notifications.js", "/assets/direct-messages.js", "/assets/incoming-calls.js", "/assets/incoming-calls.css",
  "/assets/feed-enhancements.css", "/assets/chat.js", "/assets/chat.css", "/assets/legal.css", "/assets/soft-ui.css"
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
    badge: "/assets/favicon-192.png",
    tag: String(payload.tag || "danzstak-alert").slice(0, 80),
    renotify: true,
    requireInteraction: call,
    actions: call ? [{ action: "answer", title: "Answer" }, { action: "dismiss", title: "Dismiss" }] : [],
    data: { url, type: call ? "call" : "notification" }
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  if (event.action === "dismiss") return;
  const destination = new URL(event.notification.data?.url || "/feed.html", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async clients => {
    for (const client of clients) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      await client.navigate(destination);
      return client.focus();
    }
    return self.clients.openWindow(destination);
  }));
});
