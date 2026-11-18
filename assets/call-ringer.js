"use strict";
// Queue 5a00, spec docs/tasks/31-call-ringer.md (owner phone test 2026-11-18: "SYNC works but the ringer does not work").
// Builds on PR #578 (tap prompt, vibration, louder Web Audio rings, Test ringer) and adds the spec's <audio> ringtone first.
// One ringer for every page that can receive a call: SYNC (chat.js) and the global incoming-call popup (incoming-calls.js).
// Fallback order: 1) an <audio> element looping the member's ringtone, 2) Web Audio, 3) visual: the call screen pulses and
// offers "Tap to hear the ringer". Answer and Decline always work whatever happens to the sound.
// The ringtone is the member's own SYNC tone (sync-tones.js), rendered here to an in-memory WAV: no audio file ships,
// nothing is fetched or uploaded (CLAUDE.md "no music files, ever").
// Phones only allow sound after a real user activation. On touch screens that is pointerup/touchend/click, never
// pointerdown, so the ringer unlocks on all of them, once per page session, and retries when the page becomes visible.
// Platform limit: with the app closed or the phone locked only the system notification rings (service-worker.js).
(() => {
  const VIBRATION = [600, 300, 600, 300, 600], VIBRATE_EVERY_MS = 3000, MAX_RING_MS = 45000, RATE = 44100;
  const t = value => window.danzstakTranslate?.(value) || value;
  const tones = () => window.danzstakSyncTones;
  const urls = new Map();
  let audio = null, primed = false, ctx = null, ring = null;

  // ---------- The ringtone as an in-memory WAV ----------
  // Same notes as the Web Audio tone: [start s, duration s, frequency Hz, wave, gain 0-1, end frequency Hz].
  function addNote(mix, rate, at, [start, duration, frequency, wave, gain = 1, slideTo]) {
    const first = Math.round((at + start) * rate), count = Math.max(2, Math.round(duration * rate));
    const attack = Math.max(1, Math.round(Math.min(0.008, duration / 3) * rate)), peak = Math.max(0.0002, gain), floor = 0.0001;
    const rc = 1 / (2 * Math.PI * Math.min(frequency, rate / 2 - 100)), alpha = rc / (rc + 1 / rate);
    let phase = 0, lastIn = 0, lastOut = 0;
    for (let i = 0; i < count; i++) {
      const envelope = i < attack ? floor * Math.pow(peak / floor, i / attack) : peak * Math.pow(floor / peak, (i - attack) / Math.max(1, count - attack));
      let sample;
      if (wave === "noise") { const input = Math.random() * 2 - 1; lastOut = alpha * (lastOut + input - lastIn); lastIn = input; sample = lastOut; }
      else {
        const f = slideTo ? frequency * Math.pow(slideTo / frequency, i / count) : frequency;
        phase += f / rate; const x = phase - Math.floor(phase);
        sample = wave === "square" ? (x < 0.5 ? 1 : -1) : wave === "sawtooth" ? 2 * x - 1 : wave === "triangle" ? 4 * Math.abs(x - 0.5) - 1 : Math.sin(2 * Math.PI * x);
      }
      mix[(first + i) % mix.length] += sample * envelope; // wraps into the start, so the loop is seamless
    }
  }
  function renderWav(tone, { rate = RATE, minSeconds = 3 } = {}) {
    const loops = Math.max(1, Math.ceil(minSeconds / tone.period)), length = Math.round(tone.period * loops * rate);
    const mix = new Float32Array(length);
    for (let loop = 0; loop < loops; loop++) for (const note of tone.notes) addNote(mix, rate, loop * tone.period, note);
    let peak = 0; for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(mix[i]));
    const scale = peak > 0 ? 0.89 / peak : 0, bytes = new Uint8Array(44 + length * 2), view = new DataView(bytes.buffer);
    const ascii = (offset, text) => { for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i); };
    ascii(0, "RIFF"); view.setUint32(4, 36 + length * 2, true); ascii(8, "WAVE"); ascii(12, "fmt ");
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); ascii(36, "data"); view.setUint32(40, length * 2, true);
    for (let i = 0; i < length; i++) view.setInt16(44 + i * 2, Math.max(-32767, Math.min(32767, Math.round(mix[i] * scale * 32767))), true);
    return bytes;
  }
  const toneId = contact => tones()?.toneFor?.("ring", contact) || "classic";
  function source(contact) {
    const id = toneId(contact);
    if (urls.has(id)) return urls.get(id);
    const tone = tones()?.pattern?.(id);
    if (!tone || typeof Blob !== "function" || !globalThis.URL?.createObjectURL) return "";
    try { const url = URL.createObjectURL(new Blob([renderWav(tone)], { type: "audio/wav" })); urls.set(id, url); return url; } catch { return ""; }
  }

  // ---------- Players ----------
  function element() {
    if (audio || typeof Audio !== "function") return audio;
    audio = new Audio();
    audio.loop = true; audio.preload = "auto";
    audio.setAttribute?.("playsinline", ""); audio.setAttribute?.("data-danzstak-ringer", "");
    return audio;
  }
  function context(given) {
    if (given && given.state !== "closed") return given;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!ctx || ctx.state === "closed") { try { ctx = new AudioContextClass(); } catch { return null; } }
    return ctx;
  }
  const volume = () => Math.max(0.05, Math.min(1, Number(window.danzstakCallSetup?.ringVolume?.() ?? 0.4) || 0.4));
  const settle = (promise, ms) => Promise.race([Promise.resolve(promise), new Promise(resolve => setTimeout(resolve, ms))]);
  // "ambient" lets iOS respect the silent switch and mix with other apps' audio (same as the Web Audio tones).
  function session(type) { try { if (navigator.audioSession) { const before = navigator.audioSession.type; navigator.audioSession.type = type; return before; } } catch {} return null; }

  // ---------- The visual fallback on the call screen ----------
  function tapButton(surface) {
    if (!surface?.querySelector) return null;
    let button = surface.querySelector(".call-ringer-tap");
    if (!button) {
      button = document.createElement("button");
      button.type = "button"; button.className = "call-ringer-tap"; button.hidden = true;
      button.textContent = t("Tap to hear the ringer");
      button.addEventListener("click", () => unlock());
      const slot = surface.querySelector("[data-ringer-slot]"), actions = surface.querySelector(".call-actions, .global-call-actions");
      if (slot) slot.append(button); else if (actions) actions.before(button); else surface.append(button);
    }
    return button;
  }
  function paint(state) {
    const blocked = state.mode === "blocked", surface = state.surface;
    if (surface?.classList) surface.classList.toggle("call-ringer-needs-tap", blocked);
    const button = blocked ? tapButton(surface) : surface?.querySelector?.(".call-ringer-tap");
    if (button) button.hidden = !blocked;
    try { window.dispatchEvent(new CustomEvent("danzstak:ringer", { detail: { mode: state.mode } })); } catch {}
  }
  function clear(surface) {
    surface?.classList?.remove("call-ringer-needs-tap");
    const button = surface?.querySelector?.(".call-ringer-tap"); if (button) button.hidden = true;
  }
  function setMode(state, mode) { if (ring !== state) return; state.mode = mode; paint(state); }

  // ---------- Ringing ----------
  async function sound(state) {
    if (ring !== state) return;
    const player = element(), src = source(state.contact);
    if (player && src) {
      try {
        if (player.src !== src) player.src = src;
        player.loop = true; player.muted = false; player.volume = volume();
        try { player.currentTime = 0; } catch {}
        if (state.session === undefined) state.session = session("ambient");
        await player.play();
        if (ring !== state) { player.pause(); return; }
        setMode(state, "audio"); return;
      } catch { /* blocked or unsupported: Web Audio next */ }
    }
    if (ring !== state) return;
    const out = context(state.audioContext);
    if (out && tones()?.play) {
      try { if (out.state !== "running") await settle(out.resume?.(), 800); } catch {}
      if (ring !== state) return;
      if (out.state === "running") {
        state.web = tones().play(toneId(state.contact), { audio: out, volume: volume(), loop: true, maxMs: Math.max(1000, state.until - Date.now()) });
        setMode(state, "webaudio"); return;
      }
    }
    setMode(state, "blocked");
  }
  function vibrateWhileRinging(state) {
    if (typeof navigator.vibrate !== "function") return;
    if (tones()?.vibrates?.("ring", state.contact) === false || window.danzstakSyncPrefs?.vibration?.() === null) return;
    const buzz = () => { if (ring !== state || document.hidden) return; try { navigator.vibrate(VIBRATION); } catch {} };
    buzz(); state.vibe = setInterval(buzz, VIBRATE_EVERY_MS);
  }
  // start() rings until stop(), the handle's stop() or durationMs. Only one ring at a time.
  function start({ contact = "", durationMs = 30000, surface = null, audioContext = null } = {}) {
    stop();
    const state = { contact, surface, audioContext, mode: "starting", until: Date.now() + Math.min(Math.max(0, durationMs), MAX_RING_MS), web: null, vibe: null, timer: null };
    ring = state;
    state.handle = { stop() { if (ring === state) stop(); }, get mode() { return state.mode; } };
    state.timer = setTimeout(() => { if (ring === state) stop(); }, Math.max(0, state.until - Date.now()));
    // 16-H quiet hours: no sound and no buzz; the call screen still shows.
    if (window.danzstakSyncPrefs?.quiet?.("call")) { setMode(state, "quiet"); return state.handle; }
    vibrateWhileRinging(state);
    void sound(state);
    return state.handle;
  }
  function stop() {
    const state = ring; if (!state) return;
    ring = null;
    clearTimeout(state.timer); clearInterval(state.vibe);
    try { navigator.vibrate?.(0); } catch {}
    try { state.web?.stop?.(); } catch {}
    if (audio) { try { audio.pause(); audio.currentTime = 0; } catch {} }
    if (state.session !== undefined && state.session !== null) session(state.session);
    clear(state.surface);
    try { window.dispatchEvent(new CustomEvent("danzstak:ringer", { detail: { mode: "idle" } })); } catch {}
  }

  // ---------- Unlock ----------
  // During a real tap: a ring the browser blocked starts now; otherwise the <audio> element is played muted once so the
  // phone lets it ring later without a tap (iOS), and Web Audio is resumed.
  function unlock() {
    const out = context();
    try { if (out && out.state !== "running") out.resume?.().catch?.(() => {}); } catch {}
    if (ring?.mode === "blocked") { void sound(ring); return; }
    if (primed || ring) return;
    const player = element(), src = source("");
    if (!player || !src) return;
    primed = true;
    try {
      if (player.src !== src) player.src = src;
      player.muted = true;
      const before = session("ambient");
      Promise.resolve(player.play()).then(() => { if (!ring) { player.pause(); try { player.currentTime = 0; } catch {} } }, () => { primed = false; })
        .finally(() => { player.muted = false; if (before !== null) session(before); });
    } catch { primed = false; player.muted = false; }
  }
  function visible() {
    if (document.hidden) return;
    const out = context();
    try { if (out && out.state !== "running") out.resume?.().catch?.(() => {}); } catch {}
    if (ring?.mode === "blocked") void sound(ring);
  }
  for (const type of ["pointerup", "touchend", "click", "keydown"]) document.addEventListener(type, unlock, { capture: true, passive: true });
  document.addEventListener("visibilitychange", visible);

  // A call answered or declined on this page: the service worker closes that call's notification and stops re-ringing it.
  function handled(callId) {
    if (!/^[a-f0-9-]{36}$/.test(String(callId || ""))) return;
    try { navigator.serviceWorker?.controller?.postMessage({ type: "DANZSTAK_CALL_HANDLED", callId: String(callId) }); } catch {}
  }
  // SYNC ⋮ → Test ringer: the ringtone for 3 s. It runs inside the member's tap (play() is called before any await).
  function test(ms = 3000) { return start({ durationMs: ms }); }

  // testRinger: the name PR #578 gave the 3 s test, kept for anything that still calls it.
  window.danzstakCallRinger = Object.freeze({ start, stop, unlock, test, testRinger: () => test(3000), handled, state: () => ring?.mode || "idle", tone: () => ring ? toneId(ring.contact) : "", renderWav, VIBRATION, MAX_RING_MS });
})();
