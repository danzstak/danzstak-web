"use strict";
// Task 16-A (owner 2026-11-17): SYNC behaves like the phone's own messenger.
// - The open thread is pinned to the *visual* viewport: header and composer stay put, the composer rides on top of
//   the keyboard, and only the message list scrolls. The page itself never scrolls (that was the owner's bug: on a
//   phone the keyboard scrolled the page, the header slid away and bubbles scrolled over it).
// - Date chips, a jump-to-latest button with the unread count, finite "pull" to load older messages, light haptics.
(() => {
  const t = value => window.danzstakTranslate?.(value) || value;
  const root = document.documentElement, phone = matchMedia("(max-width: 760px)");
  const inThread = () => document.body?.classList.contains("is-conversation-open") && !document.body.dataset.callMode;
  const buzz = ms => { try { if (matchMedia("(pointer: coarse)").matches) navigator.vibrate?.(ms); } catch {} };

  // ---- Visual viewport: size the thread to what the member can actually see ----
  let frame = 0;
  function fit() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const view = window.visualViewport;
      const height = view ? view.height : innerHeight, top = view ? view.offsetTop : 0;
      root.style.setProperty("--sync-view-height", `${Math.round(height)}px`);
      root.style.setProperty("--sync-view-top", `${Math.round(top)}px`);
      const composer = document.getElementById("messageForm");
      if (composer) root.style.setProperty("--sync-composer-height", `${Math.round(composer.getBoundingClientRect().height)}px`);
      // In a thread the document must not scroll; if the browser scrolled it (keyboard), put it back.
      if (phone.matches && inThread() && (scrollY || document.scrollingElement?.scrollTop)) scrollTo(0, 0);
      keepLatestVisible();
    });
  }
  let wasAtBottom = true;
  function keepLatestVisible() {
    const list = document.getElementById("messageList");
    if (list && wasAtBottom) list.scrollTop = list.scrollHeight;
  }
  window.visualViewport?.addEventListener("resize", fit);
  window.visualViewport?.addEventListener("scroll", fit);
  addEventListener("resize", fit);
  addEventListener("scroll", () => { if (phone.matches && inThread() && scrollY) scrollTo(0, 0); }, { passive: true });

  // ---- Date chips (Today / Yesterday / date), rebuilt when messages change ----
  const dayKey = value => { const date = new Date(value); return Number.isFinite(date.valueOf()) ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : ""; };
  function dayLabel(value) {
    const date = new Date(value), today = new Date(), yesterday = new Date(Date.now() - 86400000);
    if (dayKey(date) === dayKey(today)) return t("Today");
    if (dayKey(date) === dayKey(yesterday)) return t("Yesterday");
    const sameYear = date.getFullYear() === today.getFullYear();
    return new Intl.DateTimeFormat(root.lang || undefined, { weekday: sameYear && Date.now() - date < 6 * 86400000 ? "long" : undefined, day: "numeric", month: "long", year: sameYear ? undefined : "numeric" }).format(date);
  }
  let rebuilding = false;
  function rebuildChips(list) {
    rebuilding = true;
    list.querySelectorAll(".message-date-chip").forEach(chip => chip.remove());
    let previous = "";
    for (const message of list.querySelectorAll(".message[data-created-at]")) {
      const key = dayKey(message.dataset.createdAt);
      if (key && key !== previous) {
        const chip = document.createElement("div");
        chip.className = "message-date-chip";
        chip.setAttribute("role", "separator");
        const pill = document.createElement("span");
        pill.textContent = dayLabel(message.dataset.createdAt);
        chip.append(pill);
        message.before(chip);
        previous = key;
      }
    }
    rebuilding = false;
  }

  // ---- Jump to latest, with the count of messages that arrived while scrolled up ----
  function mountThread() {
    const list = document.getElementById("messageList"), conversation = document.querySelector(".conversation");
    if (!list || !conversation || list.dataset.syncShell) return;
    list.dataset.syncShell = "1";
    const jump = document.createElement("button");
    jump.type = "button";
    jump.className = "sync-jump-latest";
    jump.hidden = true;
    jump.setAttribute("aria-label", t("Jump to the latest message"));
    jump.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 16.6 5.4 10l1.4-1.4 5.2 5.2 5.2-5.2 1.4 1.4z"/></svg><span class="sync-jump-count" hidden></span>';
    const count = jump.querySelector(".sync-jump-count");
    (document.getElementById("messageForm") || list).before(jump);
    let unseen = 0, known = new Set([...list.querySelectorAll(".message[data-message-id]")].map(node => node.dataset.messageId));
    const distance = () => list.scrollHeight - list.scrollTop - list.clientHeight;
    const update = () => {
      wasAtBottom = distance() < 80;
      if (wasAtBottom) { unseen = 0; }
      jump.hidden = distance() < 240;
      count.hidden = !unseen;
      count.textContent = unseen > 99 ? "99+" : String(unseen);
      jump.setAttribute("aria-label", unseen ? t("{count} new messages, jump to the latest").replace("{count}", String(unseen)) : t("Jump to the latest message"));
      // Finite "pull" for older messages: reaching the top loads the next page once, if there is one.
      if (list.scrollTop < 40) { const older = list.querySelector(".load-earlier-messages:not([disabled])"); if (older && !older.dataset.autoRequested) { older.dataset.autoRequested = "1"; older.click(); } }
    };
    list.addEventListener("scroll", update, { passive: true });
    // Short hops glide; long ones jump straight there, like the phone's messenger.
    jump.addEventListener("click", () => { list.scrollTo({ top: list.scrollHeight, behavior: distance() > list.clientHeight * 3 ? "auto" : "smooth" }); unseen = 0; wasAtBottom = true; window.danzstakSyncBuzz?.(6); update(); });
    let lastKnown = [...list.querySelectorAll(".message[data-message-id]")].pop() || null;
    const observer = new MutationObserver(records => {
      // Ignore changes that are only our own date chips (else inserting chips would re-trigger this forever).
      if (rebuilding || records.every(record => [...record.addedNodes, ...record.removedNodes].every(node => node.classList?.contains("message-date-chip")))) return;
      const all = [...list.querySelectorAll(".message[data-message-id]")];
      if (!all.length) { known = new Set(); unseen = 0; lastKnown = null; }
      // Newer messages land after the previous last one; older pages are prepended and don't count as unseen.
      const fresh = all.filter(node => !known.has(node.dataset.messageId));
      fresh.forEach(node => known.add(node.dataset.messageId));
      if (lastKnown && lastKnown.isConnected && !wasAtBottom) unseen += fresh.filter(node => !node.classList.contains("mine") && (lastKnown.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)).length;
      lastKnown = all.pop() || null;
      rebuildChips(list);
      observer.takeRecords();
      update();
    });
    observer.observe(list, { childList: true });
    rebuildChips(list);
    update();
  }

  // Floating new-chat button on the chat list (phones); it does what the top bar's pencil did.
  function mountNewChat() {
    const pencil = document.getElementById("newChat");
    if (!pencil || document.querySelector(".sync-new-chat")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sync-new-chat";
    button.setAttribute("aria-label", t("Start a new chat"));
    button.title = t("Start a new chat");
    button.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 3C6.5 3 2 6.9 2 11.7c0 2.6 1.3 4.9 3.4 6.5L5 22l4-2.1c.9.2 1.9.4 3 .4 5.5 0 10-3.9 10-8.6S17.5 3 12 3Zm4 9.7h-3.3V16h-1.4v-3.3H8v-1.4h3.3V8h1.4v3.3H16v1.4Z"/></svg>';
    button.addEventListener("click", () => { buzz(6); pencil.click(); });
    document.body.append(button);
  }

  function mount() {
    mountThread();
    mountNewChat();
    document.getElementById("messageForm")?.addEventListener("submit", () => buzz(8), true);
    new MutationObserver(fit).observe(document.body, { attributes: true, attributeFilter: ["class", "data-call-mode"] });
    fit();
  }
  window.danzstakSyncBuzz = buzz;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true }); else mount();
})();
