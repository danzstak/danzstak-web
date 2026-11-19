"use strict";
// Queue 5a1 (owner 2026-11-18 evening): tap any photo or video → one shared full-screen viewer.
// Media only (no post text, no reaction rows). Swipe up/down (owner 2026-11-19: vertical, like Reels) moves through the SAME member's
// photos (opened from a photo) or videos (opened from a video). Videos autoplay muted through the
// shared playback coordinator (media-visibility.js) with its lower-right sound toggle, so the sound
// choice carries over and only one player ever plays. Pinch-zoom and double-tap zoom on photos.
// Swipe down on the first item, ✕, Esc or system Back closes and restores the exact scroll spot (history state, no reload).
//
// Other screens opt in with data attributes instead of new code:
//   <img data-media-viewer data-media-group="album-42" src="…">  → swipes through [data-media-group="album-42"]
// or call window.danzstakMediaViewer.open([{ type: "image"|"video", src, alt }], startIndex).
(() => {
  if (globalThis.danzstakMediaViewer) return;
  const OPENERS = "img.post-media,video.post-media,img.profile-post-media,video.profile-post-media,[data-media-viewer]";
  const SKIP = ".ds-media-viewer,.composer,.post-composer,form,[data-media-viewer='off'],.saved-post-media";
  const translate = text => globalThis.danzstakTranslate?.(text) || text;
  const kindOf = element => element?.tagName === "VIDEO" || element?.dataset?.mediaType === "video" ? "video" : "image";
  const sourceOf = element => element?.dataset?.mediaFull || element?.currentSrc || element?.src || element?.getAttribute?.("src") || "";

  // Who owns this media? Mix/Tribe posts carry the author's member id; a profile page is one member.
  function ownerKey(element) {
    if (element.dataset?.mediaGroup) return "group:" + element.dataset.mediaGroup;
    if (element.classList?.contains("profile-post-media")) return "profile";
    const post = element.closest?.(".post");
    if (!post) return "single";
    const shared = element.closest?.(".shared-post,.shared-post-card,.shared-original");
    if (shared?.dataset?.authorMemberId) return "member:" + shared.dataset.authorMemberId;
    if (post.dataset.authorMemberId) return "member:" + post.dataset.authorMemberId;
    if (post.dataset.isOwner === "true") return "member:self";
    return "name:" + (post.querySelector(".post-author")?.textContent || "").trim();
  }
  function collect(element) {
    const kind = kindOf(element), key = ownerKey(element);
    if (key === "single") return { list: [element], index: 0 };
    const scope = element.closest?.(".feed-media-gallery") || document;
    const list = [...scope.querySelectorAll(OPENERS)].filter(item =>
      !item.closest(SKIP) && kindOf(item) === kind && sourceOf(item) && ownerKey(item) === key && item.getClientRects().length);
    if (!list.includes(element)) list.unshift(element);
    return { list, index: Math.max(0, list.indexOf(element)) };
  }

  let viewer = null;
  function open(items, startIndex = 0, { origin = null } = {}) {
    items = (items || []).filter(item => item && item.src && ["image", "video"].includes(item.type));
    if (!items.length) return false;
    if (viewer) close({ fromHistory: false, silent: true });
    const scrollY = window.scrollY, scrollX = window.scrollX;
    const soundOn = Boolean(globalThis.danzstakMediaSound?.enabled?.());
    globalThis.danzstakMediaCoordinator?.pauseAll?.();

    const root = document.createElement("div");
    root.className = "ds-media-viewer";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", translate(items[0].type === "video" ? "Videos, full screen" : "Photos, full screen"));
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "ds-media-viewer-close";
    closeButton.setAttribute("aria-label", translate("Close"));
    closeButton.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>';
    const counter = document.createElement("span");
    counter.className = "ds-media-viewer-count";
    counter.setAttribute("aria-live", "polite");
    const track = document.createElement("div");
    track.className = "ds-media-viewer-track";
    const slides = items.map((item, i) => {
      const slide = document.createElement("div");
      slide.className = "ds-media-viewer-slide";
      slide.dataset.index = String(i);
      let media;
      if (item.type === "video") {
        media = document.createElement("video");
        media.className = "ds-media-viewer-video";
        media.playsInline = true; media.loop = true; media.muted = true; media.preload = i === startIndex ? "auto" : "none";
        media.setAttribute("aria-label", item.alt || translate("Video"));
      } else {
        media = document.createElement("img");
        media.className = "ds-media-viewer-image";
        media.alt = item.alt || "";
        media.decoding = "async";
        media.draggable = false;
        if (Math.abs(i - startIndex) > 1) media.loading = "lazy";
      }
      media.src = item.src;
      slide.appendChild(media);
      track.appendChild(slide);
      return slide;
    });
    root.append(track, counter, closeButton);

    const state = { root, track, slides, items, index: Math.min(Math.max(0, startIndex), items.length - 1), scrollY, scrollX, origin, history: false, zoom: { scale: 1, x: 0, y: 0 } };
    viewer = state;
    document.documentElement.classList.add("ds-media-viewer-open");
    document.body.appendChild(root);
    show(state.index, false);
    closeButton.addEventListener("click", () => close());
    root.addEventListener("keydown", onKey);
    bindGestures(state);
    if (items[state.index].type === "video") {
      const video = slides[state.index].querySelector("video");
      requestAnimationFrame(() => globalThis.danzstakMediaCoordinator?.startSession?.(track, video, { sound: soundOn }) || video.play().catch(() => {}));
    } else if (items.some(item => item.type === "video")) globalThis.danzstakMediaCoordinator?.startSession?.(track, null, { sound: soundOn });
    try { history.pushState({ ...(history.state || {}), danzstakMediaViewer: true }, ""); state.history = true; } catch {}
    closeButton.focus({ preventScroll: true });
    window.dispatchEvent(new CustomEvent("danzstak:media-viewer", { detail: { open: true } }));
    return true;
  }

  function show(index, animate = true) {
    const state = viewer; if (!state) return;
    state.index = Math.min(Math.max(0, index), state.items.length - 1);
    resetZoom(state);
    state.track.style.transition = animate ? "transform .26s cubic-bezier(.2,.8,.2,1)" : "none";
    state.track.style.transform = `translate3d(0,${-state.index * 100}%,0)`; // owner 2026-11-19: vertical, like Reels
    state.slides.forEach((slide, i) => {
      slide.setAttribute("aria-hidden", String(i !== state.index));
      const video = slide.querySelector("video");
      if (video && Math.abs(i - state.index) <= 1 && video.preload === "none") video.preload = "metadata";
    });
    state.root.querySelector(".ds-media-viewer-count").textContent = state.items.length > 1 ? `${state.index + 1} / ${state.items.length}` : "";
    state.root.dataset.index = String(state.index);
  }

  function close({ fromHistory = false, silent = false } = {}) {
    const state = viewer; if (!state) return;
    if (!fromHistory && state.history && history.state?.danzstakMediaViewer === true) { history.back(); return; }
    viewer = null;
    globalThis.danzstakMediaCoordinator?.endSession?.(state.track);
    state.root.querySelectorAll("video").forEach(video => { video.pause(); video.removeAttribute("src"); video.load?.(); });
    state.root.remove();
    document.documentElement.classList.remove("ds-media-viewer-open");
    const restore = () => window.scrollTo(state.scrollX, state.scrollY);
    restore(); requestAnimationFrame(restore);
    if (!silent) state.origin?.focus?.({ preventScroll: true });
    window.dispatchEvent(new CustomEvent("danzstak:media-viewer", { detail: { open: false } }));
  }

  function onKey(event) {
    if (!viewer) return;
    if (event.key === "Escape") { event.preventDefault(); close(); }
    else if (event.key === "ArrowDown" || event.key === "ArrowRight") { event.preventDefault(); show(viewer.index + 1); }
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") { event.preventDefault(); show(viewer.index - 1); }
    else if (event.key === "Tab") { event.preventDefault(); viewer.root.querySelector(".ds-media-viewer-close")?.focus(); }
  }

  function resetZoom(state) {
    state.zoom = { scale: 1, x: 0, y: 0 };
    state.slides.forEach(slide => { const image = slide.querySelector("img"); if (image) image.style.transform = ""; });
    state.root.classList.remove("is-zoomed");
  }
  function applyZoom(state, animate) {
    const image = state.slides[state.index]?.querySelector("img"); if (!image) return;
    const { scale } = state.zoom;
    const maxX = image.clientWidth * (scale - 1) / 2, maxY = image.clientHeight * (scale - 1) / 2;
    state.zoom.x = Math.min(maxX, Math.max(-maxX, state.zoom.x));
    state.zoom.y = Math.min(maxY, Math.max(-maxY, state.zoom.y));
    image.style.transition = animate ? "transform .2s ease" : "none";
    image.style.transform = scale > 1 ? `translate3d(${state.zoom.x}px,${state.zoom.y}px,0) scale(${scale})` : "";
    state.root.classList.toggle("is-zoomed", scale > 1);
  }

  // One pointer (owner correction 2026-11-19: vertical, like Reels): swipe up = next, swipe down = previous, and swipe
  // down on the first one closes; or pan a zoomed photo. ✕, Esc and Back close too.
  // Two pointers on a photo: pinch-zoom. Double tap a photo: zoom in/out. Tap a video: play/pause.
  function bindGestures(state) {
    const { root, track } = state;
    const pointers = new Map();
    let start = null, axis = "", pinch = null, lastTap = 0, wheelAt = 0;
    const height = () => root.clientHeight || window.innerHeight;
    root.addEventListener("pointerdown", event => {
      if (event.target.closest("button")) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      try { root.setPointerCapture(event.pointerId); } catch {}
      if (pointers.size === 2 && state.items[state.index].type === "image") {
        const [a, b] = [...pointers.values()];
        pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, scale: state.zoom.scale };
        start = null; axis = "";
        return;
      }
      start = { x: event.clientX, y: event.clientY, t: Date.now(), zx: state.zoom.x, zy: state.zoom.y };
      axis = "";
    });
    root.addEventListener("pointermove", event => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinch && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        state.zoom.scale = Math.min(4, Math.max(1, pinch.scale * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.distance)));
        applyZoom(state, false);
        return;
      }
      if (!start) return;
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      if (state.zoom.scale > 1) { state.zoom.x = start.zx + dx; state.zoom.y = start.zy + dy; applyZoom(state, false); return; }
      if (!axis && Math.hypot(dx, dy) > 8) axis = Math.abs(dx) > Math.abs(dy) ? "x" : state.index === 0 && dy > 0 ? "close" : "y";
      if (axis === "y") {
        const edge = state.index === state.items.length - 1 && dy < 0;
        track.style.transition = "none";
        track.style.transform = `translate3d(0,calc(${-state.index * 100}% + ${edge ? dy / 3 : dy}px),0)`;
      } else if (axis === "close") {
        const slide = state.slides[state.index];
        slide.style.transition = "none";
        slide.style.transform = `translate3d(0,${dy}px,0) scale(${Math.max(.8, 1 - dy / 1600)})`;
        root.style.setProperty("--ds-viewer-fade", String(Math.max(.25, 1 - dy / 500)));
      }
    });
    const finish = event => {
      if (!pointers.has(event.pointerId)) return;
      pointers.delete(event.pointerId);
      if (pinch) { if (pointers.size < 2) { pinch = null; if (state.zoom.scale < 1.05) { state.zoom.scale = 1; state.zoom.x = state.zoom.y = 0; } applyZoom(state, true); } return; }
      if (!start) return;
      const dx = event.clientX - start.x, dy = event.clientY - start.y, elapsed = Math.max(1, Date.now() - start.t);
      const was = start; start = null;
      if (axis === "y") {
        const fast = Math.abs(dy) / elapsed > .45;
        const step = Math.abs(dy) > height() * .15 || fast ? (dy < 0 ? 1 : -1) : 0;
        show(state.index + step);
        return;
      }
      if (axis === "close") {
        const slide = state.slides[state.index];
        if (dy > 110 || dy / elapsed > .6) { close(); return; }
        slide.style.transition = "transform .2s ease"; slide.style.transform = "";
        root.style.removeProperty("--ds-viewer-fade");
        return;
      }
      if (axis || event.type === "pointercancel" || Math.hypot(dx, dy) > 8) return;
      // A tap.
      const now = Date.now(), item = state.items[state.index];
      if (item.type === "image") {
        if (now - lastTap < 300) {
          lastTap = 0;
          if (state.zoom.scale > 1) state.zoom = { scale: 1, x: 0, y: 0 };
          else { const rect = root.getBoundingClientRect(); state.zoom = { scale: 2.5, x: (rect.width / 2 - was.x) * 1.5, y: (rect.height / 2 - was.y) * 1.5 }; }
          applyZoom(state, true);
        } else lastTap = now;
      } else {
        const video = state.slides[state.index].querySelector("video");
        if (video && event.target.closest(".ds-media-viewer-slide")) { if (video.paused) video.play().catch(() => {}); else video.pause(); }
      }
    };
    root.addEventListener("pointerup", finish);
    root.addEventListener("pointercancel", finish);
    root.addEventListener("wheel", event => {
      event.preventDefault();
      const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (Math.abs(delta) < 30 || Date.now() - wheelAt < 450) return; // one wheel flick = one item
      wheelAt = Date.now(); show(state.index + (delta > 0 ? 1 : -1));
    }, { passive: false });
  }

  addEventListener("popstate", () => { if (viewer && history.state?.danzstakMediaViewer !== true) close({ fromHistory: true }); });

  function itemFor(element) {
    return { type: kindOf(element), src: sourceOf(element), alt: element.getAttribute("alt") || element.getAttribute("aria-label") || "" };
  }
  function openFrom(element) {
    const { list, index } = collect(element);
    return open(list.map(itemFor), index, { origin: element });
  }
  const opener = target => {
    const element = target?.closest?.(OPENERS);
    if (!element || element.closest(SKIP) || !sourceOf(element)) return null;
    return element;
  };
  // Capture phase so the tap opens the viewer instead of toggling the small inline player.
  document.addEventListener("click", event => {
    if (event.button !== 0 || event.defaultPrevented) return;
    const element = opener(event.target);
    if (!element) return;
    event.preventDefault(); event.stopPropagation();
    openFrom(element);
  }, true);
  document.addEventListener("keydown", event => {
    if (viewer || (event.key !== "Enter" && event.key !== " ")) return;
    const element = opener(event.target);
    if (!element || event.target !== element) return;
    event.preventDefault(); event.stopPropagation();
    openFrom(element);
  }, true); // capture: replaces older single-item openers (profile) with the swipeable viewer
  // Photos become keyboard reachable (videos already are through their controls).
  const prepare = node => {
    const list = node.matches?.(OPENERS) ? [node] : [...(node.querySelectorAll?.(OPENERS) || [])];
    for (const element of list) {
      if (element.closest(SKIP)) continue;
      element.classList.add("ds-media-viewer-opener");
      if (element.tagName === "IMG" && !element.hasAttribute("tabindex")) element.tabIndex = 0;
    }
  };
  const start = () => {
    prepare(document.body);
    new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => node.nodeType === 1 && prepare(node))))
      .observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start, { once: true });

  globalThis.danzstakMediaViewer = { open, close: () => close(), openFrom, isOpen: () => Boolean(viewer), index: () => viewer?.index ?? -1 };
})();
