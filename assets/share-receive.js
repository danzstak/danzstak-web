"use strict";
// Task 32 (owner 2026-11-18): Mix side of "Share to DanzStak". The service worker keeps the shared photos (up to 20)
// or video for up to 10 minutes; here the composer opens with it attached and any shared text in the box. Nothing posts on its own:
// the member picks the audience and taps Post. Signed out: the share waits (on this phone only) until they sign in and
// Mix opens again. The shared file is removed from the phone's cache as soon as it is in the composer.
(() => {
  const CACHE = "danzstak-share", PENDING = "danzstak_pending_share", TTL_MS = 10 * 60 * 1000;
  const t = value => window.danzstakTranslate?.(value) || value;
  const say = (message, urgent = false) => window.danzstakShowFeedback?.(t(message), { urgent });
  const params = new URLSearchParams(location.search);
  const fromUrl = params.get("share");
  const validId = id => /^[a-z0-9]{6,24}$/.test(id || "");
  const pending = {
    get() { try { const saved = JSON.parse(sessionStorage.getItem(PENDING) || "null"); return saved && validId(saved.id) && Date.now() - saved.at <= TTL_MS ? saved.id : ""; } catch { return ""; } },
    set(id) { try { sessionStorage.setItem(PENDING, JSON.stringify({ id, at: Date.now() })); } catch { /* the share still works on this page */ } },
    clear() { try { sessionStorage.removeItem(PENDING); } catch { /* optional */ } }
  };
  const clearUrl = () => { if (!fromUrl) return; const url = new URL(location.href); url.searchParams.delete("share"); history.replaceState(history.state, "", url.pathname + url.search + url.hash); };
  function waitFor(selector, ms = 8000) {
    return new Promise(resolve => {
      const found = document.querySelector(selector); if (found) return resolve(found);
      const stop = setTimeout(() => { observer.disconnect(); resolve(null); }, ms);
      const observer = new MutationObserver(() => { const el = document.querySelector(selector); if (el) { clearTimeout(stop); observer.disconnect(); resolve(el); } });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    });
  }
  // Resolves true once check() holds, false after ms (polled: the composer state is a plain global, not a DOM change).
  function waitUntil(check, ms = 8000) {
    return new Promise(resolve => {
      const until = Date.now() + ms;
      const tick = () => { if (check()) return resolve(true); if (Date.now() > until) return resolve(false); setTimeout(tick, 50); };
      tick();
    });
  }
  async function dropExpired(cache) {
    for (const key of await cache.keys()) { const at = Number(new URL(key.url).searchParams.get("at") || 0); if (!(Date.now() - at <= TTL_MS)) await cache.delete(key); }
  }
  async function signedIn() {
    try {
      const response = await fetch("https://api.danzstak.com/auth/session", { credentials: "include", cache: "no-store" });
      if (response.status === 401) return false;
      const data = await response.json().catch(() => ({}));
      return data?.authenticated === true;
    } catch { return null; } // offline or unknown: attach it anyway
  }

  async function take() {
    if (fromUrl === "failed") { clearUrl(); say("That share didn't come through. Try sharing again.", true); return; }
    if (!("caches" in window)) { clearUrl(); return; }
    const cache = await caches.open(CACHE);
    await dropExpired(cache);
    const id = validId(fromUrl) ? fromUrl : pending.get();
    clearUrl();
    if (!id) { pending.clear(); return; }
    pending.set(id);
    const keys = (await cache.keys()).filter(request => new URL(request.url).pathname.startsWith(`/share-target/${id}/`));
    if (!keys.length) { pending.clear(); if (fromUrl) say("That share has expired. Share it again.", true); return; }
    const session = await signedIn();
    if (session === false) { say("Sign in to post what you shared. It waits on this phone for 10 minutes.", true); return; } // Mix sends signed-out members to sign in
    const metaKey = keys.find(request => new URL(request.url).pathname.endsWith("/meta"));
    const fileKeys = keys.filter(request => /\/file\/\d+$/.test(new URL(request.url).pathname))
      .sort((a, b) => Number(new URL(a.url).pathname.split("/").pop()) - Number(new URL(b.url).pathname.split("/").pop()));
    const meta = metaKey ? await (await cache.match(metaKey)).json().catch(() => ({})) : {};
    const files = [];
    for (const key of fileKeys) { const response = await cache.match(key); const blob = await response.blob(); files.push(new File([blob], decodeURIComponent(response.headers.get("x-file-name") || "shared"), { type: blob.type })); }
    if (!files.length && !meta.text) {
      for (const key of keys) await cache.delete(key);
      pending.clear();
      say(meta.rejected ? "That file can't be posted on DanzStak. Share a JPEG, PNG, WebP or GIF photo, or an MP4, WebM or MOV video." : "That share has expired. Share it again.", true);
      return;
    }
    if (files.length) {
      // The composer's own picker takes them (photos: up to 20 in one post, post-photos.js; or one video), so its checks,
      // photo scaling (media-scale.js) and album choice all apply as if the member had picked them there.
      const kind = files[0].type.startsWith("video/") ? "video" : "image";
      const button = await waitFor(`.composer-media-${kind}`);
      const input = button?.nextElementSibling?.matches?.('input[type="file"]') ? button.nextElementSibling : null;
      if (!input) { say("Open the post box and add your photo again.", true); return; }
      const transfer = new DataTransfer(); for (const file of files) transfer.items.add(file); input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      // media-scale.js holds a photo's change event while it shrinks it to 720p, then hands the composer new, smaller
      // files with the same names: wait for the composer, and match by name rather than by the original file object.
      const first = files[0].name;
      if (!(await waitUntil(() => window.danzstakSelectedMedia?.file?.name === first))) { say("Open the post box and add your photo again.", true); return; }
    }
    const box = await waitFor("#postText");
    if (box && meta.text && !box.value) { box.value = meta.text; box.dispatchEvent(new Event("input", { bubbles: true })); }
    box?.focus?.({ preventScroll: true }); // opens the post box
    box?.scrollIntoView?.({ block: "center" });
    for (const key of keys) await cache.delete(key); // it is in the composer now: nothing stays on the phone
    pending.clear();
    if (meta.left > 0) say("A post holds up to 20 photos or one video, so some of what you shared was left out.");
    else if (meta.rejected > 0) say("Some of what you shared can't be posted on DanzStak, so it was left out.");
  }
  const start = () => take().catch(() => say("That share didn't come through. Try sharing again.", true));
  if (!fromUrl && !pending.get()) return;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
})();
