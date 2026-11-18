"use strict";
// Queue 5a2 (owner 2026-11-18): named albums on the profile Photos and Videos tabs ("Hellfest 2026",
// "Mike & Ana's wedding", a concert date…). An Albums row sits above the media grid: "All photos" plus each album as a
// cover with a count, and "+ New album" for the owner. An album page shows its photos (or videos) in the same grid;
// the owner adds many at once, renames it, chooses who sees it (Public / Friends / Only me), removes photos, picks the
// cover and deletes it. Photos and videos only, never music files.
(() => {
  const API = "https://api.danzstak.com";
  const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime"];
  const MAX_VIDEO = 100 * 1024 * 1024, MAX_PHOTO = 25 * 1024 * 1024, BATCH = 10;
  const VISIBILITY = { public: "Public", friends: "Friends", private: "Only me" };
  const el = (tag, className = "", text = "") => { const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node; };
  const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
  const say = (message, urgent = false) => window.danzstakShowFeedback?.(message, urgent ? { urgent: true } : undefined);
  let state = null; // { kind, container, profile, albums, isOwner }

  async function api(path, options = {}) {
    const response = await fetch(`${API}${path}`, { credentials: "include", cache: "no-store", ...options, ...(options.body ? { headers: { "content-type": "application/json" } } : {}) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || "That did not work. Try again."), { status: response.status });
    return data;
  }
  const memberQuery = (profile, joiner = "?") => profile?.isOwner || !/^[a-f0-9-]{36}$/.test(profile?.memberId || "") ? "" : `${joiner}member=${encodeURIComponent(profile.memberId)}`;
  const formatDate = value => { if (!value) return ""; try { return new Intl.DateTimeFormat(document.documentElement.lang || undefined, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)); } catch { return value; } };
  const countLine = album => [album.photoCount ? plural(album.photoCount, "photo", "photos") : "", album.videoCount ? plural(album.videoCount, "video", "videos") : ""].filter(Boolean).join(" · ") || "Empty";

  // ---------- Albums row ----------
  function tile(label, sub, onClick, cover = null, selected = false) {
    const button = el("button", `profile-album-tile${selected ? " is-selected" : ""}`);
    button.type = "button"; button.setAttribute("aria-pressed", String(selected));
    const art = el("span", "profile-album-cover");
    if (cover?.url) {
      const media = document.createElement(cover.mediaType === "video" ? "video" : "img");
      media.src = cover.url; media.setAttribute("aria-hidden", "true");
      if (media.tagName === "VIDEO") { media.muted = true; media.playsInline = true; media.preload = "metadata"; } else { media.alt = ""; media.loading = "lazy"; }
      art.append(media);
    } else art.classList.add("is-empty");
    button.append(art, el("strong", "", label), el("small", "", sub));
    button.addEventListener("click", onClick);
    return button;
  }

  function renderRow(selectedId = "") {
    const { container, kind, albums, isOwner } = state;
    container.querySelector(".profile-albums")?.remove();
    // The empty-grid line is a bare text node; wrap it so an album page can hide it like the grid.
    for (const node of [...container.childNodes]) if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) node.replaceWith(el("p", "profile-album-empty", node.textContent));
    if (!albums.length && !isOwner) return; // visitors see nothing when there are no albums
    const section = el("section", "profile-albums"); section.setAttribute("aria-label", "Albums");
    const head = el("div", "profile-albums-head");
    head.append(el("h3", "", "Albums"));
    if (isOwner) {
      const add = el("button", "profile-albums-new", "+ New album"); add.type = "button";
      add.addEventListener("click", () => editAlbum(null));
      head.append(add);
    }
    const strip = el("div", "profile-albums-strip");
    strip.append(tile(kind === "image" ? "All photos" : "All videos", "Everything", () => showAll(), null, !selectedId));
    for (const album of albums) {
      const visibility = isOwner && album.visibility !== "public" ? ` · ${VISIBILITY[album.visibility]}` : "";
      strip.append(tile(album.name, `${countLine(album)}${visibility}`, () => openAlbum(album.albumId), album.cover, album.albumId === selectedId));
    }
    section.append(head, strip);
    container.prepend(section);
  }

  function showAll() {
    const { container } = state;
    container.querySelector(".profile-album-page")?.remove();
    for (const child of container.children) delete child.dataset.albumHidden;
    renderRow("");
  }

  // ---------- Album page ----------
  async function openAlbum(albumId) {
    const { container, kind, profile } = state;
    let data;
    try { data = await api(`/albums/${encodeURIComponent(albumId)}${memberQuery(profile)}`); }
    catch (error) { say(error.message, true); return; }
    for (const child of container.children) if (!child.classList.contains("profile-albums")) child.dataset.albumHidden = "1";
    container.querySelector(".profile-album-page")?.remove();
    renderRow(albumId);
    const page = el("section", "profile-album-page"); page.setAttribute("aria-label", data.album.name);
    const head = el("div", "profile-album-head"), title = el("div", "profile-album-title");
    title.append(el("h3", "", data.album.name), el("p", "", [formatDate(data.album.date), data.album.place, data.isOwner ? VISIBILITY[data.album.visibility] : ""].filter(Boolean).join(" · ") || countLine(data.album)));
    head.append(title);
    const status = el("p", "profile-album-status"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
    if (data.isOwner) {
      const actions = el("div", "profile-album-actions");
      const add = el("button", "primary", kind === "video" ? "Add videos" : "Add photos"); add.type = "button";
      add.addEventListener("click", () => pickFiles(data.album, status));
      const edit = el("button", "", "Edit"); edit.type = "button"; edit.addEventListener("click", () => editAlbum(data.album));
      const select = el("button", "", "Select"); select.type = "button"; select.addEventListener("click", () => selectMode(page, data, status));
      actions.append(add, edit, select);
      head.append(actions);
    }
    const shown = data.items.filter(item => item.mediaType === kind);
    page.append(head, status);
    if (shown.length && window.danzstakProfileVideos) {
      const grid = window.danzstakProfileVideos.createGrid({ kind });
      for (const item of shown) grid.add({ mediaUrl: item.url, content: data.album.name });
      page.append(grid.element);
    } else page.append(el("p", "profile-album-empty", data.isOwner ? `No ${kind === "video" ? "videos" : "photos"} here yet. Add some from your phone.` : `No ${kind === "video" ? "videos" : "photos"} in this album.`));
    const other = data.items.length - shown.length;
    if (other) page.append(el("p", "profile-album-note", `${plural(other, kind === "video" ? "photo" : "video", kind === "video" ? "photos" : "videos")} from this album ${other === 1 ? "is" : "are"} on the ${kind === "video" ? "Photos" : "Videos"} tab.`));
    container.append(page);
    page.querySelector("h3")?.focus?.();
  }

  // Owner: tap photos to select, then remove them or make one the cover.
  function selectMode(page, data, status) {
    const { kind } = state, shown = data.items.filter(item => item.mediaType === kind), chosen = new Set();
    page.querySelector(".profile-video-grid, .profile-album-select")?.remove();
    const grid = el("div", "profile-album-select"); grid.setAttribute("role", "group"); grid.setAttribute("aria-label", "Select photos and videos");
    const bar = el("div", "profile-album-bar");
    const remove = el("button", "danger", "Remove"), cover = el("button", "", "Make cover"), done = el("button", "", "Done");
    remove.type = cover.type = done.type = "button";
    const update = () => { remove.disabled = !chosen.size; cover.disabled = chosen.size !== 1; remove.textContent = chosen.size ? `Remove ${chosen.size}` : "Remove"; };
    for (const item of shown) {
      const pick = el("button", "profile-album-pick"); pick.type = "button"; pick.setAttribute("aria-pressed", "false");
      pick.setAttribute("aria-label", `${item.mediaType === "video" ? "Video" : "Photo"} ${shown.indexOf(item) + 1}`);
      const media = document.createElement(item.mediaType === "video" ? "video" : "img");
      media.src = item.url; if (media.tagName === "VIDEO") { media.muted = true; media.playsInline = true; media.preload = "metadata"; } else { media.alt = ""; media.loading = "lazy"; }
      pick.append(media);
      pick.addEventListener("click", () => { const on = !chosen.has(item.itemId); if (on) chosen.add(item.itemId); else chosen.delete(item.itemId); pick.setAttribute("aria-pressed", String(on)); update(); });
      grid.append(pick);
    }
    remove.addEventListener("click", async () => {
      const ok = window.danzstakConfirm ? await window.danzstakConfirm(`Remove ${plural(chosen.size, "item", "items")} from this album and from DanzStak? Screenshots and downloads made outside DanzStak can't be recalled.`, { title: "Remove from album?", confirmLabel: "Remove", danger: true }) : window.confirm("Remove the selected items?");
      if (!ok) return;
      remove.disabled = true; status.textContent = "Removing…";
      let failed = 0;
      for (const itemId of chosen) { try { await api(`/albums/${data.album.albumId}/items/${itemId}`, { method: "DELETE" }); } catch { failed += 1; } }
      status.textContent = failed ? `${failed} could not be removed. Try again.` : "Removed.";
      await refreshAlbums(); await openAlbum(data.album.albumId);
    });
    cover.addEventListener("click", async () => {
      try { await api(`/albums/${data.album.albumId}`, { method: "PATCH", body: JSON.stringify({ coverItemId: [...chosen][0] }) }); say("Cover updated."); await refreshAlbums(); await openAlbum(data.album.albumId); }
      catch (error) { say(error.message, true); }
    });
    done.addEventListener("click", () => openAlbum(data.album.albumId));
    bar.append(remove, cover, done); update();
    page.querySelector(".profile-album-empty")?.remove();
    page.append(grid, bar);
  }

  // ---------- Upload many at once ----------
  function pickFiles(album, status) {
    const input = document.createElement("input");
    input.type = "file"; input.multiple = true; input.accept = ACCEPT.join(",");
    input.addEventListener("change", () => upload(album, [...input.files], status), { once: true });
    input.click();
  }
  async function upload(album, files, status) {
    const usable = files.filter(file => ACCEPT.includes(file.type) && file.size <= (file.type.startsWith("video/") ? MAX_VIDEO : MAX_PHOTO));
    const skipped = files.length - usable.length;
    if (!usable.length) { status.textContent = "Choose photos or videos (videos up to 100 MB). Music files can't be added."; return; }
    let pending = [], added = 0, failed = 0, tried = 0;
    const flush = async () => {
      if (!pending.length) return;
      const batch = pending; pending = [];
      try { await api(`/albums/${album.albumId}/items`, { method: "POST", body: JSON.stringify({ items: batch }) }); added += batch.length; }
      catch { failed += batch.length; for (const item of batch) api("/stories", { method: "POST", body: JSON.stringify({ action: "discard", mediaKey: item.mediaKey }) }).catch(() => {}); }
    };
    for (const file of usable) {
      tried += 1;
      status.textContent = `Uploading ${tried} of ${usable.length}…`;
      try {
        const ticket = await api("/stories", { method: "POST", body: JSON.stringify({ contentType: file.type, purpose: "post" }) });
        const put = await fetch(ticket.uploadUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
        if (!put.ok) throw new Error("upload");
        pending.push({ mediaKey: ticket.mediaKey, mediaType: ticket.mediaType });
        if (pending.length >= BATCH) await flush();
      } catch { failed += 1; }
    }
    await flush();
    status.textContent = `${plural(added, "file", "files")} added to ${album.name}.${failed ? ` ${failed} could not be uploaded.` : ""}${skipped ? ` ${skipped} skipped (not a photo or video, or too big).` : ""}`;
    await refreshAlbums();
    await openAlbum(album.albumId);
    state.container.querySelector(".profile-album-status").textContent = status.textContent;
  }

  // ---------- New / edit / delete ----------
  function editAlbum(album) {
    const dialog = el("dialog", "profile-album-dialog"), form = el("form");
    form.method = "dialog";
    const field = (label, input) => { const wrap = el("label", "", label); wrap.append(input); return wrap; };
    const name = el("input"); name.required = true; name.maxLength = 80; name.value = album?.name || ""; name.placeholder = "Hellfest 2026";
    const date = el("input"); date.type = "date"; date.value = album?.date || "";
    const place = el("input"); place.maxLength = 120; place.value = album?.place || ""; place.placeholder = "Where it happened";
    const who = el("select");
    for (const [value, label] of Object.entries(VISIBILITY)) { const option = el("option", "", label); option.value = value; who.append(option); }
    who.value = album?.visibility || "friends";
    const error = el("p", "profile-album-error"); error.setAttribute("role", "alert");
    const save = el("button", "primary", album ? "Save" : "Create album"), cancel = el("button", "", "Cancel");
    save.type = "submit"; cancel.type = "button"; cancel.addEventListener("click", () => dialog.close());
    const actions = el("div", "profile-album-dialog-actions"); actions.append(cancel, save);
    form.append(el("h2", "", album ? "Edit album" : "New album"), field("Name", name), field("Date (optional)", date), field("Place (optional)", place), field("Who can see it", who), error, actions);
    if (album) {
      const remove = el("button", "danger profile-album-delete", "Delete album"); remove.type = "button";
      remove.addEventListener("click", async () => {
        const ok = window.danzstakConfirm ? await window.danzstakConfirm(`Delete "${album.name}" and every photo and video in it from DanzStak? Screenshots and downloads made outside DanzStak can't be recalled.`, { title: "Delete album?", confirmLabel: "Delete album", danger: true }) : window.confirm("Delete this album?");
        if (!ok) return;
        try { await api(`/albums/${album.albumId}`, { method: "DELETE" }); dialog.close(); say("Album deleted."); await refreshAlbums(); showAll(); }
        catch (err) { error.textContent = err.message; }
      });
      form.append(remove);
    }
    form.addEventListener("submit", async event => {
      event.preventDefault();
      save.disabled = true; error.textContent = "";
      const body = JSON.stringify({ name: name.value, date: date.value, place: place.value, visibility: who.value });
      try {
        const data = album ? await api(`/albums/${album.albumId}`, { method: "PATCH", body }) : await api("/albums", { method: "POST", body });
        dialog.close(); await refreshAlbums(); await openAlbum((data.album || album).albumId);
        if (!album) say("Album created. Add photos to it.");
      } catch (err) { error.textContent = err.message; save.disabled = false; }
    });
    dialog.append(form);
    dialog.addEventListener("close", () => dialog.remove());
    document.body.append(dialog);
    dialog.showModal(); name.focus();
  }

  async function refreshAlbums() {
    try { const data = await api(`/albums?kind=${state.kind}${memberQuery(state.profile, "&")}`); state.albums = data.albums || []; state.isOwner = data.isOwner === true; }
    catch { /* keep what is shown */ }
  }

  window.addEventListener("danzstak:profile-media-tab", async event => {
    const { mediaType, container } = event.detail || {};
    if (!container || !["image", "video"].includes(mediaType)) return;
    state = { kind: mediaType, container, profile: window.danzstakCurrentProfile || {}, albums: [], isOwner: window.danzstakCurrentProfile?.isOwner === true };
    await refreshAlbums();
    if (state.container === container && container.isConnected) renderRow("");
  });
  window.DanzStakProfileAlbums = { countLine, formatDate }; // read by tests
})();
