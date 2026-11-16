"use strict";
// Owner directive 2026-11-16: every video and image in Mix, The Roll and profiles fills the
// full width of its card, like a familiar social feed. Each item gets its own aspect ratio,
// clamped between 4:5 (tall) and 1.91:1 (wide), and fills it with object-fit: cover — never
// stretched, no black bars, no 150px empty strips before the video has loaded.
(() => {
  const VIDEO = "#feed .post video.post-media, video.profile-post-media, .reels-rail:not(.roll-fullscreen) video.reel-player";
  const IMAGE = "#feed .post > img.post-media, img.profile-post-media";
  const MIN = 0.8, MAX = 1.91;
  const clamp = ratio => Math.min(MAX, Math.max(MIN, ratio));
  const dataSaver = () => { try { return localStorage.getItem("danzstak_data_saver") === "1"; } catch { return false; } };

  function apply(media, width, height) {
    if (!width || !height) return;
    const ratio = clamp(width / height).toFixed(4);
    media.style.setProperty("--fit-ar", ratio);
    const holder = media.closest(".danzstak-media-shell, .reel-media-stage, .danzstak-reel-shell");
    if (holder) holder.style.setProperty("--fit-ar", ratio);
    media.dataset.fit = "ready";
  }
  const fitVideo = video => apply(video, video.videoWidth, video.videoHeight);
  const fitImage = img => apply(img, img.naturalWidth, img.naturalHeight);

  // Load only the size and first frame of videos that are about to scroll into view.
  const nearby = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const video = entry.target;
      if (dataSaver() || video.readyState > 0) { if (video.readyState > 0) nearby.unobserve(video); continue; }
      // Another script may reset preload to "none" right after; ask once now and once more shortly after.
      const ask = () => { if (video.readyState === 0 && !dataSaver()) { video.preload = "metadata"; try { video.load(); } catch {} } };
      ask(); setTimeout(ask, 600);
    }
  }, { rootMargin: "800px 0px" }) : null;

  function enhance(node) {
    if (node.matches?.(VIDEO) && !node.dataset.fitWatched) {
      node.dataset.fitWatched = "1";
      if (node.readyState >= 1) fitVideo(node);
      node.addEventListener("loadedmetadata", () => fitVideo(node));
      nearby?.observe(node);
    } else if (node.matches?.(IMAGE) && !node.dataset.fitWatched) {
      node.dataset.fitWatched = "1";
      if (node.complete && node.naturalWidth) fitImage(node);
      node.addEventListener("load", () => fitImage(node));
    }
  }
  function scan(root) {
    if (root instanceof Element) enhance(root);
    root.querySelectorAll?.(`${VIDEO}, ${IMAGE}`).forEach(enhance);
  }
  const start = () => {
    scan(document);
    new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => { if (node.nodeType === 1) scan(node); })))
      .observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
  window.danzstakMediaFit = { clamp, apply };
})();
