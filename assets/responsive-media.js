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
    const shell = video.closest(".danzstak-media-shell");
    if (shell) {
      shell.dataset.videoLayout = layout;
      shell.style.setProperty("--ds-media-aspect", `${width}/${height}`);
    }
  }

  function classifyFrame(frame) {
    if (frame.dataset.videoLayout) return;
    let url;
    try { url = new URL(frame.src); } catch { return; }
    const host = url.hostname.replace(/^www\./, "");
    const portrait = host === "www.tiktok.com" || host === "tiktok.com" || host.endsWith("instagram.com");
    frame.dataset.videoLayout = portrait ? "portrait" : "landscape";
    frame.style.setProperty("--ds-media-aspect", portrait ? "9/16" : "16/9");
  }

  function enhance(node) {
    if (!(node instanceof HTMLVideoElement || node instanceof HTMLIFrameElement)) return;
    if (!node.matches(mediaSelector)) return;
    node.classList.add("ds-responsive-media");
    if (node instanceof HTMLVideoElement) {
      node.playsInline = true;
      if (node.videoWidth && node.videoHeight) classify(node);
      else node.addEventListener("loadedmetadata", () => classify(node), { once: true });
    } else classifyFrame(node);
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
