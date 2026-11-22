"use strict";
// Owner 2026-11-22: "should be able to upload multiple photos at once", "set a limit of 20 photos". A photo post holds up
// to 20 photos (its first, mediaKey, and up to 19 more, moreMediaKeys); every photo is also its own Daily (the server adds
// them). One shared piece for the Mix and profile composers and posts:
// - mount(first, urls): on the post the photos sit in one frame shaped like the first photo (4:5 to 1.91:1, F22) that the
//   member swipes through sideways (scroll snap, like the familiar apps), with a small "2/5" counter;
// - pick(files): keeps photos only, at most 20, and says so when more were chosen;
// - upload(files, request): uploads the extra photos (three at a time, in order) and returns their keys; if one fails, the
//   ones already uploaded are discarded;
// - attach(saved, keys, body, request): when the server didn't keep the extra photos (an Auth API from before this
//   change), each becomes its own post with the same words, so nothing the member picked is lost.
(() => {
  if (globalThis.danzstakPostPhotos) return;
  const MAX = 20;
  const API = "https://api.danzstak.com";
  const t = value => globalThis.danzstakTranslate?.(value) || value;
  const clamp = ratio => globalThis.danzstakMediaFit?.clamp?.(ratio) ?? Math.min(1.91, Math.max(0.8, ratio));

  function mount(first, urls, { alt = "" } = {}) {
    const more = (Array.isArray(urls) ? urls : []).filter(url => typeof url === "string" && url).slice(0, MAX - 1);
    if (!first?.parentNode || !more.length || first.closest(".post-photos")) return null;
    const total = more.length + 1;
    const frame = document.createElement("div");
    frame.className = "post-photos";
    frame.setAttribute("role", "group");
    frame.setAttribute("aria-roledescription", "carousel");
    frame.setAttribute("aria-label", t("{count} photos").replace("{count}", String(total)));
    const track = document.createElement("div");
    track.className = "post-photos-track";
    track.tabIndex = 0;
    first.replaceWith(frame);
    const photos = [first, ...more.map(url => {
      const image = document.createElement("img");
      image.className = first.className; image.src = url; image.loading = "lazy"; image.decoding = "async";
      image.referrerPolicy = first.referrerPolicy || "no-referrer";
      image.alt = first.alt || alt || "";
      return image;
    })];
    photos.forEach((photo, index) => {
      photo.dataset.photoIndex = String(index);
      photo.dataset.fitWatched = "1"; // the frame takes the first photo's shape; media-fit leaves the slides alone
      const slide = document.createElement("div");
      slide.className = "post-photos-slide";
      slide.setAttribute("role", "group");
      slide.setAttribute("aria-roledescription", "slide");
      slide.setAttribute("aria-label", `${index + 1} / ${total}`);
      slide.append(photo);
      track.append(slide);
    });
    const shape = () => { if (first.naturalWidth && first.naturalHeight) frame.style.setProperty("--fit-ar", clamp(first.naturalWidth / first.naturalHeight).toFixed(4)); };
    if (first.complete) shape();
    first.addEventListener("load", shape);
    const count = document.createElement("span");
    count.className = "post-photos-count";
    count.setAttribute("aria-hidden", "true");
    count.textContent = `1/${total}`;
    frame.append(track, count);
    let current = 0, frameRequest = 0;
    const update = () => {
      frameRequest = 0;
      const index = Math.max(0, Math.min(total - 1, Math.round(track.scrollLeft / Math.max(1, track.clientWidth))));
      if (index === current) return;
      current = index; count.textContent = `${index + 1}/${total}`;
    };
    track.addEventListener("scroll", () => { if (!frameRequest) frameRequest = requestAnimationFrame(update); }, { passive: true });
    track.addEventListener("keydown", event => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      const next = Math.max(0, Math.min(total - 1, current + (event.key === "ArrowRight" ? 1 : -1)));
      track.scrollTo({ left: next * track.clientWidth, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
    return frame;
  }

  // Photos only, at most 20 (the rest are left out, and the member is told).
  function pick(files) {
    const photos = [...(files || [])].filter(file => /^image\//.test(file?.type || ""));
    return { photos: photos.slice(0, MAX), dropped: Math.max(0, photos.length - MAX) };
  }
  const tooMany = () => t("A post holds up to 20 photos. The first 20 are attached.");

  const json = { "Content-Type": "application/json" };
  function discard(keys, request) {
    for (const key of keys) request(API + "/stories", { method: "POST", credentials: "include", keepalive: true, headers: json, body: JSON.stringify({ action: "discard", mediaKey: key }) }, 5000).catch(() => {});
  }
  async function upload(files, request, deadline = file => Math.max(120000, Math.ceil(file.size / (64 * 1024)) * 1000)) {
    const list = [...files].slice(0, MAX - 1), keys = new Array(list.length).fill("");
    let next = 0, failure = null;
    const worker = async () => {
      while (!failure && next < list.length) {
        const index = next++, file = list[index];
        try {
          const ticketResponse = await request(API + "/stories", { method: "POST", credentials: "include", headers: json, body: JSON.stringify({ contentType: file.type, purpose: "post" }) }, 15000);
          const ticket = await ticketResponse.json().catch(() => ({}));
          if (!ticketResponse.ok || !ticket.uploadUrl || !ticket.mediaKey || ticket.mediaType !== "image") throw new Error(ticket.error || "Media upload could not start");
          const put = await request(ticket.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file }, deadline(file));
          if (!put.ok) { discard([ticket.mediaKey], request); throw new Error("Media upload failed"); }
          keys[index] = ticket.mediaKey;
        } catch (error) { failure = failure || error; }
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, list.length) }, worker));
    if (failure) { discard(keys.filter(Boolean), request); throw failure; }
    return keys;
  }

  async function attach(saved, keys, body, request) {
    if (!keys.length || Array.isArray(saved?.moreMediaKeys) && saved.moreMediaKeys.length === keys.length) return [];
    const posts = [];
    for (const key of keys) {
      const response = await request(API + "/secure-posts", { method: "POST", credentials: "include", headers: json, body: JSON.stringify({ ...body, mediaKey: key, mediaType: "image", reel: false }) }).catch(() => null);
      if (response?.ok) posts.push(await response.json().catch(() => ({})));
      else discard([key], request);
    }
    return posts;
  }

  globalThis.danzstakPostPhotos = { mount, pick, tooMany, upload, attach, discard, MAX };
})();
