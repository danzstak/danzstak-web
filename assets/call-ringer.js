"use strict";
// Incoming calls must ring (owner 2026-11-18 phone test, task 31). chat.js used to stay silent when the page had no
// unlocked AudioContext yet (no tap this session), and the vibration only ran together with the tone. This helper:
// - vibrates on its own while a call rings (where the phone supports it), even if sound is blocked;
// - when the browser blocks sound, shows "Tap to hear the ringer" on the incoming-call screen and pulses it;
// - adds "Test ringer" to the SYNC ⋮ sheet so a member can check their ringtone (and vibration) on this phone.
(() => {
  const t = value => window.danzstakTranslate?.(value) || value;
  let vibeTimer = null, vibeUntil = 0, tapButton = null, screen = null;

  function vibrateStart(ms = 30000) {
    if (!navigator.vibrate || vibeTimer) return;
    vibeUntil = Date.now() + Math.max(0, ms);
    const buzz = () => { if (Date.now() >= vibeUntil) return vibrateStop(); try { navigator.vibrate([600, 300, 600]); } catch { /* optional */ } };
    buzz(); vibeTimer = setInterval(buzz, 2200);
  }
  function vibrateStop() { clearInterval(vibeTimer); vibeTimer = null; try { navigator.vibrate?.(0); } catch { /* optional */ } }

  // Sound is blocked until the member touches the page: say so on the call screen; one tap unlocks and rings.
  function needsTap(container, unlock) {
    if (!container) return;
    screen = container; container.classList.add("call-ringer-needs-tap");
    if (tapButton?.isConnected) return;
    tapButton = document.createElement("button");
    tapButton.type = "button"; tapButton.className = "call-ringer-tap";
    tapButton.textContent = t("Tap to hear the ringer");
    tapButton.addEventListener("click", () => { Promise.resolve(unlock?.()).catch(() => null).finally(clearTap); });
    const actions = container.querySelector(".call-actions");
    actions ? actions.before(tapButton) : container.append(tapButton);
  }
  function clearTap() { tapButton?.remove(); tapButton = null; screen?.classList.remove("call-ringer-needs-tap"); }
  function stop() { vibrateStop(); clearTap(); }

  // "Test ringer" row in the SYNC ⋮ sheet: the member's ringtone for 3 s from a tap (so the sound is allowed).
  async function testRinger() {
    const C = window.AudioContext || window.webkitAudioContext;
    let audio = null;
    try { audio = C ? new C() : null; if (audio?.state === "suspended") await audio.resume(); } catch { audio = null; }
    vibrateStart(3000);
    if (audio && window.danzstakSyncTones?.startRing) {
      const ring = window.danzstakSyncTones.startRing(audio, { durationMs: 3000 });
      setTimeout(() => { ring?.stop?.(); audio.close?.().catch?.(() => {}); }, 3100);
    }
    window.danzstakShowFeedback?.(t(audio ? "Playing your ringtone for 3 seconds." : "This browser can't play sounds here."));
  }
  const row = { id: "test-ringer", label: "Test ringer", hint: "Play your ringtone for 3 seconds", icon: "bell", order: 35, run: testRinger };
  function mount() { window.danzstakSyncSettings?.add?.(row); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true }); else mount();

  window.danzstakCallRinger = Object.freeze({ vibrateStart, vibrateStop, needsTap, clearTap, stop, testRinger });
})();
