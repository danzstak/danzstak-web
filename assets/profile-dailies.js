"use strict";
// Fix-it 18, Profile page (owner 2026-11-17): the member's Dailies (24-hour photos and videos) sit in one edge-to-edge
// strip directly above the posts, with no box, no side margins and no gap. Tap a tile to watch full screen; tap the right
// or left half for next or previous; Back or × closes. Audience rules are the server's: GET /stories only returns
// Dailies this viewer may see, and the strip keeps only the ones by the profile's member. Hidden when there are none.
(() => {
  const api = "https://api.danzstak.com";
  const t = value => window.danzstakTranslate?.(value) || value;
  const fmt = (value, values) => t(value).replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
  let version = 0;

  async function fetchStories() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(api + "/stories", { credentials: "include", cache: "no-store", signal: controller.signal });
      if (!response.ok) return [];
      const data = await response.json().catch(() => ({}));
      return Array.isArray(data.stories) ? data.stories : [];
    } catch { return []; }
    finally { clearTimeout(timer); }
  }

  function when(value) {
    const date = new Date(value);
    return Number.isFinite(date.valueOf()) ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  }

  function tile(story, index, all) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "profile-daily";
    button.setAttribute("aria-label", fmt("Open Daily from {time}", { time: when(story.createdAt) }));
    const media = document.createElement(story.mediaType === "video" ? "video" : "img");
    media.className = "profile-daily-media";
    if (story.mediaType === "video") { media.muted = true; media.playsInline = true; media.preload = "metadata"; media.setAttribute("aria-hidden", "true"); media.src = story.mediaUrl + "#t=0.1"; }
    else { media.alt = ""; media.loading = "lazy"; media.decoding = "async"; media.src = story.mediaUrl; }
    button.appendChild(media);
    if (story.mediaType === "video") { const mark = document.createElement("span"); mark.className = "profile-daily-play"; mark.setAttribute("aria-hidden", "true"); button.appendChild(mark); }
    button.addEventListener("click", () => openViewer(all, index, button));
    return button;
  }

  // Full-screen viewer: one Daily at a time, muted by default with a real mute toggle bottom-right.
  let viewer = null, viewerReturn = null, viewerStories = [], viewerIndex = 0, viewerMuted = true, viewerHistory = false;
  function ensureViewer() {
    if (viewer) return viewer;
    viewer = document.createElement("dialog");
    viewer.className = "profile-daily-viewer";
    viewer.setAttribute("aria-label", t("Dailies"));
    viewer.innerHTML = '<div class="profile-daily-stage"></div><button type="button" class="profile-daily-close" data-icon="close"></button><button type="button" class="profile-daily-prev"><svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="m15 18-6-6 6-6"/></svg></button><button type="button" class="profile-daily-next"><svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="m9 18 6-6-6-6"/></svg></button><button type="button" class="profile-daily-mute"></button>';
    const close = viewer.querySelector(".profile-daily-close"), prev = viewer.querySelector(".profile-daily-prev"), next = viewer.querySelector(".profile-daily-next");
    close.setAttribute("aria-label", t("Close")); prev.setAttribute("aria-label", t("Previous")); next.setAttribute("aria-label", t("Next"));
    close.addEventListener("click", () => closeViewer());
    prev.addEventListener("click", () => show(viewerIndex - 1));
    next.addEventListener("click", () => show(viewerIndex + 1));
    viewer.querySelector(".profile-daily-mute").addEventListener("click", () => { viewerMuted = !viewerMuted; const video = viewer.querySelector("video"); if (video) video.muted = viewerMuted; paintMute(); });
    viewer.addEventListener("cancel", event => { event.preventDefault(); closeViewer(); });
    viewer.addEventListener("close", () => { viewer.querySelector(".profile-daily-stage").replaceChildren(); viewerReturn?.focus?.(); });
    viewer.addEventListener("keydown", event => { if (event.key === "ArrowRight") show(viewerIndex + 1); if (event.key === "ArrowLeft") show(viewerIndex - 1); });
    window.addEventListener("popstate", () => { if (viewer?.open) { viewerHistory = false; viewer.close(); } });
    document.body.appendChild(viewer);
    window.danzstakIcons?.enhance?.(viewer);
    return viewer;
  }
  function paintMute() {
    const button = viewer.querySelector(".profile-daily-mute");
    const hasVideo = Boolean(viewer.querySelector("video"));
    button.hidden = !hasVideo;
    button.setAttribute("aria-label", t(viewerMuted ? "Unmute" : "Mute"));
    button.setAttribute("aria-pressed", String(!viewerMuted));
    button.innerHTML = viewerMuted
      ? '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3Zm13.6 3 2.7-2.7-1.4-1.4-2.7 2.7-2.7-2.7-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4-2.7-2.7Z"/></svg>'
      : '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3Zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4ZM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6Z"/></svg>';
  }
  function show(index) {
    if (index < 0 || index >= viewerStories.length) { if (index >= viewerStories.length) closeViewer(); return; }
    viewerIndex = index;
    const story = viewerStories[index], stage = viewer.querySelector(".profile-daily-stage");
    const media = document.createElement(story.mediaType === "video" ? "video" : "img");
    media.className = "profile-daily-full";
    const name = story.label || fmt("Daily from {time}", { time: when(story.createdAt) });
    if (story.mediaType === "video") { media.muted = viewerMuted; media.playsInline = true; media.autoplay = true; media.loop = true; media.src = story.mediaUrl; media.setAttribute("aria-label", name); }
    else { media.src = story.mediaUrl; media.alt = name; }
    stage.replaceChildren(media);
    viewer.querySelector(".profile-daily-prev").hidden = index === 0;
    viewer.querySelector(".profile-daily-next").hidden = index === viewerStories.length - 1;
    paintMute();
    if (media.tagName === "VIDEO") media.play?.().catch(() => {});
  }
  function openViewer(stories, index, from) {
    ensureViewer();
    viewerStories = stories; viewerReturn = from; viewerMuted = true;
    if (!viewer.open) { viewer.showModal(); try { history.pushState({ profileDaily: true }, ""); viewerHistory = true; } catch { viewerHistory = false; } }
    show(index);
    viewer.querySelector(".profile-daily-close").focus();
  }
  function closeViewer() {
    if (!viewer?.open) return;
    if (viewerHistory) { viewerHistory = false; history.back(); } else viewer.close();
  }

  // Appends the strip to `container` now (so it sits before the posts) and fills it when Dailies arrive.
  function mount(container, memberId) {
    const mine = ++version;
    const strip = document.createElement("section");
    strip.className = "profile-dailies";
    strip.hidden = true;
    strip.setAttribute("aria-label", t("Dailies"));
    container.appendChild(strip);
    if (!/^[a-f0-9-]{36}$/i.test(String(memberId || ""))) { strip.remove(); return strip; }
    fetchStories().then(stories => {
      if (mine !== version || !strip.isConnected) return;
      const own = stories.filter(story => story.memberId === memberId && story.mediaUrl && ["image", "video"].includes(story.mediaType))
        .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      if (!own.length) { strip.remove(); return; }
      const row = document.createElement("div");
      row.className = "profile-dailies-row";
      own.forEach((story, index) => row.appendChild(tile(story, index, own)));
      strip.replaceChildren(row);
      strip.hidden = false;
    });
    return strip;
  }

  // Also used by profile posts: tap a photo or video to see it whole, full screen (fix-it 18, owner 2026-11-17).
  const openMedia = (items, index, from) => { window.danzstakMediaCoordinator?.pauseAll?.(); openViewer(items, index, from); };
  window.danzstakProfileDailies = { mount, openMedia };
})();
