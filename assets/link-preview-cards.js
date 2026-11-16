"use strict";
// Link previews (owner 2026-11-16): an outside link in a post shows the image and title the source publishes
// (YouTube, Mixcloud, Bandcamp, Facebook, news...). Tapping the card opens the original on that site.
(() => {
  const API = "https://api.danzstak.com/link-preview?url=";
  const TEXT = ".post-content, .profile-post-content";
  const cache = new Map();
  const fetchPreview = href => {
    if (!cache.has(href)) cache.set(href, fetch(API + encodeURIComponent(href), { credentials: "include" }).then(r => r.ok ? r.json() : null).then(d => d?.preview || null).catch(() => null));
    return cache.get(href);
  };
  const ownMedia = post => post.querySelector(".post-media, .profile-post-media, iframe, video, img.post-image");

  function card(preview) {
    const link = document.createElement("a");
    link.className = "link-preview-card" + (preview.video ? " is-video" : "");
    link.href = preview.url; link.target = "_blank"; link.rel = "noopener noreferrer nofollow ugc";
    link.setAttribute("aria-label", (preview.title || preview.host) + " — opens on " + preview.host);
    if (preview.image) {
      const frame = document.createElement("span"); frame.className = "link-preview-image";
      const img = document.createElement("img"); img.src = preview.image; img.alt = ""; img.loading = "lazy"; img.decoding = "async"; img.referrerPolicy = "no-referrer";
      img.addEventListener("error", () => frame.remove(), { once: true });
      frame.append(img); link.append(frame);
    }
    const meta = document.createElement("span"); meta.className = "link-preview-meta";
    const host = document.createElement("span"); host.className = "link-preview-host"; host.textContent = preview.site || preview.host;
    const title = document.createElement("span"); title.className = "link-preview-title"; title.textContent = preview.title || preview.host;
    meta.append(host, title);
    if (preview.description) { const d = document.createElement("span"); d.className = "link-preview-desc"; d.textContent = preview.description; meta.append(d); }
    link.append(meta);
    return link;
  }

  async function enhance(text) {
    if (!text || text.dataset.linkPreview) return;
    const anchor = text.querySelector("a.user-content-link[href^='https://'], a.user-content-link[href^='http://']");
    if (!anchor) return;
    const post = text.closest(".post, .profile-post-card, article") || text.parentElement;
    if (!post || ownMedia(post) || post.querySelector(".link-preview-card")) return;
    text.dataset.linkPreview = "1";
    let href = anchor.href; if (href.startsWith("http://")) href = "https://" + href.slice(7);
    const preview = await fetchPreview(href);
    if (!preview || !text.isConnected || post.querySelector(".link-preview-card")) return;
    text.after(card(preview));
  }

  const scan = root => {
    if (root?.nodeType !== 1) return;
    if (root.matches(TEXT)) enhance(root);
    root.querySelectorAll(TEXT).forEach(enhance);
  };
  const start = () => {
    scan(document.body);
    new MutationObserver(records => { for (const r of records) { if (r.type === "childList") r.addedNodes.forEach(scan); scan(r.target.closest?.(TEXT)); } })
      .observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  globalThis.danzstakLinkPreviewCard = card;
})();
