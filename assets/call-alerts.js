"use strict";
// Queue 5a00, spec docs/tasks/31-call-ringer.md. SYNC only:
// - SYNC ⋮ → "Test ringer": plays this phone's ringtone for 3 s and sends a test call notification to this phone, so the
//   member can check both the in-app ring and the ring with SYNC closed.
// - One line when this registered phone has no push subscription yet: "Turn on call alerts so calls ring when SYNC is
//   closed", with Turn on. Dismissing it is remembered on this device; it never nags.
(() => {
  const API = "https://api.danzstak.com", DISMISSED = "danzstak_call_alerts_prompt";
  const t = value => window.danzstakTranslate?.(value) || value;
  let noteTimer = 0;

  async function api(path, options = {}) {
    const response = await fetch(API + path, { credentials: "include", cache: "no-store", ...options, headers: { "content-type": "application/json", ...(await globalThis.danzstakCallingDeviceHeaders?.() || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || t("DanzStak cannot connect right now. Check your connection and try again."));
    return data;
  }
  function anchor() { return document.querySelector(".chat-sidebar .chat-list-panel"); }
  function say(text) {
    const before = anchor(); if (!before) return;
    let note = document.querySelector(".call-alerts-note");
    if (!note) { note = document.createElement("p"); note.className = "call-alerts-note"; note.setAttribute("role", "status"); note.setAttribute("aria-live", "polite"); before.before(note); }
    note.textContent = text; note.hidden = false;
    clearTimeout(noteTimer); noteTimer = setTimeout(() => { note.hidden = true; }, 9000);
  }

  // F15e: a web page rings at the phone's media volume (it can't use the ringer volume), so every result says how to make it loudest.
  const ringing = text => say(`${t(text)} ${t("Turn up your phone's volume for the loudest ring.")}`);
  async function testRinger() {
    window.danzstakCallRinger?.test(3000); // inside the member's tap, so the phone lets it sound
    if (window.danzstakSyncDeviceRegistered?.() !== true) { ringing("Ringing here now. Register this phone for calls, then test again to check the ring with SYNC closed."); return; }
    const state = await window.danzstakPushState?.().catch(() => "unsupported");
    if (state !== "enabled") { ringing("Ringing here now. Turn on call alerts so calls ring when SYNC is closed."); prompt(true); return; }
    try {
      await window.danzstakEnablePush?.(); // re-saves this phone's subscription, tied to its registered calling device
      const result = await api("/push/test", { method: "POST", body: JSON.stringify({ kind: "call" }) });
      ringing(result.thisDeviceRings ? "Ringing here now, and a test call notification is on its way to this phone." : "Ringing here now. This phone isn't set up to ring with SYNC closed yet. Try again in a minute.");
    } catch (error) { say(error.message); }
  }

  async function prompt(force = false) {
    if (!document.body.classList.contains("messages-page") || document.querySelector(".call-alerts-prompt")) return;
    if (!force) { try { if (localStorage.getItem(DISMISSED)) return; } catch {} }
    if (window.danzstakSyncDeviceRegistered?.() !== true || typeof window.danzstakEnablePush !== "function") return;
    const state = await window.danzstakPushState?.().catch(() => "unsupported");
    if (!["prompt", "incomplete"].includes(state) || document.querySelector(".call-alerts-prompt")) return;
    const before = anchor(); if (!before) return;
    const bar = document.createElement("aside");
    bar.className = "call-alerts-prompt"; bar.setAttribute("role", "status");
    const text = document.createElement("span"); text.textContent = t("Turn on call alerts so calls ring when SYNC is closed");
    const on = document.createElement("button"); on.type = "button"; on.className = "primary"; on.textContent = t("Turn on");
    const close = document.createElement("button"); close.type = "button"; close.className = "call-alerts-close"; close.textContent = "×";
    close.setAttribute("aria-label", t("Not now")); close.title = t("Not now");
    on.addEventListener("click", async () => {
      on.disabled = true;
      try { await window.danzstakEnablePush(); bar.remove(); say(t("Call alerts are on for this phone.")); }
      catch (error) { text.textContent = error.message; on.disabled = false; }
    });
    close.addEventListener("click", () => { try { localStorage.setItem(DISMISSED, new Date().toISOString()); } catch {} bar.remove(); });
    bar.append(text, on, close);
    before.before(bar);
  }

  window.danzstakSyncSettings?.add?.({ id: "test-ringer", label: "Test ringer", hint: "Plays your ringtone and sends a test call to this phone", icon: "bell", order: 31, run: testRinger });
  addEventListener("danzstak:push-enabled", () => document.querySelector(".call-alerts-prompt")?.remove());
  addEventListener("danzstak:call-device-ready", event => { if (event.detail?.registered === true) prompt(); });
  addEventListener("danzstak:call-device-registered", () => prompt());
  setTimeout(() => prompt(), 2500);
  window.danzstakCallAlerts = Object.freeze({ testRinger, prompt });
})();
