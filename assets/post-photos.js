"use strict";
// Owner 2026-11-22: "should be able to upload multiple photos at once", "set a limit of 20 photos". A photo post holds up
// to 20 photos (its first, mediaKey, and up to 19 more, moreMediaKeys); every photo is also its own Daily (the server adds
// them). One shared piece for the Mix and profile composers and posts:
// - mount(first, urls): on the post the photos sit in one frame the member swipes through sideways (scroll snap, like the
//   familiar apps), with a small "2/5" counter. Owner 2026-11-22 ("Make the container the size of the image", "scale the
//   images and the videos and the containers all fit together"): the frame is the shape of the photo on show (media-fit's
//   range, 9:20..3:1), and while swiping its height moves smoothly from one photo's shape to the next, so each photo shows
//   whole when it settles;
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
  const clamp = ratio => globalThis.danzstakMediaFit?.clamp?.(ratio) ?? Math.min(3, Math.max(0.45, ratio));

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
      photo.dataset.fitWatched = "1"; // the frame takes each photo's shape (below); media-fit leaves the slides alone
      const slide = document.createElement("div");
      slide.className = "post-photos-slide";
      slide.setAttribute("role", "group");
      slide.setAttribute("aria-roledescription", "slide");
      slide.setAttribute("aria-label", `${index + 1} / ${total}`);
      slide.append(photo);
      track.append(slide);
    });
    // Each photo's shape once it has loaded (a photo further along loads as it comes near); until then it borrows the
    // nearest known shape before it, so the frame never jumps to a guess.
    const ratios = photos.map(() => 0);
    const ratioAt = index => { for (let at = index; at >= 0; at -= 1) if (ratios[at]) return ratios[at]; return ratios.find(Boolean) || 0; };
    const shape = () => {
      const position = track.scrollLeft / Math.max(1, track.clientWidth);
      const at = Math.max(0, Math.min(total - 1, Math.floor(position))), part = Math.max(0, Math.min(1, position - at));
      const from = ratioAt(at), to = ratioAt(Math.min(total - 1, at + 1)) || from;
      if (!from) return;
      // Height moves in a straight line between the two photos' heights: 1 / ratio is height per unit of width.
      const ratio = part && to !== from ? 1 / ((1 - part) / from + part / to) : from;
      frame.style.setProperty("--fit-ar", ratio.toFixed(4));
    };
    photos.forEach((photo, index) => {
      const measure = () => { if (photo.naturalWidth && photo.naturalHeight) { ratios[index] = clamp(photo.naturalWidth / photo.naturalHeight); shape(); } };
      if (photo.complete) measure();
      photo.addEventListener("load", measure);
    });
    const count = document.createElement("span");
    count.className = "post-photos-count";
    count.setAttribute("aria-hidden", "true");
    count.textContent = `1/${total}`;
    frame.append(track, count);
    let current = 0, frameRequest = 0;
    const update = () => {
      frameRequest = 0;
      shape();
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

  // Owner 2026-11-22: "photo should automatically go to mobile uploads", "If they're uploaded from a computer should be a
  // computer uploads". Where this post is made, sent with it: a phone or tablet (iPadOS reports a Mac with touch) is
  // "mobile", anything else "computer".
  function uploadSource() {
    const agent = navigator.userAgent || "";
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(agent) || (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1) || navigator.userAgentData?.mobile === true) return "mobile";
    return "computer";
  }

  // Owner 2026-11-22: "User should get to choose what album that the images go into or what album the videos go into",
  // "They should get the option to create an album or to load the images or videos into a selected album", "If they don't
  // choose … they will upload to mobile album or a computer album". Under the chosen photos or video, one chip: "Album:
  // Mobile uploads". Tapping it lists the member's albums, "+ New album" and the default; value() is the chosen album's id,
  // or "" for Mobile uploads / Computer uploads.
  function albumChoice() {
    const fallback = uploadSource() === "computer" ? "Computer uploads" : "Mobile uploads";
    let chosen = { albumId: "", name: fallback };
    const chip = document.createElement("button");
    chip.type = "button"; chip.className = "post-album-chip";
    const paint = () => { chip.textContent = `${t("Album")}: ${chosen.albumId ? chosen.name : t(fallback)} ▾`; chip.setAttribute("aria-label", `${t("Album")}: ${chosen.albumId ? chosen.name : t(fallback)}. ${t("Choose an album")}`); };
    paint();
    chip.addEventListener("click", async () => {
      const dialog = document.createElement("dialog"), form = document.createElement("form");
      dialog.className = "post-album-sheet"; form.method = "dialog";
      const title = document.createElement("h2"); title.textContent = t("Choose an album");
      const list = document.createElement("div"); list.className = "post-album-options"; list.setAttribute("role", "radiogroup"); list.setAttribute("aria-label", t("Albums"));
      const status = document.createElement("p"); status.className = "post-album-status"; status.textContent = t("Loading your albums…");
      const name = document.createElement("input"); name.maxLength = 80; name.placeholder = t("Album name"); name.hidden = true; name.setAttribute("aria-label", t("New album name"));
      const error = document.createElement("p"); error.className = "post-album-error"; error.setAttribute("role", "alert");
      const cancel = document.createElement("button"), done = document.createElement("button");
      cancel.type = "button"; cancel.textContent = t("Cancel"); cancel.addEventListener("click", () => dialog.close());
      done.type = "submit"; done.className = "primary"; done.textContent = t("Done");
      const actions = document.createElement("div"); actions.className = "post-album-actions"; actions.append(cancel, done);
      form.append(title, list, status, name, error, actions);
      dialog.append(form);
      dialog.addEventListener("close", () => dialog.remove());
      document.body.append(dialog);
      dialog.showModal();
      const row = (value, label) => {
        const option = document.createElement("label"), radio = document.createElement("input"), text = document.createElement("span");
        option.className = "post-album-option"; radio.type = "radio"; radio.name = "post-album"; radio.value = value; radio.checked = value === (chosen.albumId || "");
        radio.addEventListener("change", () => { name.hidden = value !== "new"; if (!name.hidden) name.focus(); });
        text.textContent = label; option.append(radio, text); list.append(option);
      };
      row("", t(fallback));
      let albums = [];
      try {
        const response = await fetch(API + "/albums", { credentials: "include", cache: "no-store" });
        albums = response.ok ? ((await response.json()).albums || []) : [];
        status.textContent = "";
      } catch { status.textContent = t("Your albums couldn't load. You can still make a new one."); }
      for (const album of albums) row(album.albumId, album.name);
      row("new", t("+ New album"));
      form.addEventListener("submit", async event => {
        event.preventDefault();
        const value = form.querySelector("input[name=post-album]:checked")?.value ?? "";
        if (value !== "new") { chosen = value ? { albumId: value, name: albums.find(album => album.albumId === value)?.name || "" } : { albumId: "", name: fallback }; paint(); dialog.close(); return; }
        if (!name.value.trim()) { error.textContent = t("Give the album a name."); name.focus(); return; }
        done.disabled = true;
        try {
          const response = await fetch(API + "/albums", { method: "POST", credentials: "include", headers: json, body: JSON.stringify({ name: name.value, date: "", place: "", visibility: "friends" }) });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || !data.album?.albumId) throw new Error(data.error || t("The album couldn't be made. Try again."));
          chosen = { albumId: data.album.albumId, name: data.album.name }; paint(); dialog.close();
        } catch (failure) { error.textContent = failure.message; done.disabled = false; }
      });
    });
    return { element: chip, value: () => chosen.albumId };
  }

  globalThis.danzstakPostPhotos = { mount, pick, tooMany, upload, attach, discard, uploadSource, albumChoice, MAX };
})();
