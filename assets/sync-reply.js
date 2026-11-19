"use strict";
// SYNC reply and forward (task 16-E). Reply quotes the original and a tap on the quote jumps to it (loading earlier pages,
// finitely, when needed). Swipe right on a message to reply (touch). Forward a text message to up to 5 chats. The server
// stores only the replied-to id and resolves the quote at read time, so a message deleted for everyone also disappears
// from every quote; forwarded copies are removed with the original (CLAUDE.md delete rules).
(() => {
  const API = "https://api.danzstak.com", MAX_FORWARD = 5;
  const t = value => window.danzstakTranslate?.(value) || value;
  const tf = (key, values) => Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), t(key));
  let replying = null; // { contact, messageId, name, snippet }
  const contactNow = () => String(document.getElementById("contactEmail")?.value || "").trim().toLowerCase();
  const snippetOf = message => String(message.content || (message.mediaType === "video" ? t("Video") : message.mediaType ? t("Photo") : "")).slice(0, 120);

  function bar() {
    let el = document.getElementById("messageReplyBar");
    if (el) return el;
    const form = document.getElementById("messageForm");
    if (!form) return null;
    el = document.createElement("div");
    el.id = "messageReplyBar"; el.className = "message-reply-bar"; el.hidden = true;
    el.innerHTML = '<span class="message-reply-bar-text"><strong></strong><small></small></span><button type="button" class="message-reply-cancel" data-icon="close"></button>';
    el.querySelector("button").addEventListener("click", () => { clear(); document.getElementById("messageInput")?.focus(); });
    form.insertBefore(el, form.firstChild);
    window.danzstakIcons?.enhance?.(el);
    return el;
  }
  function start(message, { me = "", contactName = "" } = {}) {
    const contact = contactNow();
    if (!contact || !message?.messageId) return;
    replying = { contact, messageId: message.messageId, name: message.senderEmail === me ? t("You") : contactName || t("DanzStak member"), snippet: snippetOf(message) };
    const el = bar(); if (!el) return;
    el.querySelector("strong").textContent = tf("Replying to {name}", { name: replying.name });
    el.querySelector("small").textContent = replying.snippet;
    el.querySelector("button").setAttribute("aria-label", t("Cancel reply"));
    el.hidden = false;
    navigator.vibrate?.(10);
    document.getElementById("messageInput")?.focus();
  }
  function clear() { replying = null; const el = document.getElementById("messageReplyBar"); if (el) el.hidden = true; }
  const idFor = contact => replying && replying.contact === String(contact || "").toLowerCase() ? replying.messageId : "";

  async function jumpTo(messageId) {
    const list = document.getElementById("messageList");
    const find = () => [...(list?.querySelectorAll(".message") || [])].find(el => el.dataset.messageId === messageId);
    let target = find();
    for (let page = 0; !target && page < 5 && typeof loadEarlierMessages === "function" && list?.querySelector(".load-earlier-messages, [data-load-earlier]"); page++) { await loadEarlierMessages(); target = find(); }
    if (!target) { const status = document.getElementById("callStatus"); if (status) status.textContent = t("That message is further back than SYNC keeps loaded."); return false; }
    target.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    target.classList.add("is-jump-target"); setTimeout(() => target.classList.remove("is-jump-target"), 1600);
    target.focus({ preventScroll: true });
    return true;
  }

  // Adds the quote, the "Forwarded" label and swipe-to-reply to a rendered bubble.
  function decorate(item, message, context = {}) {
    if (message.forwarded) {
      const label = document.createElement("span"); label.className = "message-forwarded"; label.textContent = "↪ " + t("Forwarded");
      item.prepend(label);
    }
    if (message.replyTo?.messageId) {
      const quote = document.createElement("button"); quote.type = "button"; quote.className = "message-quote";
      const who = document.createElement("strong"); who.textContent = message.replyTo.senderEmail === context.me ? t("You") : context.contactName || t("DanzStak member");
      const text = document.createElement("span"); text.textContent = message.replyTo.snippet || "";
      quote.append(who, text);
      quote.setAttribute("aria-label", tf("Reply to {name}: {text}. Show the original message.", { name: who.textContent, text: text.textContent }));
      quote.addEventListener("click", event => { event.stopPropagation(); jumpTo(message.replyTo.messageId); });
      item.insertBefore(quote, item.querySelector(".message-text, .message-media, img, video") || item.firstChild?.nextSibling || null);
    }
    // Swipe right to reply (touch only; vertical scrolling stays untouched).
    let startX = 0, startY = 0, dx = 0, tracking = false;
    item.addEventListener("pointerdown", event => { if (event.pointerType !== "touch") return; startX = event.clientX; startY = event.clientY; dx = 0; tracking = true; });
    item.addEventListener("pointermove", event => {
      if (!tracking) return;
      const x = event.clientX - startX, y = event.clientY - startY;
      if (Math.abs(y) > 24 && Math.abs(y) > Math.abs(x)) { tracking = false; item.style.transform = ""; return; }
      if (x <= 0) return;
      dx = Math.min(x, 90); item.style.transform = `translateX(${dx}px)`; item.classList.toggle("is-swipe-ready", dx > 60);
    });
    const end = () => { if (!tracking) return; tracking = false; item.style.transform = ""; item.classList.remove("is-swipe-ready"); if (dx > 60) start(message, context); dx = 0; };
    item.addEventListener("pointerup", end); item.addEventListener("pointercancel", () => { tracking = false; item.style.transform = ""; item.classList.remove("is-swipe-ready"); });
  }

  // Reply and Forward in the long-press menu.
  function paletteActions(palette, item, message, close, context = {}) {
    const add = (cls, icon, label, run) => { const b = document.createElement("button"); b.type = "button"; b.className = cls; b.dataset.icon = icon; b.textContent = t(label); b.title = t(label); b.setAttribute("aria-label", t(label)); b.addEventListener("click", () => { close(); run(); }); palette.insertBefore(b, palette.querySelector(".message-copy-choice, .message-edit-choice, .message-delete-choice")); };
    add("message-reply-choice", "reply", "Reply", () => start(message, context));
    if (message.content && !message.mediaType) add("message-forward-choice", "share", "Forward", () => openForward(message, context));
  }

  let dialog = null;
  function openForward(message, context = {}) {
    const chats = (context.chats?.() || []).filter(chat => chat.contactEmail && chat.canContact !== false && chat.contactEmail !== contactNow());
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.className = "call-setup-dialog sync-wallpaper-dialog sync-tones-dialog sync-forward-dialog";
      dialog.setAttribute("aria-labelledby", "syncForwardTitle");
      dialog.innerHTML = '<header><div><p class="phone-setup-count" data-count></p><h2 id="syncForwardTitle"></h2></div><button type="button" class="call-setup-close" data-icon="close"></button></header><p class="sync-forward-preview" data-preview></p><div class="sync-forward-list"></div><p class="phone-setup-status" role="status" data-status></p><div class="phone-setup-actions"><span></span><button type="button" class="primary" data-send></button></div>';
      dialog.querySelector(".call-setup-close").addEventListener("click", () => dialog.close());
      document.body.appendChild(dialog);
      window.danzstakIcons?.enhance?.(dialog);
    }
    dialog.querySelector("h2").textContent = t("Forward to…");
    dialog.querySelector(".call-setup-close").setAttribute("aria-label", t("Close"));
    dialog.querySelector("[data-preview]").textContent = snippetOf(message);
    const list = dialog.querySelector(".sync-forward-list"), status = dialog.querySelector("[data-status]"), send = dialog.querySelector("[data-send]"), count = dialog.querySelector("[data-count]");
    status.textContent = "";
    list.replaceChildren(...(chats.length ? chats.map(chat => {
      const row = document.createElement("label"); row.className = "sync-tone-row sync-forward-row";
      row.innerHTML = '<input type="checkbox"><span></span>';
      const box = row.querySelector("input"); box.value = chat.contactEmail;
      row.querySelector("span").textContent = chat.name || t("DanzStak member");
      box.addEventListener("change", update);
      return row;
    }) : [Object.assign(document.createElement("p"), { className: "sync-wp-note", textContent: t("No other chats to forward to yet.") })]));
    function picked() { return [...list.querySelectorAll("input:checked")].map(box => box.value); }
    function update() {
      const n = picked().length;
      for (const box of list.querySelectorAll("input")) box.disabled = !box.checked && n >= MAX_FORWARD;
      count.textContent = tf("{n} of {max} chats", { n, max: MAX_FORWARD });
      send.disabled = n === 0;
      send.textContent = n > 1 ? tf("Send to {n} chats", { n }) : t("Send");
    }
    send.onclick = async () => {
      const recipients = picked(); if (!recipients.length) return;
      send.disabled = true; status.textContent = t("Forwarding…");
      try {
        const headers = { "content-type": "application/json", ...(await globalThis.danzstakCallingDeviceHeaders?.() || {}) };
        const response = await fetch(API + "/messages", { method: "POST", credentials: "include", cache: "no-store", headers, body: JSON.stringify({ action: "forward", contactEmail: contactNow(), messageId: message.messageId, recipients }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok && !data.forwarded) throw new Error(data.error || t("Forward failed. Try again."));
        const failed = (data.results || []).filter(result => !result.ok).length;
        status.textContent = failed ? tf("Forwarded to {n}; {failed} couldn't be reached.", { n: data.forwarded, failed }) : tf("Forwarded to {n} chats.", { n: data.forwarded });
        setTimeout(() => dialog.close(), failed ? 1800 : 700);
      } catch (error) { status.textContent = error.message; send.disabled = false; }
    };
    update();
    if (!dialog.open) dialog.showModal();
  }

  window.addEventListener("danzstak:sync-conversation-opened", () => { if (replying && replying.contact !== contactNow()) clear(); });
  window.danzstakSyncReply = { start, clear, idFor, decorate, paletteActions, jumpTo, openForward, MAX_FORWARD };
})();
