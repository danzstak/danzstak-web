"use strict";

(() => {
  const mediaSelector = [
    "video.post-media", "video.reel-player", "iframe.reel-player",
    "video.message-attachment", ".message-media-preview video",
    ".epk-video-frame iframe", ".video-embed iframe",
    "video.profile-post-media", "video.story-viewer-media"
  ].join(",");

  function classify(video) {
    const width = Number(video.videoWidth || 0);
    const height = Number(video.videoHeight || 0);
    if (!width || !height) return;
    const ratio = width / height;
    const layout = ratio < .82 ? "portrait" : ratio > 1.18 ? "landscape" : "square";
    video.dataset.videoLayout = layout;
    video.style.setProperty("--ds-media-aspect", `${width}/${height}`);
  }

  function enhance(node) {
    if (!(node instanceof HTMLVideoElement || node instanceof HTMLIFrameElement)) return;
    if (!node.matches(mediaSelector)) return;
    node.classList.add("ds-responsive-media");
    if (node instanceof HTMLVideoElement) {
      node.playsInline = true;
      if (node.videoWidth && node.videoHeight) classify(node);
      else node.addEventListener("loadedmetadata", () => classify(node), { once: true });
    }
  }

  function scan(root = document) {
    if (root instanceof Element) enhance(root);
    root.querySelectorAll?.(mediaSelector).forEach(enhance);
  }

  const start = () => {
    scan();
    new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) scan(node);
    }))).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
