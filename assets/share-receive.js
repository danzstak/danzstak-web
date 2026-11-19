"use strict";
// Task 32: Mix side of "Share to DanzStak". The service worker keeps the shared photo/video for a few minutes; here the
// composer opens with it attached and any shared text in the box. Nothing posts on its own: the member taps Post.
(() => {
  const params = new URLSearchParams(location.search);
  const id = params.get("share");
  if (!id) return;
  const t = value => window.danzstakTranslate?.(value) || value;
  const clearUrl = () => { const url = new URL(location.href); url.searchParams.delete("share"); history.replaceState(history.state, "", url.pathname + url.search + url.hash); };
  const say = (message, urgent = false) => window.danzstakShowFeedback?.(t(message), { urgent });
  function waitFor(selector, ms = 8000) {
    return new Promise(resolve => {
      const found = document.querySelector(selector); if (found) return resolve(found);
      const stop = setTimeout(() => { observer.disconnect(); resolve(null); }, ms);
      const observer = new MutationObserver(() => { const el = document.querySelector(selector); if (el) { clearTimeout(stop); observer.disconnect(); resolve(el); } });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    });
  }
  async function take() {
    if (id === "failed" || !/^[a-z0-9]{6,24}$/.test(id) || !("caches" in window)) { clearUrl(); if (id === "failed") say("That share didn't come through. Try sharing again.", true); return; }
    const cache = await caches.open("danzstak-share");
    const keys = (await cache.keys()).filter(request => new URL(request.url).pathname.startsWith(`/share-target/${id}/`));
    const metaKey = keys.find(request => new URL(request.url).pathname.endsWith("/meta")), fileKey = keys.find(request => new URL(request.url).pathname.endsWith("/file"));
    const meta = metaKey ? await (await cache.match(metaKey)).json().catch(() => ({})) : {};
    let file = null;
    if (fileKey) { const response = await cache.match(fileKey); const blob = await response.blob(); file = new File([blob], decodeURIComponent(response.headers.get("x-file-name") || "shared"), { type: blob.type }); }
    for (const key of keys) await cache.delete(key);
    clearUrl();
    if (!file && !meta.text) { say(meta.rejected ? "Only photos and videos can be shared to DanzStak." : "That share has expired. Share it again.", true); return; }
    const kind = file?.type.startsWith("video/") ? "video" : "image";
    if (file) {
      const button = await waitFor(`.composer-media-${kind}`);
      const input = button?.nextElementSibling?.matches?.('input[type="file"]') ? button.nextElementSibling : button?.parentElement?.querySelectorAll('input[type="file"]')[kind === "video" ? 1 : 0];
      if (!input) { say("Open the composer and add your photo again.", true); return; }
      const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const box = await waitFor("#postText");
    if (box && meta.text && !box.value) { box.value = meta.text; box.dispatchEvent(new Event("input", { bubbles: true })); }
    box?.scrollIntoView?.({ block: "center" }); box?.focus?.();
  }
  const start = () => take().catch(() => say("That share didn't come through. Try sharing again.", true));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
})();
