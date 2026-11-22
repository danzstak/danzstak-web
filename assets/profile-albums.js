"use strict";
// Queue 5a2 (owner 2026-11-18): named albums on the profile Photos and Videos tabs ("Hellfest 2026",
// "Mike & Ana's wedding", a concert date…). An Albums row sits above the media grid: "All photos" plus each album as a
// cover with a count, and "+ New album" for the owner. An album page shows its photos (or videos) in the same grid;
// the owner adds many at once, renames it, chooses who sees it (Public / Friends / Only me), removes photos, picks the
// cover and deletes it. Photos and videos only, never music files.
// Owner 2026-11-22 ("There should be a create album here", "photo should automatically go to mobile uploads", "If
// they're uploaded from a computer should be a computer uploads", "Or user gets to change the name of that album"):
// "+ Create album" leads the row, and two automatic albums follow "All photos": "Mobile uploads" and "Computer
// uploads", the photos (or videos) of the member's own posts by where each post was made. They are drawn from the
// posts this page already shows, so a visitor sees only what the posts' own audiences allow; the owner can rename them.
// Posts from before the app recorded where they were made count as mobile (DanzStak is used from phones).
// Owner 2026-11-22 ("there's not a lot of loose images in the pictures menu… you'll have a few albums in there full of
// images or videos"): the tab opens on the albums, a grid of covers; "All photos" is one of them. An album opens as its
// own view with "← Albums" (the phone's Back does the same). "User should get to choose what album the images go into":
// a post can name one of the member's albums (assets/album-choice.js); its photos then show in that album, not in the
// automatic one.
(() => {
  const API = "https://api.danzstak.com";
  const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime"];
  const MAX_VIDEO = 100 * 1024 * 1024, MAX_PHOTO = 25 * 1024 * 1024, BATCH = 10;
  const VISIBILITY = { public: "Public", friends: "Friends", private: "Only me" };
  const el = (tag, className = "", text = "") => { const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node; };
  const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
  const say = (message, urgent = false) => window.danzstakShowFeedback?.(message, urgent ? { urgent: true } : undefined);
  let state = null; // { kind, container, profile, albums, isOwner, renamed }
  const AUTOMATIC = { mobile: "Mobile uploads", computer: "Computer uploads" };

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

  // The photos (or videos) of the member's own posts made from a phone ("mobile") or a computer and not put in an album,
  // newest first, every photo of a multi-photo post included. A renamed automatic album holds those posted up to its
  // renaming (after the one before it); the open one holds those posted since the last renaming.
  const sourceOf = post => post.uploadSource === "computer" ? "computer" : "mobile";
  const closedFor = source => (state.renamed || []).filter(album => album.source === source);
  function segmentItems(source, after, until) {
    const posts = Array.isArray(window.danzstakProfilePosts) ? window.danzstakProfilePosts : [], items = [];
    for (const post of posts) {
      if (!ownMedia(post) || knownAlbum(post.albumId) || sourceOf(post) !== source) continue;
      const at = String(post.createdAt || "");
      if ((after && at <= after) || (until && at > until)) continue;
      items.push(...postItems(post));
    }
    return items;
  }
  const automaticItems = source => segmentItems(source, closedFor(source).at(-1)?.until || "", "");
  function renamedItems(album) {
    const before = closedFor(album.source).filter(other => other.until < album.until).at(-1);
    return segmentItems(album.source, before?.until || "", album.until);
  }
  const ownMedia = post => post.byProfileOwner === true && !post.sharedPostId && !post.importSource && post.mediaUrl && post.mediaType === state.kind;
  const knownAlbum = albumId => Boolean(albumId) && state.albums.some(album => album.albumId === albumId);
  const postItems = post => [post.mediaUrl, ...(state.kind === "image" ? post.moreMediaUrls || [] : [])].filter(Boolean).map(mediaUrl => ({ mediaUrl, content: post.content || "", postId: String(post.postId || "") }));
  // The photos (or videos) of posts the member put in this album.
  const postedTo = albumId => (Array.isArray(window.danzstakProfilePosts) ? window.danzstakProfilePosts : []).filter(post => ownMedia(post) && post.albumId === albumId).flatMap(postItems);
  const kindWord = count => plural(count, state.kind === "video" ? "video" : "photo", state.kind === "video" ? "videos" : "photos");
  const automaticName = source => AUTOMATIC[source];

  // ---------- Views: the albums grid, or one album ----------
  // Everything on the tab except the albums grid and an open album: the "All photos" grid and its lines.
  const looseNodes = () => [...state.container.children].filter(child => !child.classList.contains("profile-albums") && !child.classList.contains("profile-album-page"));
  function hideLoose(hidden) { for (const child of looseNodes()) { if (hidden) child.dataset.albumHidden = "1"; else delete child.dataset.albumHidden; } }

  // An album view is one step in the phone's history, so Back returns to the albums grid.
  let viewInHistory = false;
  function enterView() {
    if (viewInHistory) return;
    try { history.pushState({ ...(history.state && typeof history.state === "object" ? history.state : {}), danzstakAlbumView: true }, ""); viewInHistory = true; } catch { viewInHistory = false; }
  }
  function backToAlbums() { if (viewInHistory && history.state?.danzstakAlbumView === true) history.back(); else showAlbums(); }
  addEventListener("popstate", () => { if (viewInHistory && history.state?.danzstakAlbumView !== true) { viewInHistory = false; if (state?.container?.isConnected) showAlbums(); } });

  function renderRow() {
    const { container, kind, albums, isOwner } = state;
    container.querySelector(".profile-albums")?.remove();
    // The empty-grid line is a bare text node; wrap it so a view can hide it like the grid.
    for (const node of [...container.childNodes]) if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) node.replaceWith(el("p", "profile-album-empty", node.textContent));
    const automatic = Object.keys(AUTOMATIC).map(source => ({ source, items: automaticItems(source) })).filter(album => album.items.length);
    // A visitor of a member with no albums at all sees the photos themselves.
    if (!albums.length && !automatic.length && !(state.renamed || []).some(album => renamedItems(album).length) && !isOwner) { hideLoose(false); return false; }
    const section = el("section", "profile-albums"); section.setAttribute("aria-label", "Albums");
    const head = el("div", "profile-albums-head");
    head.append(el("h3", "", "Albums"));
    if (isOwner) {
      const add = el("button", "profile-albums-new", "+ Create album"); add.type = "button";
      add.addEventListener("click", () => editAlbum(null));
      head.append(add);
    }
    const grid = el("div", "profile-albums-grid");
    // "All photos" wears the newest photo (or video) on the tab as its cover.
    const newest = looseNodes().map(child => child.matches?.("img,video") ? child : child.querySelector?.("img,video")).find(Boolean);
    if (newest) grid.append(tile(kind === "image" ? "All photos" : "All videos", "Everything", () => openEverything(), { url: newest.currentSrc || newest.src, mediaType: newest.tagName === "VIDEO" ? "video" : "image" }));
    for (const { source, items } of automatic) grid.append(tile(automaticName(source), kindWord(items.length), () => openAutomatic(source), { url: items[0].mediaUrl, mediaType: kind }));
    for (const album of [...(state.renamed || [])].reverse()) {
      const items = renamedItems(album);
      if (items.length) grid.append(tile(album.name, kindWord(items.length), () => openRenamed(album), { url: items[0].mediaUrl, mediaType: kind }));
    }
    for (const album of albums) {
      const posted = postedTo(album.albumId), count = (kind === "image" ? album.photoCount : album.videoCount) + posted.length;
      const visibility = isOwner && album.visibility !== "public" ? ` · ${VISIBILITY[album.visibility]}` : "";
      grid.append(tile(album.name, `${count ? kindWord(count) : "Empty"}${visibility}`, () => openAlbum(album.albumId), album.cover || (posted[0] ? { url: posted[0].mediaUrl, mediaType: kind } : null)));
    }
    section.append(head, grid);
    container.prepend(section);
    return true;
  }

  // The tab's first view: the albums grid, the loose photos stepped aside.
  function showAlbums() {
    state.container.querySelector(".profile-album-page")?.remove();
    if (renderRow()) hideLoose(true);
  }

  // An album view: "← Albums", the title (and the owner's actions), then its grid.
  function openView(name, sub, { actions = null, items = [], status = null, note = "", empty = "" } = {}) {
    const { container, kind } = state;
    enterView();
    container.querySelector(".profile-album-page")?.remove();
    container.querySelector(".profile-albums")?.setAttribute("data-album-hidden", "1");
    hideLoose(true);
    const page = el("section", "profile-album-page"); page.setAttribute("aria-label", name);
    const back = el("button", "profile-album-back", "← Albums"); back.type = "button"; back.addEventListener("click", backToAlbums);
    const head = el("div", "profile-album-head"), title = el("div", "profile-album-title");
    title.append(el("h3", "", name), el("p", "", sub));
    head.append(title);
    if (actions) head.append(actions);
    page.append(back, head);
    if (status) page.append(status);
    if (items.length && window.danzstakProfileVideos) {
      const grid = window.danzstakProfileVideos.createGrid({ kind });
      for (const item of items) grid.add(item);
      page.append(grid.element);
    } else if (empty) page.append(el("p", "profile-album-empty", empty));
    if (note) page.append(el("p", "profile-album-note", note));
    container.append(page);
    const heading = page.querySelector("h3"); heading.tabIndex = -1; heading.focus?.({ preventScroll: true });
    return page;
  }

  // "All photos": the tab's own grid, everything the page can show.
  function openEverything() {
    const { container, kind } = state, label = kind === "image" ? "All photos" : "All videos";
    enterView();
    container.querySelector(".profile-album-page")?.remove();
    container.querySelector(".profile-albums")?.setAttribute("data-album-hidden", "1");
    hideLoose(false);
    const page = el("section", "profile-album-page profile-album-page--all"); page.setAttribute("aria-label", label);
    const back = el("button", "profile-album-back", "← Albums"); back.type = "button"; back.addEventListener("click", backToAlbums);
    const head = el("div", "profile-album-head"), title = el("div", "profile-album-title");
    title.append(el("h3", "", label));
    head.append(title); page.append(back, head);
    container.prepend(page);
  }

  async function openAlbum(albumId) {
    const { kind, profile } = state;
    let data;
    try { data = await api(`/albums/${encodeURIComponent(albumId)}${memberQuery(profile)}`); }
    catch (error) { say(error.message, true); return; }
    const status = el("p", "profile-album-status"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
    let actions = null, select = null;
    if (data.isOwner) {
      actions = el("div", "profile-album-actions");
      const add = el("button", "primary", kind === "video" ? "Add videos" : "Add photos"); add.type = "button";
      add.addEventListener("click", () => pickFiles(data.album, status));
      const edit = el("button", "", "Edit"); edit.type = "button"; edit.addEventListener("click", () => editAlbum(data.album));
      select = el("button", "", "Select"); select.type = "button";
      actions.append(add, edit, select);
    }
    // The photos of posts the member put in this album, then what they uploaded straight into it.
    const shown = data.items.filter(item => item.mediaType === kind), posted = postedTo(albumId);
    const items = [...posted, ...shown.map(item => ({ mediaUrl: item.url, content: data.album.name, itemId: item.itemId }))];
    const other = data.items.length - shown.length;
    const page = openView(data.album.name, [formatDate(data.album.date), data.album.place, data.isOwner ? VISIBILITY[data.album.visibility] : ""].filter(Boolean).join(" · ") || kindWord(items.length), {
      actions, items, status,
      empty: data.isOwner ? `No ${kind === "video" ? "videos" : "photos"} here yet. Add some, or choose this album when you post.` : `No ${kind === "video" ? "videos" : "photos"} in this album.`,
      note: other ? `${plural(other, kind === "video" ? "photo" : "video", kind === "video" ? "photos" : "videos")} from this album ${other === 1 ? "is" : "are"} on the ${kind === "video" ? "Photos" : "Videos"} tab.` : ""
    });
    page.dataset.albumId = albumId;
    select?.addEventListener("click", () => selectMode(page, { items, album: data.album, status, reopen: () => openAlbum(albumId) }));
  }

  // An automatic album: the same view; the owner can rename it. Its photos come and go with their posts.
  function openAutomatic(source) {
    const items = automaticItems(source);
    let actions = null;
    if (state.isOwner) {
      actions = el("div", "profile-album-actions");
      const rename = el("button", "", "Rename"); rename.type = "button";
      rename.addEventListener("click", () => renameAutomatic({ source }));
      const select = el("button", "", "Select"); select.type = "button";
      select.addEventListener("click", () => selectMode(page, { items, status: page.querySelector(".profile-album-status"), reopen: () => openAutomatic(source) }));
      actions.append(rename, select);
    }
    const status = el("p", "profile-album-status"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
    const page = openView(automaticName(source), kindWord(items.length), {
      actions, items, status,
      note: state.isOwner ? (source === "computer" ? "Photos and videos you post from a computer land here, unless you choose an album. Delete a post to take its photos out." : "Photos and videos you post from your phone land here, unless you choose an album. Delete a post to take its photos out.") : ""
    });
  }

  // A renamed automatic album: the photos posted from that device up to its renaming.
  function openRenamed(album) {
    let actions = null;
    if (state.isOwner) {
      actions = el("div", "profile-album-actions");
      const rename = el("button", "", "Rename"); rename.type = "button";
      rename.addEventListener("click", () => renameAutomatic(album));
      const select = el("button", "", "Select"); select.type = "button";
      select.addEventListener("click", () => selectMode(page, { items, status, reopen: () => openRenamed(album) }));
      actions.append(rename, select);
    }
    const items = renamedItems(album);
    const status = el("p", "profile-album-status"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
    const page = openView(album.name, kindWord(items.length), { actions, items, status });
  }

  // Renaming the open "Mobile uploads" / "Computer uploads" closes it under the new name (the next photo posted without
  // an album starts a fresh one); renaming a closed one only changes its name.
  function renameAutomatic(album) {
    const source = album.source, closed = Boolean(album.id);
    const dialog = el("dialog", "profile-album-dialog"), form = el("form");
    form.method = "dialog";
    const label = el("label", "", "Name"), name = el("input"); name.required = true; name.maxLength = 80; name.value = closed ? album.name : ""; name.placeholder = source === "computer" ? "Studio shots" : "Hellfest 2026";
    label.append(name);
    const error = el("p", "profile-album-error"); error.setAttribute("role", "alert");
    const save = el("button", "primary", "Save"), cancel = el("button", "", "Cancel");
    save.type = "submit"; cancel.type = "button"; cancel.addEventListener("click", () => dialog.close());
    const actions = el("div", "profile-album-dialog-actions"); actions.append(cancel, save);
    const hint = closed ? null : el("p", "profile-album-hint", `The photos in ${AUTOMATIC[source]} move to this name. New ones you post from this ${source === "computer" ? "computer" : "phone"} without choosing an album start a new ${AUTOMATIC[source]}.`);
    form.append(el("h2", "", "Rename album"), label, ...(hint ? [hint] : []), error, actions);
    form.addEventListener("submit", async event => {
      event.preventDefault(); save.disabled = true; error.textContent = "";
      try {
        const data = await api(`/albums/${closed ? album.id : `auto-${source}`}`, { method: "PATCH", body: JSON.stringify({ name: name.value }) });
        const saved = data.renamed;
        state.renamed = [...(state.renamed || []).filter(other => other.id !== saved.id), saved].sort((a, b) => a.until.localeCompare(b.until));
        dialog.close(); openRenamed(saved);
      } catch (err) { error.textContent = err.message; save.disabled = false; }
    });
    dialog.append(form);
    dialog.addEventListener("close", () => dialog.remove());
    document.body.append(dialog);
    dialog.showModal(); name.focus(); name.select();
  }

  // ---------- Media manager: select, move, remove, cover ----------
  // Owner 2026-11-22: "they could go back through it and move those images to the specific album that they should be in",
  // "Need to make a very good media manager to keep all the media straight for the users, they get the choose".
  // The owner taps photos (or videos) in any album, then:
  // - Move to album: a posted photo moves with its post (every photo of that post), to one of their albums, a new album,
  //   or back to Mobile uploads / Computer uploads;
  // - Remove / Make cover: for photos uploaded straight into a named album.
  // items: [{ mediaUrl, postId } | { mediaUrl, itemId }]; album: the named album open, or null.
  function selectMode(page, { items, album = null, status, reopen }) {
    const { kind } = state, chosen = new Set();
    page.querySelector(".profile-video-grid, .profile-album-select, .profile-album-bar")?.remove();
    page.querySelector(".profile-album-bar")?.remove();
    const grid = el("div", "profile-album-select"); grid.setAttribute("role", "group"); grid.setAttribute("aria-label", "Select photos and videos");
    const bar = el("div", "profile-album-bar");
    const move = el("button", "primary", "Move to album"), remove = el("button", "danger", "Remove"), cover = el("button", "", "Make cover"), done = el("button", "", "Done");
    move.type = remove.type = cover.type = done.type = "button";
    const picked = () => items.filter((item, index) => chosen.has(index));
    const update = () => {
      const list = picked(), posts = new Set(list.map(item => item.postId).filter(Boolean));
      move.disabled = !list.length || list.some(item => !item.postId);
      move.textContent = list.length && !move.disabled ? `Move ${plural(list.length, kind === "video" ? "video" : "photo", kind === "video" ? "videos" : "photos")}` : "Move to album";
      move.title = posts.size && list.length < items.filter(item => posts.has(item.postId)).length ? "A post's photos move together." : "";
      remove.disabled = !list.length || list.some(item => !item.itemId);
      remove.textContent = list.length && !remove.disabled ? `Remove ${list.length}` : "Remove";
      cover.disabled = list.length !== 1 || !list[0].itemId;
    };
    items.forEach((item, index) => {
      const pick = el("button", "profile-album-pick"); pick.type = "button"; pick.setAttribute("aria-pressed", "false");
      pick.setAttribute("aria-label", `${kind === "video" ? "Video" : "Photo"} ${index + 1}`);
      const media = document.createElement(kind === "video" ? "video" : "img");
      media.src = item.mediaUrl; if (media.tagName === "VIDEO") { media.muted = true; media.playsInline = true; media.preload = "metadata"; } else { media.alt = ""; media.loading = "lazy"; }
      pick.append(media);
      pick.addEventListener("click", () => {
        // A posted photo is picked with the rest of its post, since they move together.
        const group = item.postId ? items.map((other, at) => other.postId === item.postId ? at : -1).filter(at => at >= 0) : [index];
        const on = !chosen.has(index);
        for (const at of group) { if (on) chosen.add(at); else chosen.delete(at); grid.children[at]?.setAttribute("aria-pressed", String(on)); }
        update();
      });
      grid.append(pick);
    });
    move.addEventListener("click", async () => {
      const target = await chooseAlbum(album?.albumId || "");
      if (target === null) return;
      const postIds = [...new Set(picked().map(item => item.postId))];
      move.disabled = true; status.textContent = "Moving…";
      let failed = 0;
      for (const postId of postIds) {
        try {
          await api(`/secure-posts/${encodeURIComponent(postId)}`, { method: "PATCH", body: JSON.stringify({ albumId: target.albumId }) });
          for (const post of window.danzstakProfilePosts || []) if (String(post.postId) === postId) post.albumId = target.albumId;
        } catch { failed += 1; }
      }
      say(failed ? `${failed} could not be moved. Try again.` : `Moved to ${target.name}.`, Boolean(failed));
      await refreshAlbums();
      if (target.albumId) await openAlbum(target.albumId); else showAlbums();
    });
    remove.addEventListener("click", async () => {
      const list = picked();
      const ok = window.danzstakConfirm ? await window.danzstakConfirm(`Remove ${plural(list.length, "item", "items")} from this album and from DanzStak? Screenshots and downloads made outside DanzStak can't be recalled.`, { title: "Remove from album?", confirmLabel: "Remove", danger: true }) : window.confirm("Remove the selected items?");
      if (!ok) return;
      remove.disabled = true; status.textContent = "Removing…";
      let failed = 0;
      for (const item of list) { try { await api(`/albums/${album.albumId}/items/${item.itemId}`, { method: "DELETE" }); } catch { failed += 1; } }
      status.textContent = failed ? `${failed} could not be removed. Try again.` : "Removed.";
      await refreshAlbums(); await openAlbum(album.albumId);
    });
    cover.addEventListener("click", async () => {
      try { await api(`/albums/${album.albumId}`, { method: "PATCH", body: JSON.stringify({ coverItemId: picked()[0].itemId }) }); say("Cover updated."); await refreshAlbums(); await openAlbum(album.albumId); }
      catch (error) { say(error.message, true); }
    });
    done.addEventListener("click", () => reopen());
    bar.append(move, ...(album ? [remove, cover] : []), done); update();
    page.querySelector(".profile-album-empty")?.remove();
    page.querySelector(".profile-album-note")?.remove();
    page.append(grid, bar);
  }

  // Where to move: one of the member's albums, a new one, or back to the automatic album. Resolves { albumId, name }
  // ("" = Mobile uploads / Computer uploads) or null when cancelled.
  function chooseAlbum(currentId) {
    return new Promise(resolve => {
      let result = null;
      const dialog = el("dialog", "profile-album-dialog profile-album-move"), form = el("form");
      form.method = "dialog";
      const list = el("div", "profile-album-choices"); list.setAttribute("role", "radiogroup"); list.setAttribute("aria-label", "Albums");
      const options = [
        ...state.albums.filter(album => album.albumId !== currentId).map(album => ({ value: album.albumId, label: album.name })),
        ...(currentId ? [{ value: "", label: `${AUTOMATIC.mobile} / ${AUTOMATIC.computer}` }] : []),
        { value: "new", label: "+ New album" }
      ];
      const name = el("input"); name.maxLength = 80; name.placeholder = "Album name"; name.hidden = true; name.setAttribute("aria-label", "New album name");
      options.forEach((option, index) => {
        const row = el("label", "profile-album-choice"), radio = el("input");
        radio.type = "radio"; radio.name = "album"; radio.value = option.value; radio.checked = index === 0;
        radio.addEventListener("change", () => { name.hidden = option.value !== "new"; if (!name.hidden) name.focus(); });
        row.append(radio, el("span", "", option.label));
        list.append(row);
      });
      name.hidden = options[0].value !== "new";
      const error = el("p", "profile-album-error"); error.setAttribute("role", "alert");
      const save = el("button", "primary", "Move"), cancel = el("button", "", "Cancel");
      save.type = "submit"; cancel.type = "button"; cancel.addEventListener("click", () => dialog.close());
      const actions = el("div", "profile-album-dialog-actions"); actions.append(cancel, save);
      form.append(el("h2", "", "Move to album"), list, name, error, actions);
      form.addEventListener("submit", async event => {
        event.preventDefault();
        const value = form.querySelector("input[name=album]:checked")?.value ?? "";
        if (value !== "new") { const option = options.find(item => item.value === value); result = { albumId: value, name: value ? option.label : AUTOMATIC.mobile }; dialog.close(); return; }
        if (!name.value.trim()) { error.textContent = "Give the album a name."; name.focus(); return; }
        save.disabled = true;
        try { const data = await api("/albums", { method: "POST", body: JSON.stringify({ name: name.value, date: "", place: "", visibility: "friends" }) }); result = { albumId: data.album.albumId, name: data.album.name }; dialog.close(); }
        catch (err) { error.textContent = err.message; save.disabled = false; }
      });
      dialog.append(form);
      dialog.addEventListener("close", () => { dialog.remove(); resolve(result); });
      document.body.append(dialog);
      dialog.showModal();
    });
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
        try { await api(`/albums/${album.albumId}`, { method: "DELETE" }); dialog.close(); say("Album deleted."); await refreshAlbums(); backToAlbums(); }
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
    try { const data = await api(`/albums?kind=${state.kind}${memberQuery(state.profile, "&")}`); state.albums = data.albums || []; state.isOwner = data.isOwner === true; state.renamed = Array.isArray(data.renamed) ? data.renamed : []; }
    catch { /* keep what is shown */ }
  }

  window.addEventListener("danzstak:profile-media-tab", async event => {
    const { mediaType, container } = event.detail || {};
    if (!container || !["image", "video"].includes(mediaType)) return;
    state = { kind: mediaType, container, profile: window.danzstakCurrentProfile || {}, albums: [], isOwner: window.danzstakCurrentProfile?.isOwner === true, renamed: [] };
    // The automatic albums need no server: show the albums at once, then again with the member's own albums.
    viewInHistory = false;
    showAlbums();
    await refreshAlbums();
    if (state.container === container && container.isConnected && !container.querySelector(".profile-album-page")) showAlbums();
  });
  window.DanzStakProfileAlbums = { countLine, formatDate }; // read by tests
})();
