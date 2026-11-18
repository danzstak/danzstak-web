"use strict";
// Profile Videos tab (owner 2026-11-18, phone screenshot): the tab shows the member's videos only, as a
// grid with no captions, likes or comments. Tapping one opens a full-screen vertical player at that
// video; swipe up for the member's next video (newest to oldest), down for the previous. After the
// last one a short "That's all from <name>" card; Back (device or ←) returns to the same spot.
// Sound follows media-visibility.js: one player at a time, muted unless the member already unmuted,
// lower-right toggle. Playback runs as a coordinator session on the viewer's scroll list.
(() => {
  const t = text => window.danzstakTranslate?.(text) || text;
  const fmt = (text, values) => t(text).replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
  let viewer = null, list = null, header = null, returnTo = null, fromHistory = false, scrollLock = "";

  function owner() {
    const profile = window.danzstakCurrentProfile || {};
    return { name: String(profile.name || "").trim(), picture: String(profile.picture || "").trim() };
  }

  // One retry with a fresh signed URL when a stored video link has expired.
  function playable(video, item) {
    let retried = false;
    video.addEventListener("error", async () => {
      if (retried || typeof item.refresh !== "function") return;
      retried = true;
      const url = await item.refresh().catch(() => "");
      if (url) { item.mediaUrl = url; video.src = url; }
    });
    video.src = item.mediaUrl;
  }

  function ensureViewer() {
    if (viewer) return;
    viewer = document.createElement("dialog");
    viewer.className = "profile-video-viewer";
    viewer.setAttribute("aria-label", t("Videos"));
    header = document.createElement("div");
    header.className = "pvv-header";
    const back = document.createElement("button");
    back.type = "button"; back.className = "pvv-back"; back.dataset.icon = "back";
    back.setAttribute("aria-label", t("Back")); back.title = t("Back");
    back.addEventListener("click", close);
    const who = document.createElement("span"); who.className = "pvv-who";
    header.append(back, who);
    list = document.createElement("div");
    list.className = "pvv-list";
    viewer.append(header, list);
    viewer.addEventListener("cancel", event => { event.preventDefault(); close(); });
    viewer.addEventListener("keydown", event => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "PageDown" && event.key !== "PageUp") return;
      event.preventDefault();
      list.scrollBy({ top: (event.key === "ArrowDown" || event.key === "PageDown" ? 1 : -1) * list.clientHeight, behavior: "smooth" });
    });
    document.body.appendChild(viewer);
    window.danzstakIcons?.enhance?.(header);
    window.addEventListener("popstate", () => { if (viewer.open) { fromHistory = true; close(); } });
  }

  function paintHeader() {
    const { name, picture } = owner(), who = header.querySelector(".pvv-who");
    const avatar = picture ? document.createElement("img") : document.createElement("span");
    avatar.className = "pvv-avatar";
    if (picture) { avatar.src = picture; avatar.alt = ""; avatar.referrerPolicy = "no-referrer"; }
    else { avatar.textContent = name.charAt(0).toUpperCase(); avatar.setAttribute("aria-hidden", "true"); }
    const label = document.createElement("strong"); label.textContent = name; label.setAttribute("data-no-translate", "");
    who.replaceChildren(avatar, label);
  }

  function slide(item, index, total) {
    const section = document.createElement("section");
    section.className = "pvv-slide";
    section.setAttribute("aria-label", fmt("Video {n} of {total}", { n: index + 1, total }));
    const video = document.createElement("video");
    video.className = "reel-player pvv-video";
    video.muted = true; video.playsInline = true; video.loop = true; video.preload = "none";
    video.setAttribute("aria-label", item.content ? `${t("Video")}: ${item.content}` : t("Profile post video"));
    playable(video, item);
    section.appendChild(video);
    const caption = String(item.content || "").trim();
    if (caption && caption !== "Profile video") {
      const text = document.createElement("p");
      text.className = "pvv-caption"; text.textContent = caption; text.setAttribute("data-no-translate", "");
      section.appendChild(text);
      if (caption.length > 90) {
        const more = document.createElement("button");
        more.type = "button"; more.className = "pvv-more"; more.textContent = t("more");
        more.addEventListener("click", () => { const open = text.classList.toggle("is-open"); more.textContent = t(open ? "less" : "more"); });
        section.appendChild(more);
      }
    }
    return section;
  }

  function endCard() {
    const section = document.createElement("section");
    section.className = "pvv-slide pvv-end";
    const text = document.createElement("p");
    const name = owner().name;
    text.textContent = name ? fmt("That's all from {name}", { name }) : t("That's all");
    const back = document.createElement("button");
    back.type = "button"; back.className = "pvv-end-back"; back.textContent = t("Back to profile");
    back.addEventListener("click", close);
    section.append(text, back);
    return section;
  }

  function open(items, index = 0, from = null) {
    if (!Array.isArray(items) || !items.length) return;
    ensureViewer();
    window.danzstakMediaCoordinator?.pauseAll?.();
    returnTo = from; fromHistory = false;
    paintHeader();
    list.replaceChildren(...items.map((item, i) => slide(item, i, items.length)), endCard());
    scrollLock = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    if (!viewer.open) viewer.showModal();
    try { history.pushState({ ...(history.state && typeof history.state === "object" ? history.state : {}), danzstakProfileVideos: true }, ""); } catch {}
    const start = list.children[Math.max(0, Math.min(index, items.length - 1))];
    list.scrollTop = start.offsetTop;
    const video = start.querySelector("video");
    const sound = Boolean(window.danzstakMediaSound?.enabled?.());
    const started = window.danzstakMediaCoordinator?.startSession?.(list, video, { sound });
    if (!started && video) { video.muted = true; video.play().catch(() => {}); }
    header.querySelector(".pvv-back")?.focus({ preventScroll: true });
  }

  function close() {
    if (!viewer?.open) return;
    if (!fromHistory && history.state?.danzstakProfileVideos === true) { history.back(); return; }
    fromHistory = false;
    window.danzstakMediaCoordinator?.endSession?.(list);
    list.querySelectorAll("video").forEach(video => { video.pause(); video.removeAttribute("src"); video.load?.(); });
    list.replaceChildren();
    viewer.close();
    document.documentElement.style.overflow = scrollLock;
    returnTo?.focus?.({ preventScroll: true });
  }

  // The tab's grid: still frames only, no text. Tiles are added as videos arrive.
  function createGrid() {
    const items = [], element = document.createElement("div");
    element.className = "profile-video-grid";
    element.setAttribute("role", "list");
    function add(item) {
      if (!item?.mediaUrl) return;
      const index = items.push(item) - 1;
      const tile = document.createElement("button");
      tile.type = "button"; tile.className = "profile-video-tile"; tile.setAttribute("role", "listitem");
      tile.setAttribute("aria-label", item.content && item.content !== "Profile video" ? `${t("Play video")}: ${item.content}` : t("Play video"));
      const still = document.createElement("video");
      still.className = "profile-video-still"; still.muted = true; still.playsInline = true; still.preload = "metadata";
      still.setAttribute("aria-hidden", "true"); still.tabIndex = -1;
      still.addEventListener("loadedmetadata", () => { try { still.currentTime = Math.min(0.5, (still.duration || 1) / 10); } catch {} }, { once: true });
      playable(still, item);
      const play = document.createElement("span"); play.className = "profile-video-play"; play.setAttribute("aria-hidden", "true");
      tile.append(still, play);
      tile.addEventListener("click", () => open(items, index, tile));
      element.appendChild(tile);
    }
    return { element, add, items };
  }

  window.danzstakProfileVideos = { createGrid, open, close };
})();
