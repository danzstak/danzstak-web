"use strict";
// Directive F1a (owner 2026-11-19: "the comments, likes and things should be on the right hand side in full screen…
// DanzStak video should open similar, with the text box below"; "just like TikTok, just like Facebook… DanzStak should be
// the same"). One component for every full-screen video: the media viewer (media-viewer.js), The Roll and Dailies.
// - A slim rail on the right edge, above the sound toggle: the author's round avatar (opens their profile; the small
//   Follow "+" joins it with F18), Like, Comment, Save and Share, white icons with a soft shadow and the count under each.
// - The author's name and the caption sit bottom-left over a soft gradient.
// - Comment: the full-screen layer keeps only its top ~40% for the video (the same element keeps playing with the same
//   sound choice) and a comments sheet slides up below it: Newest / Oldest (chronological only, never ranked), rows with
//   a 40px avatar, name · time, the text, Reply and like/dislike with counts, "View N replies" folded under each
//   comment, and a fixed "Comment as {name}" box with your own photo, above the keyboard.
// - Swipe the sheet down, tap the video, ✕, Esc or system Back: the sheet closes and the video fills the screen again.
// Hosts: mount(host, { postId, … }) puts the rail in a positioned element; the comments open over `layer`, the
// full-screen element (its CSS in media-actions.css decides how the video area shrinks).
(() => {
  if (globalThis.danzstakMediaActions) return;
  const API = "https://api.danzstak.com", PREFERENCES_KEY = "danzstak-post-preferences"; // the same store as Mix's Save
  const t = (text, values = {}) => (globalThis.danzstakTranslate?.(text) || text).replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
  const icon = name => globalThis.danzstakIcons?.create?.(name) || document.createElement("span");
  // Buttons keep the icon and words drawn here: icon-buttons.js would otherwise swap "Save" or "Reply" for a bare icon.
  const node = (tag, className, text) => { const element = document.createElement(tag); if (className) element.className = className; if (text !== undefined) element.textContent = text; if (tag === "button") element.dataset.iconLayout = "label"; return element; };
  const compact = value => { const n = Number(value || 0); return n >= 1e6 ? `${(n / 1e6).toFixed(n < 1e7 ? 1 : 0).replace(/\.0$/, "")}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K` : String(n); };
  const positive = counts => Object.entries(counts || {}).filter(([kind]) => kind !== "Dislike").reduce((sum, [, count]) => sum + Number(count || 0), 0);
  const profileHref = (memberId, own) => own ? "profile.html" : memberId ? `profile.html?member=${encodeURIComponent(memberId)}` : "";
  const feedback = message => globalThis.danzstakShowFeedback?.(t(message), { urgent: true, timeout: 4000 });

  async function request(path, options = {}) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000);
    try { return await fetch(API + path, { credentials: "include", cache: "no-store", ...options, signal: controller.signal }); }
    finally { clearTimeout(timer); }
  }
  const sendJson = (path, body, method = "POST") => request(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  // The page's own post lists know the author's photo and the caption (Mix, the profile, The Roll's source posts).
  function postData(post) {
    const id = String(post.postId || "");
    const lists = [globalThis.danzstakMixPosts, globalThis.danzstakProfilePosts, globalThis.danzstakLoadedPosts].filter(Array.isArray);
    const found = lists.flat().find(item => String(item?.postId || "") === id) || {};
    return { ...found, ...Object.fromEntries(Object.entries(post).filter(([, value]) => value !== undefined && value !== "")), postId: id };
  }

  let me = null;
  const viewer = () => me ||= request("/profiles").then(response => response.ok ? response.json() : {}).then(data => data.profile || {}).catch(() => ({}));

  // ---------------------------------------------------------------- engagement, one cache for rail and sheet
  const cache = new Map(), listeners = new Map();
  function engagement(postId, { fresh = false } = {}) {
    if (!fresh && cache.has(postId)) return cache.get(postId);
    const load = request(`/engagement?postId=${encodeURIComponent(postId)}`)
      .then(async response => { if (!response.ok) throw new Error("load"); return response.json(); })
      .then(data => ({ reactionCounts: data.reactionCounts || {}, myReaction: data.myReaction || "", comments: Array.isArray(data.comments) ? data.comments : [] }));
    cache.set(postId, load);
    load.then(data => (listeners.get(postId) || new Set()).forEach(listener => listener(data))).catch(() => cache.delete(postId));
    return load;
  }
  const watch = (postId, listener) => { const set = listeners.get(postId) || new Set(); set.add(listener); listeners.set(postId, set); return () => set.delete(listener); };
  const refresh = postId => engagement(postId, { fresh: true });

  // ---------------------------------------------------------------- save (the same preference and store as Mix's Save)
  function isSaved(postId) { try { return JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "{}")[postId]?.saved === true; } catch { return false; } }
  async function setSaved(postId, saved) {
    const response = await sendJson("/settings/posts", { postId, preference: "saved", enabled: saved }).catch(() => null);
    if (!response?.ok) throw new Error("save");
    try { const all = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "{}"); all[postId] = { ...(all[postId] || {}), saved }; localStorage.setItem(PREFERENCES_KEY, JSON.stringify(all)); } catch {}
    window.dispatchEvent(new CustomEvent("danzstak:post-saved", { detail: { postId, saved } })); // Mix repaints its own Save
  }

  // ---------------------------------------------------------------- share
  async function share(post) {
    const drawn = document.querySelector(`.post[data-post-id="${CSS.escape(post.postId)}"]`);
    if (drawn && typeof globalThis.danzstakSharePost === "function") { globalThis.danzstakSharePost(drawn); return; }
    if ((post.audience || "public") !== "public") { feedback("Only Public posts can be shared outside DanzStak."); return; }
    const url = new URL(`feed.html#post-${encodeURIComponent(post.postId)}`, location.href).href;
    if (navigator.share) { try { await navigator.share({ title: "DanzStak", text: String(post.content || "").slice(0, 200), url }); return; } catch (error) { if (error?.name === "AbortError") return; } }
    try { await navigator.clipboard.writeText(url); globalThis.danzstakShowFeedback?.(t("Link copied. Paste it wherever you want to share."), { timeout: 3000 }); }
    catch { feedback("This link could not be copied. Try again."); }
  }

  // ---------------------------------------------------------------- the rail
  function railButton(className, iconName, label) {
    const button = node("button", `ds-ma-action ${className}`);
    button.type = "button";
    button.setAttribute("aria-label", t(label));
    const count = node("span", "ds-ma-count");
    button.append(icon(iconName), count);
    return { button, count };
  }

  const mounted = new WeakMap();
  function mount(host, input, { layer = host } = {}) {
    if (!host || !input?.postId) return null;
    mounted.get(host)?.destroy();
    const post = postData(input);
    const own = post.isOwner === true;
    const memberId = String(post.authorMemberId || post.userId || post.memberId || "");
    const name = String(post.authorName || post.displayName || "").trim() || t("DanzStak member");
    const root = node("div", "ds-ma");
    const rail = node("div", "ds-ma-rail");
    const author = node(memberId || own ? "a" : "span", "ds-ma-author");
    if (author.tagName === "A") { author.href = profileHref(memberId, own); author.setAttribute("aria-label", t("Open {name} profile", { name })); }
    if (post.authorPicture) { const image = node("img"); image.alt = ""; image.src = post.authorPicture; image.referrerPolicy = "no-referrer"; globalThis.danzstakIdentityMedia?.install?.(image, { memberId, name }); author.append(image); }
    else author.textContent = name.charAt(0).toUpperCase();
    const like = railButton("ds-ma-like", "thumbs-up", "Like");
    const comment = railButton("ds-ma-comment", "chat", "Comments");
    const save = railButton("ds-ma-save", "bookmark", "Save");
    const shareAction = railButton("ds-ma-share", "share", "Share");
    save.count.textContent = t("Save"); shareAction.count.textContent = t("Share");
    rail.append(author, like.button, comment.button, save.button, shareAction.button);
    const caption = node("div", "ds-ma-caption");
    const who = node(author.tagName === "A" ? "a" : "strong", "ds-ma-name", name);
    if (who.tagName === "A") who.href = author.href;
    caption.append(who);
    const text = String(post.content || "").trim();
    if (text && text !== "Story") caption.append(node("p", "ds-ma-text", text));
    root.append(caption, rail);
    host.append(root);

    let state = { reactionCounts: {}, myReaction: "", comments: [] };
    const paint = data => {
      state = data;
      const liked = Boolean(data.myReaction) && data.myReaction !== "Dislike";
      like.button.setAttribute("aria-pressed", String(liked));
      like.count.textContent = compact(positive(data.reactionCounts));
      like.button.setAttribute("aria-label", `${t(liked ? "Remove like" : "Like")} (${positive(data.reactionCounts)})`);
      comment.count.textContent = compact(data.comments.length);
      comment.button.setAttribute("aria-label", `${t("Comments")} (${data.comments.length})`);
    };
    const paintSave = saved => { save.button.setAttribute("aria-pressed", String(saved)); save.count.textContent = t(saved ? "Saved" : "Save"); save.button.setAttribute("aria-label", t(saved ? "Remove post from Saved" : "Save post")); };
    paint(state); paintSave(isSaved(post.postId));
    const unwatch = watch(post.postId, paint);
    engagement(post.postId).catch(() => {});

    like.button.addEventListener("click", async () => {
      const liked = like.button.getAttribute("aria-pressed") === "true", before = state;
      const counts = { ...state.reactionCounts }; counts.Like = Math.max(0, Number(counts.Like || 0) + (liked ? -1 : 1));
      paint({ ...state, reactionCounts: counts, myReaction: liked ? "" : "Like" });
      const response = await sendJson("/reactions", { postId: post.postId, reaction: liked ? "" : "Like" }).catch(() => null);
      if (!response?.ok) { paint(before); feedback("Reaction could not be saved"); return; }
      refresh(post.postId).catch(() => {});
    });
    comment.button.addEventListener("click", () => openComments({ post, layer, host }));
    save.button.addEventListener("click", async () => {
      const saved = save.button.getAttribute("aria-pressed") === "true";
      paintSave(!saved);
      try { await setSaved(post.postId, !saved); } catch { paintSave(saved); feedback("This post preference could not be saved. Please try again."); }
    });
    shareAction.button.addEventListener("click", () => void share(post));
    host.classList.add("ds-ma-host");
    const controller = { element: root, destroy: () => { unwatch(); root.remove(); host.classList.remove("ds-ma-host"); mounted.delete(host); } };
    mounted.set(host, controller);
    return controller;
  }

  // ---------------------------------------------------------------- the comments sheet
  let sheet = null;
  function closeComments({ fromHistory = false } = {}) {
    const open = sheet; if (!open) return;
    if (!fromHistory && open.history && history.state?.danzstakComments === true) { history.back(); return; }
    sheet = null;
    open.unwatch();
    open.layer.classList.remove("ds-commenting");
    window.dispatchEvent(new CustomEvent("danzstak:comments", { detail: { open: false, layer: open.layer, host: open.host } }));
    open.element.classList.remove("is-open");
    const done = () => open.element.remove();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) done(); else setTimeout(done, 220);
    globalThis.visualViewport?.removeEventListener("resize", open.fitKeyboard);
    open.opener?.focus?.({ preventScroll: true });
  }
  addEventListener("popstate", () => { if (sheet && history.state?.danzstakComments !== true) closeComments({ fromHistory: true }); });

  function openComments({ post, layer, host = layer }) {
    if (sheet) closeComments({ fromHistory: true });
    const opener = document.activeElement;
    const element = node("section", "ds-comment-sheet");
    element.setAttribute("role", "dialog");
    element.setAttribute("aria-label", t("Comments"));
    const handle = node("div", "ds-cs-handle"); handle.setAttribute("aria-hidden", "true");
    const head = node("header", "ds-cs-head");
    const title = node("h2", "ds-cs-title", t("Comments"));
    const sort = node("button", "ds-cs-sort"); sort.type = "button";
    const close = node("button", "ds-cs-close"); close.type = "button"; close.setAttribute("aria-label", t("Close comments")); close.append(icon("close"));
    head.append(title, sort, close);
    const list = node("ol", "ds-cs-list");
    const status = node("p", "ds-cs-status"); status.setAttribute("role", "status");
    const form = node("form", "ds-cs-composer");
    const replying = node("p", "ds-cs-replying"); replying.hidden = true;
    const replyingText = node("span"), cancelReply = node("button", "ds-cs-cancel-reply"); cancelReply.type = "button"; cancelReply.setAttribute("aria-label", t("Cancel reply")); cancelReply.append(icon("close"));
    replying.append(replyingText, cancelReply);
    const mine = node("span", "ds-cs-me"); mine.setAttribute("aria-hidden", "true");
    const input = node("input", "ds-cs-input"); input.type = "text"; input.maxLength = 2000; input.enterKeyHint = "send"; input.autocomplete = "off";
    input.placeholder = t("Write a comment…"); input.setAttribute("aria-label", t("Write a comment…"));
    const send = node("button", "ds-cs-send"); send.type = "submit"; send.setAttribute("aria-label", t("Post comment")); send.append(icon("send")); send.disabled = true;
    form.append(mine, input, send);
    element.append(handle, head, status, list, replying, form);
    layer.append(element);
    layer.classList.add("ds-commenting");
    window.dispatchEvent(new CustomEvent("danzstak:comments", { detail: { open: true, layer, host } })); // The Roll re-snaps its card
    requestAnimationFrame(() => element.classList.add("is-open"));

    let order = "newest", replyTo = null, data = null;
    const expanded = new Set();
    const paintSort = () => { sort.textContent = t(order === "newest" ? "Newest ▾" : "Oldest ▾"); sort.setAttribute("aria-label", t(order === "newest" ? "Comment order: newest first. Activate for oldest first." : "Comment order: oldest first. Activate for newest first.")); };
    paintSort();
    viewer().then(profile => {
      const name = String(profile.name || "").trim();
      if (name) { input.placeholder = t("Comment as {name}", { name }); input.setAttribute("aria-label", input.placeholder); }
      if (profile.picture) { const image = node("img"); image.alt = ""; image.src = profile.picture; image.referrerPolicy = "no-referrer"; mine.replaceChildren(image); }
      else mine.textContent = name.charAt(0).toUpperCase();
    });

    const row = (comment, replies) => {
      const item = node("li", "ds-cs-row");
      item.dataset.commentId = comment.commentId;
      const memberId = String(comment.authorMemberId || ""), own = comment.isOwner === true, name = comment.authorName || t("DanzStak member");
      const avatar = node(memberId ? "a" : "span", "ds-cs-avatar");
      if (memberId) { avatar.href = profileHref(memberId, own); avatar.setAttribute("aria-label", t("Open {name} profile", { name })); }
      if (comment.authorPicture) { const image = node("img"); image.alt = ""; image.src = comment.authorPicture; image.referrerPolicy = "no-referrer"; globalThis.danzstakIdentityMedia?.install?.(image, { memberId, name }); avatar.append(image); }
      else avatar.textContent = name.charAt(0).toUpperCase();
      const body = node("div", "ds-cs-body");
      const meta = node("p", "ds-cs-meta");
      const who = node(memberId ? "a" : "strong", "ds-cs-name", name); if (memberId) who.href = avatar.href;
      const time = node("time", "ds-cs-time");
      const label = globalThis.danzstakTimeLabel?.label?.(comment.createdAt);
      if (label) { time.textContent = label.text; time.dateTime = label.iso; time.title = label.title; }
      meta.append(who, document.createTextNode(" · "), time);
      const text = node("p", "ds-cs-text", comment.content);
      const actions = node("div", "ds-cs-actions");
      const reply = node("button", "ds-cs-reply", t("Reply")); reply.type = "button"; reply.setAttribute("aria-label", t("Reply to {name}", { name }));
      reply.addEventListener("click", () => { replyTo = comment; replyingText.textContent = t("Replying to {name}", { name }); replying.hidden = false; input.focus(); });
      actions.append(reply);
      const counts = comment.reactionCounts || {};
      for (const [kind, iconName, labelText] of [["Like", "thumbs-up", "Like comment"], ["Dislike", "thumbs-down", "Dislike comment"]]) {
        const button = node("button", `ds-cs-react ds-cs-${kind.toLowerCase()}`); button.type = "button";
        const pressed = comment.myReaction === kind || (kind === "Like" && comment.myReaction && comment.myReaction !== "Dislike");
        button.setAttribute("aria-pressed", String(Boolean(pressed)));
        const count = kind === "Like" ? positive(counts) : Number(counts.Dislike || 0);
        button.setAttribute("aria-label", `${t(labelText)} (${count})`);
        button.append(icon(iconName), node("span", "", count ? compact(count) : ""));
        button.addEventListener("click", async () => {
          button.disabled = true;
          const response = await sendJson("/reactions", { postId: post.postId, commentId: comment.commentId, reaction: pressed ? "" : kind }).catch(() => null);
          if (!response?.ok) { button.disabled = false; feedback("Reaction could not be saved"); return; }
          await reload();
        });
        actions.append(button);
      }
      if (comment.canDelete === true) {
        const remove = node("button", "ds-cs-delete"); remove.type = "button"; remove.setAttribute("aria-label", t("Delete comment")); remove.append(icon("trash"));
        remove.addEventListener("click", async () => {
          if (!(await globalThis.danzstakConfirm?.(t("This comment will be permanently removed."), { title: t("Delete this comment?"), confirmLabel: t("Delete comment"), danger: true }) ?? confirm(t("Delete this comment?")))) return;
          remove.disabled = true;
          const response = await request(`/comments/${encodeURIComponent(comment.commentId)}?postId=${encodeURIComponent(post.postId)}`, { method: "DELETE" }).catch(() => null);
          if (!response?.ok) { remove.disabled = false; feedback("Comment could not be deleted."); return; }
          await reload();
        });
        actions.append(remove);
      }
      body.append(meta, text, actions);
      if (replies?.length) {
        const more = node("button", "ds-cs-more"); more.type = "button";
        const nested = node("ol", "ds-cs-replies");
        const paintMore = () => { const open = expanded.has(comment.commentId); nested.hidden = !open; more.setAttribute("aria-expanded", String(open)); more.textContent = open ? t("Hide replies") : replies.length === 1 ? t("View 1 reply") : t("View {count} replies", { count: replies.length }); };
        more.addEventListener("click", () => { if (expanded.has(comment.commentId)) expanded.delete(comment.commentId); else expanded.add(comment.commentId); paintMore(); });
        for (const child of replies) nested.append(row(child));
        paintMore();
        body.append(more, nested);
      }
      item.append(avatar, body);
      return item;
    };

    const render = () => {
      if (!data) return;
      const byId = new Map(data.comments.map(comment => [comment.commentId, comment]));
      const rootOf = comment => { let current = comment, seen = 0; while (current.parentCommentId && byId.has(current.parentCommentId) && seen++ < 50) current = byId.get(current.parentCommentId); return current; };
      const roots = [], replies = new Map();
      for (const comment of data.comments) {
        const top = rootOf(comment);
        if (top === comment) roots.push(comment);
        else { const list = replies.get(top.commentId) || []; list.push(comment); replies.set(top.commentId, list); }
      }
      const time = comment => Date.parse(comment.createdAt || "") || 0;
      roots.sort((a, b) => order === "newest" ? time(b) - time(a) : time(a) - time(b)); // chronological only, never ranked
      replies.forEach(list => list.sort((a, b) => time(a) - time(b)));
      title.textContent = data.comments.length ? `${t("Comments")} · ${compact(data.comments.length)}` : t("Comments");
      list.replaceChildren(...roots.map(comment => row(comment, replies.get(comment.commentId))));
      status.textContent = roots.length ? "" : t("No comments yet. Start the conversation.");
    };
    const reload = async () => {
      try { data = await refresh(post.postId); render(); }
      catch { status.textContent = t("Comments could not load. Try again."); }
    };
    const unwatch = watch(post.postId, next => { data = next; render(); });
    status.textContent = t("Loading comments…");
    engagement(post.postId).then(next => { data = next; render(); }).catch(() => { status.textContent = t("Comments could not load. Try again."); });

    sort.addEventListener("click", () => { order = order === "newest" ? "oldest" : "newest"; paintSort(); render(); list.scrollTop = 0; });
    close.addEventListener("click", () => closeComments());
    cancelReply.addEventListener("click", () => { replyTo = null; replying.hidden = true; input.focus(); });
    input.addEventListener("input", () => { send.disabled = !input.value.trim(); });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const content = input.value.trim(); if (!content) return;
      input.disabled = send.disabled = true;
      const parentCommentId = replyTo?.commentId || "";
      const response = await sendJson("/comments", { postId: post.postId, content, ...(parentCommentId ? { parentCommentId } : {}) }).catch(() => null);
      const result = await response?.json?.().catch(() => ({})) || {};
      input.disabled = false;
      if (!response?.ok) { send.disabled = false; feedback(result.error || "Comment could not be saved"); input.focus(); return; }
      input.value = ""; replyTo = null; replying.hidden = true;
      if (parentCommentId) expanded.add(rootIdOf(parentCommentId));
      await reload();
      input.focus();
    });
    const rootIdOf = id => { const byId = new Map((data?.comments || []).map(comment => [comment.commentId, comment])); let current = byId.get(id); let seen = 0; while (current?.parentCommentId && byId.has(current.parentCommentId) && seen++ < 50) current = byId.get(current.parentCommentId); return current?.commentId || id; };
    // The sheet's own keys, taps and scrolls stay in the sheet: the full-screen player behind it swipes, pauses and steps
    // on these (arrow keys in the box would change video, a swipe in the list would change Daily).
    element.addEventListener("keydown", event => { event.stopPropagation(); if (event.key === "Escape") { event.preventDefault(); closeComments(); } });
    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "click", "wheel", "touchstart", "touchmove", "touchend"]) element.addEventListener(type, event => event.stopPropagation(), { passive: true });

    // Swipe the sheet down to close it: from its handle or header (no native panning there), or with a finger from the
    // list when it is already scrolled to the top (otherwise the list just scrolls).
    const follow = dy => { element.style.transition = "none"; element.style.transform = `translate3d(0,${dy}px,0)`; };
    const release = (dy, started) => {
      element.style.transition = ""; element.style.transform = "";
      if (dy > 90 || (dy > 30 && dy / Math.max(1, performance.now() - started) > .5)) closeComments();
    };
    let drag = null;
    element.addEventListener("pointerdown", event => {
      if (!event.target.closest(".ds-cs-handle,.ds-cs-head") || event.target.closest("button")) return;
      drag = { id: event.pointerId, y: event.clientY, t: performance.now(), dy: 0 };
    });
    element.addEventListener("pointermove", event => {
      if (!drag || drag.id !== event.pointerId) return;
      drag.dy = Math.max(0, event.clientY - drag.y);
      if (drag.dy > 6) follow(drag.dy);
    });
    const endDrag = event => { if (!drag || drag.id !== event.pointerId) return; const { dy, t: started } = drag; drag = null; release(dy, started); };
    element.addEventListener("pointerup", endDrag);
    element.addEventListener("pointercancel", endDrag);
    let pull = null;
    list.addEventListener("touchstart", event => { pull = list.scrollTop <= 0 && event.touches.length === 1 ? { y: event.touches[0].clientY, t: performance.now(), dy: 0 } : null; }, { passive: true });
    list.addEventListener("touchmove", event => {
      if (!pull) return;
      const dy = event.touches[0].clientY - pull.y;
      if (dy <= 0 && !pull.dy) { pull = null; return; } // a swipe up scrolls the list
      event.preventDefault();
      pull.dy = Math.max(0, dy); follow(pull.dy);
    }, { passive: false });
    list.addEventListener("touchend", () => { if (!pull) return; const { dy, t: started } = pull; pull = null; release(dy, started); });
    list.addEventListener("touchcancel", () => { pull = null; release(0, 0); });
    // Tap the video (the layer above the sheet) to close.
    const tapVideo = event => { if (sheet?.element === element && !element.contains(event.target)) { event.preventDefault(); event.stopPropagation(); closeComments(); } };
    layer.addEventListener("pointerdown", tapVideo, true);

    // Keep the box above the phone's keyboard.
    const fitKeyboard = () => {
      const view = globalThis.visualViewport; if (!view) return;
      const covered = Math.max(0, innerHeight - view.height - view.offsetTop);
      element.style.setProperty("--ds-keyboard", `${covered}px`);
    };
    globalThis.visualViewport?.addEventListener("resize", fitKeyboard);

    let pushed = false;
    try { history.pushState({ ...(history.state || {}), danzstakComments: true }, ""); pushed = true; } catch {}
    sheet = { element, layer, host, opener, history: pushed, fitKeyboard, unwatch: () => { unwatch(); layer.removeEventListener("pointerdown", tapVideo, true); } };
    close.focus({ preventScroll: true });
    return sheet;
  }

  globalThis.danzstakMediaActions = Object.freeze({ mount, openComments, closeComments, isCommenting: () => Boolean(sheet) });
})();
