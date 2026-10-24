"use strict";

const CACHE = "danzstak-shell-v42";
const SHELL = [
  "/", "/index.html", "/feed.html", "/messages.html", "/profile.html", "/privacy.html", "/terms.html",
  "/manifest.webmanifest", "/assets/app-icon.svg", "/assets/favicon-32.png", "/assets/favicon-192.png", "/assets/favicon-512.png", "/assets/apple-touch-icon.png", "/assets/danzstak-logo.png", "/assets/danzstak-share-fb-v2.jpg",
  "/assets/home.js", "/assets/pwa.js", "/assets/logout.js", "/assets/session-activity.js", "/assets/profile.js", "/assets/profile-editor.js",
  "/assets/profile-editor.css", "/assets/feed-enhancements.js",
  "/assets/feed-enhancements.css", "/assets/chat.js", "/assets/chat.css", "/assets/legal.css", "/assets/soft-ui.css"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/auth/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy));
      return response;
    }).catch(() => caches.match(request).then(hit => hit || caches.match("/index.html"))));
    return;
  }
  const isCodeOrStyle = /\.(?:css|js)$/.test(url.pathname);
  if (isCodeOrStyle) {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(() => caches.match(request)));
    return;
  }
  event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(response => {
    if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
    return response;
  })));
});
