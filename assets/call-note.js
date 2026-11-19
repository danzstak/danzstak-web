"use strict";
// Task 30 (owner 2026-11-18): a 5th call button, Text. It opens a small box; Send puts the note over the other person's
// video until they close it. Notes travel over the call's own peer-to-peer data channel: no server, nothing stored,
// gone when the call ends. Text only (no HTML, links not clickable), 280 characters, one note every 2 seconds.
(() => {
  const MAX = 280, GAP_MS = 2000;
  const t = value => window.danzstakTranslate?.(value) || value;
  let lastSent = 0, lastReceived = 0, sheet = null, overlay = null;

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
      try { live.send(JSON.stringify({ type: "call-note", id: Math.random().toString(36).slice(2, 10), text, sentAt: Date.now() })); }
      catch { status.textContent = t("Note not sent, try again"); return; }
      lastSent = Date.now(); status.textContent = t("Sent ✓"); box.value = ""; count.textContent = "";
      setTimeout(closeSheet, 700);
    });
    sheet.addEventListener("keydown", event => { if (event.key === "Escape") closeSheet(); });
    (document.querySelector(".call-panel, #videoGrid")?.parentElement || document.body).appendChild(sheet);
    fitToKeyboard(); box.focus();
  }
  function closeSheet() { sheet?.remove(); sheet = null; }
  // Keep the box above the phone keyboard.
  function fitToKeyboard() {
    if (!sheet || !window.visualViewport) return;
    const gap = Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop);
    sheet.style.bottom = `calc(${gap}px + 112px + env(safe-area-inset-bottom, 0px))`;
  }
  window.visualViewport?.addEventListener("resize", fitToKeyboard);

  // Incoming note → card over the other person's video until they close it. Returns true when handled.
  function receive(raw, senderName = "") {
    let note;
    try { note = JSON.parse(raw); } catch { return false; }
    if (!note || note.type !== "call-note") return false;
    const text = clean(note.text);
    if (!text || String(note.text || "").length > MAX) return true; // ignored, never shown in chat either
    if (Date.now() - lastReceived < 500) return true;
    lastReceived = Date.now();
    overlay?.remove();
    overlay = document.createElement("section");
    overlay.className = "call-note-overlay"; overlay.setAttribute("role", "status"); overlay.setAttribute("aria-live", "polite");
    const who = document.createElement("small"); who.className = "call-note-from"; who.textContent = String(senderName || "").split(/\s+/)[0] || t("Note");
    const body = document.createElement("p"); body.className = "call-note-text"; body.textContent = text; // text only
    const close = document.createElement("button"); close.type = "button"; close.className = "call-note-dismiss"; close.setAttribute("aria-label", t("Close note")); close.textContent = "✕";
    close.addEventListener("click", () => { overlay?.remove(); overlay = null; });
    overlay.append(who, body, close);
    const stage = document.querySelector("#videoGrid figure:not(.local-video)") || document.getElementById("videoGrid") || document.body;
    stage.appendChild(overlay);
    return true;
  }
  function reset() { closeSheet(); overlay?.remove(); overlay = null; }

  const controls = () => document.getElementById("mediaControls");
  function watch() {
    ensureButton();
    const target = controls();
    if (target) new MutationObserver(() => { if (target.hidden) reset(); }).observe(target, { attributes: true, attributeFilter: ["hidden"] });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch, { once: true }); else watch();
  window.danzstakCallNote = Object.freeze({ receive, reset, clean, MAX });
})();
