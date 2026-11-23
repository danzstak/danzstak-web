"use strict";
// The profile's full-screen photo/video player (fix-it 18, owner 2026-11-17): tap a post's photo or video to see it whole;
// tap the right or left half for next or previous; Back or × closes.
// Owner 2026-11-19: the Dailies strip that sat above the profile's posts is gone ("What is this make it just like the
// other posts … Remove this"): every post is already on the wall, and Dailies live in Mix. A sideways two-photo frame
// belongs only to a Before & After post the member chooses (F23, photos only).
(() => {
  const api = "https://api.danzstak.com";
  const t = value => window.danzstakTranslate?.(value) || value;
  const fmt = (value, values) => t(value).replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
  function when(value) {
    const date = new Date(value);
    return Number.isFinite(date.valueOf()) ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  }

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

  // Also used by profile posts: tap a photo or video to see it whole, full screen (fix-it 18, owner 2026-11-17).
  const openMedia = (items, index, from) => { window.danzstakMediaCoordinator?.pauseAll?.(); openViewer(items, index, from); };
  window.danzstakProfileDailies = { openMedia };
})();
