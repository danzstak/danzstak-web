"use strict";

const CACHE = "danzstak-shell-v6";
const SHELL = [
  "/", "/index.html", "/feed.html", "/profile.html", "/privacy.html", "/terms.html",
  "/manifest.webmanifest", "/assets/app-icon.svg", "/assets/danzstak-logo.png",
  "/assets/home.js", "/assets/pwa.js", "/assets/profile.js", "/assets/profile-editor.js",
  "/assets/profile-editor.css", "/assets/feed-enhancements.js",
  "/assets/feed-enhancements.css", "/assets/legal.css", "/assets/soft-ui.css"
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
