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

  // Strip tracking parameters (owner 2026-11-16): members see and share the clean link only.
  const TRACKING = /^(utm_|fbclid$|gclid$|dclid$|msclkid$|yclid$|si$|igsh$|igshid$|mibextid$|ref_src$|ref_url$|_ga$|mc_cid$|mc_eid$|share_id$|rdid$|__cft__|__tn__|feature$|pp$|app$|wtsrc$)/i;
  function cleanUrl(href) {
    try { const u = new URL(href); for (const key of [...u.searchParams.keys()]) if (TRACKING.test(key)) u.searchParams.delete(key); u.hash = u.hash && /^#?(_=_)?$/.test(u.hash) ? "" : u.hash; return u.href.replace(/\?$/, ""); } catch { return href; }
  }
  const displayUrl = href => { try { const u = new URL(href); const path = (u.pathname + u.search).replace(/\/$/, ""); return u.hostname.replace(/^www\./, "") + (path.length > 40 ? path.slice(0, 39) + "…" : path); } catch { return href; } };

  // Card = the source's preview image, with the clean link under it. No scraped text.
  function card(preview) {
    const href = cleanUrl(preview.url);
    const link = document.createElement("a");
    link.className = "link-preview-card" + (preview.video ? " is-video" : "") + (preview.image ? "" : " no-image");
    link.href = href; link.target = "_blank"; link.rel = "noopener noreferrer nofollow ugc";
    link.setAttribute("aria-label", (preview.title || preview.host) + " — opens on " + preview.host);
    if (preview.image) {
      const frame = document.createElement("span"); frame.className = "link-preview-image";
      const img = document.createElement("img"); img.src = preview.image; img.alt = ""; img.loading = "lazy"; img.decoding = "async"; img.referrerPolicy = "no-referrer";
      img.addEventListener("error", () => { frame.remove(); link.classList.add("no-image"); }, { once: true });
      frame.append(img); link.append(frame);
    }
    // Under the image: the source's own title (e.g. "NoonSesh 14 by Eroticon"), then the clean source link.
    const meta = document.createElement("span"); meta.className = "link-preview-meta";
    const cleanTitle = String(preview.title || "").trim();
    if (cleanTitle && cleanTitle.toLowerCase() !== String(preview.host || "").toLowerCase()) { const title = document.createElement("span"); title.className = "link-preview-title"; title.textContent = cleanTitle; meta.append(title); }
    // Fix-it 18 (owner 2026-11-17): never print the link under the card, just the source name.
    const url = document.createElement("span"); url.className = "link-preview-url"; url.textContent = String(preview.host || "").replace(/^www\./, "") || displayUrl(href).split("/")[0];
    meta.append(url); link.append(meta);
    return link;
  }

  // The raw link leaves the post text once the card shows it; a post that was only a link shows only the card.
  function hideRawLink(text, anchor) {
    const rest = text.textContent.replace(anchor.textContent, "").trim();
    if (!rest) { text.classList.add("link-only"); text.hidden = true; return; }
    const prev = anchor.previousSibling, next = anchor.nextSibling;
    anchor.remove();
    if (prev?.nodeType === 3) prev.nodeValue = prev.nodeValue.replace(/\s+$/, next ? " " : "");
    if (next?.nodeType === 3 && !prev) next.nodeValue = next.nodeValue.replace(/^\s+/, "");
  }

  async function enhance(text) {
    if (!text || text.dataset.linkPreview) return;
    const anchor = text.querySelector("a.user-content-link[href^='https://'], a.user-content-link[href^='http://']");
    if (!anchor) return;
    const post = text.closest(".post, .profile-post-card, article") || text.parentElement;
    if (!post || ownMedia(post) || post.querySelector(".link-preview-card")) return;
    text.dataset.linkPreview = "1";
    let href = anchor.href; if (href.startsWith("http://")) href = "https://" + href.slice(7);
    // Fix-it 18 (owner 2026-11-17): no raw URL and no jump. A fixed-size placeholder card takes the link's place at once;
    // the source's preview fills it when it arrives, or a clean link card stays if the source shares no preview.
    let host = ""; try { host = new URL(href).hostname.replace(/^www\./, ""); } catch {}
    const placeholder = card({ url: href, host, image: "", title: "​" }); // an invisible title keeps the title line reserved
    const frame = document.createElement("span"); frame.className = "link-preview-image link-preview-skeleton"; frame.setAttribute("aria-hidden", "true");
    placeholder.prepend(frame); placeholder.classList.remove("no-image"); placeholder.classList.add("is-loading");
    text.after(placeholder);
    hideRawLink(text, anchor);
    const preview = await fetchPreview(href);
    if (!placeholder.isConnected) return;
    if (!preview) { frame.remove(); placeholder.classList.remove("is-loading"); placeholder.classList.add("no-image"); return; }
    placeholder.replaceWith(card(preview));
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
  globalThis.danzstakLinkPreviewCard = card; globalThis.danzstakCleanUrl = cleanUrl;
})();
