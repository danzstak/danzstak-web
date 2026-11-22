"use strict";
// Task 30 (owner 2026-11-18): a 5th call button, Text. It opens a small box; Send puts the note over the other person's
// video until they close it. Notes travel over the call's own peer-to-peer data channel: no server, nothing stored,
// gone when the call ends. Text only (no HTML; only a link back to DanzStak is tappable), 280 characters, one note every
// 2 seconds.
// L3 (owner 2026-11-19: "the text box works in the callers side over video but not on the receivers side … make the
// video a little smaller and put the text box on the bottom"): the note was drawn inside the other person's video tile,
// which is hidden on a voice call (and on a receiver who answered without video), so it never showed. It is now a band
// on the call screen itself, just above the call buttons, on voice and video calls; on a video call the video shrinks
// to end above it. The sender sees "Sent ✓" only once the other phone confirms it got the note.
(() => {
  const MAX = 280, GAP_MS = 2000, ACK_MS = 4000;
  const t = value => window.danzstakTranslate?.(value) || value;
  let lastSent = 0, lastReceived = 0, sheet = null, overlay = null, waiting = null;

  function liveChannel() {
    try { return typeof channel !== "undefined" && channel && channel.readyState === "open" ? channel : null; } catch { return null; } // eslint-disable-line no-undef
  }
  function clean(text) { return String(text || "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").replace(/\s+\n/g, "\n").trim().slice(0, MAX); }

  function ensureButton() {
    const controls = document.getElementById("mediaControls"), hangUp = document.getElementById("hangUp");
    if (!controls || !hangUp || document.getElementById("callNoteButton")) return;
    const button = document.createElement("button");
    button.type = "button"; button.id = "callNoteButton"; button.className = "call-note-button";
    button.setAttribute("aria-label", t("Send a note")); button.title = t("Send a note");
    button.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8 9h8M8 12h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>' + t("Text") + "</span>";
    button.addEventListener("click", openSheet);
    controls.insertBefore(button, hangUp);
  }

  function openSheet() {
    if (sheet) { sheet.querySelector("textarea")?.focus(); return; }
    sheet = document.createElement("form");
    sheet.className = "call-note-sheet"; sheet.setAttribute("aria-label", t("Send a note"));
    sheet.innerHTML = `<textarea maxlength="${MAX}" rows="2" aria-label="${t("Your note")}" placeholder="${t("Type a note…")}"></textarea><div class="call-note-row"><span class="call-note-count" aria-live="polite"></span><span class="call-note-status" role="status" aria-live="polite"></span><button type="button" class="call-note-close" aria-label="${t("Close")}">✕</button><button type="submit" class="call-note-send">${t("Send")}</button></div>`;
    const box = sheet.querySelector("textarea"), count = sheet.querySelector(".call-note-count"), status = sheet.querySelector(".call-note-status");
    box.addEventListener("input", () => { const left = MAX - box.value.length; count.textContent = left <= 40 ? String(left) : ""; });
    sheet.querySelector(".call-note-close").addEventListener("click", closeSheet);
    sheet.addEventListener("submit", event => {
      event.preventDefault();
      const text = clean(box.value);
      if (!text) return;
      if (Date.now() - lastSent < GAP_MS) { status.textContent = t("One moment…"); return; }
      const live = liveChannel();
      if (!live) { status.textContent = t("Note not sent, try again"); return; }
      const id = Math.random().toString(36).slice(2, 10);
      try { live.send(JSON.stringify({ type: "call-note", id, text, sentAt: Date.now() })); }
      catch { status.textContent = t("Note not sent, try again"); return; }
      lastSent = Date.now(); status.textContent = t("Sending…");
      // Delivered only when the other phone says so; until then the text stays in the box.
      clearTimeout(waiting?.timer);
      waiting = { id, timer: setTimeout(() => { waiting = null; if (sheet) status.textContent = t("Not delivered, try again"); }, ACK_MS) };
    });
    sheet.addEventListener("keydown", event => { if (event.key === "Escape") closeSheet(); });
    (document.querySelector(".call-panel, #videoGrid")?.parentElement || document.body).appendChild(sheet);
    fitToKeyboard(); box.focus();
  }
  function closeSheet() { sheet?.remove(); sheet = null; }
  function delivered(id) {
    if (!waiting || waiting.id !== id) return;
    clearTimeout(waiting.timer); waiting = null;
    if (!sheet) return;
    sheet.querySelector(".call-note-status").textContent = t("Sent ✓");
    sheet.querySelector("textarea").value = ""; sheet.querySelector(".call-note-count").textContent = "";
    setTimeout(closeSheet, 700);
  }
  // Keep the box above the phone keyboard.
  function fitToKeyboard() {
    if (!sheet || !window.visualViewport) return;
    const gap = Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop);
    sheet.style.bottom = `calc(${gap}px + var(--call-panel-h, 112px) + 8px)`;
  }
  window.visualViewport?.addEventListener("resize", fitToKeyboard);

  // Incoming note → a band at the bottom of the call screen until they close it; its delivery is confirmed to the
  // sender. Returns true when handled (notes and confirmations never show in the chat).
  function receive(raw, senderName = "") {
    let note;
    try { note = JSON.parse(raw); } catch { return false; }
    if (note?.type === "call-note-ack") { delivered(String(note.id || "")); return true; }
    if (!note || note.type !== "call-note") return false;
    const text = clean(note.text);
    if (!text || String(note.text || "").length > MAX) return true; // ignored, never shown in chat either
    if (Date.now() - lastReceived < 500) return true;
    lastReceived = Date.now();
    try { liveChannel()?.send(JSON.stringify({ type: "call-note-ack", id: String(note.id || "").slice(0, 16) })); } catch { /* the sender then says "Not delivered" */ }
    overlay?.remove();
    overlay = document.createElement("section");
    overlay.className = "call-note-overlay"; overlay.setAttribute("role", "status"); overlay.setAttribute("aria-live", "polite");
    const who = document.createElement("small"); who.className = "call-note-from"; who.textContent = String(senderName || "").split(/\s+/)[0] || t("Note");
    const body = document.createElement("p"); body.className = "call-note-text"; fill(body, text); // text only (DanzStak links tap through)
    const close = document.createElement("button"); close.type = "button"; close.className = "call-note-dismiss"; close.setAttribute("aria-label", t("Close note")); close.textContent = "✕";
    close.addEventListener("click", hideNote);
    overlay.append(who, body, close);
    // On the call screen itself (never inside a video tile that a voice call hides), like the note box.
    (document.querySelector(".call-panel, #videoGrid")?.parentElement || document.body).appendChild(overlay);
    fitVideo();
    return true;
  }
  // Text only; a link to DanzStak itself (a shared profile, F15k) becomes tappable. Nothing else is ever a link.
  function fill(node, text) {
    for (const part of text.split(/(https:\/\/\S+)/)) {
      let url = null;
      try { if (part.startsWith("https://")) url = new URL(part); } catch { /* plain text */ }
      if (url && url.origin === location.origin) { const link = document.createElement("a"); link.href = url.href; link.textContent = url.href; link.target = "_blank"; link.rel = "noopener"; node.append(link); }
      else node.append(document.createTextNode(part));
    }
  }
  // F15k Share: the call screen sends a ready-made note (a DanzStak link, never a phone number).
  function send(text) {
    const note = clean(text), live = liveChannel();
    if (!note || !live) return false;
    try { live.send(JSON.stringify({ type: "call-note", id: Math.random().toString(36).slice(2, 10), text: note, sentAt: Date.now() })); return true; } catch { return false; }
  }
  // A video call's picture ends above the note instead of under it.
  function fitVideo() {
    const root = document.documentElement;
    if (!overlay?.isConnected) { root.style.removeProperty("--call-note-band"); delete document.body.dataset.callNote; return; }
    document.body.dataset.callNote = "1";
    root.style.setProperty("--call-note-band", `${Math.max(0, Math.ceil(window.innerHeight - overlay.getBoundingClientRect().top + 8))}px`);
  }
  function hideNote() { overlay?.remove(); overlay = null; fitVideo(); }
  window.addEventListener?.("resize", () => { if (overlay) fitVideo(); });
  function reset() { closeSheet(); clearTimeout(waiting?.timer); waiting = null; hideNote(); }

  const controls = () => document.getElementById("mediaControls");
  function watch() {
    ensureButton();
    const target = controls();
    if (target) new MutationObserver(() => { if (target.hidden) reset(); }).observe(target, { attributes: true, attributeFilter: ["hidden"] });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch, { once: true }); else watch();
  window.danzstakCallNote = Object.freeze({ receive, reset, clean, send, MAX });
})();
