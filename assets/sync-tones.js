"use strict";
// SYNC ringtones and message tones (task 16-B2, owner 2026-11-17: "users should be able to change their ring tone").
// Every tone is an original DanzStak pattern synthesized with Web Audio right here: no audio files, no songs and no member
// uploads (CLAUDE.md "no music files, ever"). One tone at a time, a ring gives up after 30 s and stops the instant the
// call is answered, declined or answered elsewhere (the call code calls stop()). Choices live on this device in
// localStorage, so they survive cache updates; per-contact overrides are keyed by a hash, never the contact's address.
// Platform limit (stated in settings): with the app closed or the phone locked the phone's own notification sound plays.
(() => {
  const KEY = "danzstak_sync_tones", MAX_RING_MS = 30000;
  const t = value => window.danzstakTranslate?.(value) || value;
  // [start s, duration s, frequency Hz, wave, gain 0-1, end frequency Hz (slide)]; period = loop length in seconds.
  const kick = s => [s, 0.16, 150, "sine", 1, 45], hat = s => [s, 0.04, 9000, "noise", 0.35];
  const TONES = {
    "classic": { name: "Classic ring", kind: "ring", period: 2.6, notes: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95].map((s, i) => [s, 0.045, i % 2 ? 480 : 440, "sine", 0.9]) },
    "bell": { name: "Desk bell", kind: "ring", period: 2.2, notes: [[0, 0.9, 1318, "sine", 0.7], [0, 0.9, 1976, "sine", 0.25], [0.45, 0.9, 1318, "sine", 0.6], [0.45, 0.9, 1976, "sine", 0.2]] },
    "techno-pulse": { name: "Techno pulse", kind: "ring", period: 1.875, notes: [kick(0), kick(0.469), kick(0.938), kick(1.406), hat(0.234), hat(0.703), hat(1.172), hat(1.641), [0, 0.1, 220, "square", 0.18], [0.938, 0.1, 261.6, "square", 0.18]] },
    "acid": { name: "Acid line", kind: "ring", period: 1.875, notes: [[0, 0.2, 110, "sawtooth", 0.55, 220], [0.234, 0.12, 130.8, "sawtooth", 0.5], [0.469, 0.2, 110, "sawtooth", 0.55, 165], [0.703, 0.12, 164.8, "sawtooth", 0.5], [0.938, 0.2, 110, "sawtooth", 0.55, 220], [1.172, 0.12, 196, "sawtooth", 0.5], [1.406, 0.3, 146.8, "sawtooth", 0.5, 110]] },
    "house-stab": { name: "House stab", kind: "ring", period: 1.875, notes: [kick(0), kick(0.938), ...[0.234, 0.703, 1.172, 1.641].flatMap(s => [[s, 0.16, 261.6, "triangle", 0.45], [s, 0.16, 329.6, "triangle", 0.4], [s, 0.16, 392, "triangle", 0.4]])] },
    "punk-riff": { name: "Punk riff", kind: "ring", period: 1.6, notes: [0, 0.18, 0.36].flatMap(s => [[s, 0.14, 82.4, "square", 0.45], [s, 0.14, 123.5, "square", 0.35]]).concat([[0.6, 0.4, 110, "square", 0.5], [0.6, 0.4, 164.8, "square", 0.35]]) },
    "metal-gallop": { name: "Metal gallop", kind: "ring", period: 1.5, notes: [0, 0.375, 0.75, 1.125].flatMap(s => [[s, 0.08, 82.4, "sawtooth", 0.55], [s + 0.1, 0.08, 82.4, "sawtooth", 0.5], [s + 0.2, 0.15, 82.4, "sawtooth", 0.6]]).concat([[1.125, 0.3, 87.3, "sawtooth", 0.4]]) },
    "industrial": { name: "Industrial clang", kind: "ring", period: 2, notes: [0, 0.5, 1.25].flatMap(s => [[s, 0.35, 220, "square", 0.35], [s, 0.35, 311, "square", 0.3], [s, 0.35, 587, "triangle", 0.25], [s, 0.05, 6000, "noise", 0.4]]) },
    "synth-arp": { name: "Synth arp", kind: "ring", period: 2, notes: [261.6, 329.6, 392, 523.3, 392, 329.6, 261.6, 392].map((f, i) => [i * 0.125, 0.11, f, "square", 0.3]) },
    "click": { name: "Click", kind: "message", period: 0.5, notes: [[0, 0.03, 1800, "square", 0.35], [0.09, 0.03, 2400, "square", 0.3]] },
    "pop": { name: "Pop", kind: "message", period: 0.5, notes: [[0, 0.12, 660, "sine", 0.8, 990]] },
    "rimshot": { name: "Rimshot", kind: "message", period: 0.5, notes: [[0, 0.06, 900, "triangle", 0.6], [0, 0.04, 5000, "noise", 0.5], [0.14, 0.05, 1200, "triangle", 0.4]] }
  };
  const RING_MAKEUP_GAIN = 3.2, RING_DRIVE = 24, RING_HIGHPASS_HZ = 600, RING_CEILING = 0.97; // see the loud chain in play()
  const curves = {};
  function ringCurve(kind) {
    if (curves[kind]) return curves[kind];
    const n = 2049, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = kind === "tanh" ? Math.tanh(x * 3) / Math.tanh(3) : Math.max(-RING_CEILING, Math.min(RING_CEILING, x)); }
    return (curves[kind] = curve);
  }
  const DEFAULTS = { ring: "classic", message: "pop", ringVibrate: true, messageVibrate: true, contacts: {} };
  let ctx = null, active = null, previewTimer = null;

  const load = () => { try { const saved = JSON.parse(localStorage.getItem(KEY) || "{}"); return { ...DEFAULTS, ...saved, contacts: { ...(saved.contacts || {}) } }; } catch { return { ...DEFAULTS, contacts: {} }; } };
  const save = prefs => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); return true; } catch { return false; } };
  // FNV-1a: a stable local key, so the address itself is never stored next to the tone.
  const contactKey = contact => { const value = String(contact || "").trim().toLowerCase(); if (!value) return ""; let h = 0x811c9dc5; for (const ch of value) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return "c" + h.toString(36); };
  const valid = (id, kind) => TONES[id]?.kind === kind;
  function toneFor(kind, contact) {
    const prefs = load(), own = prefs.contacts[contactKey(contact)]?.[kind];
    if (valid(own, kind)) return own;
    return valid(prefs[kind], kind) ? prefs[kind] : DEFAULTS[kind];
  }
  function vibrates(kind, contact) {
    const prefs = load(), own = prefs.contacts[contactKey(contact)]?.[kind + "Vibrate"];
    return typeof own === "boolean" ? own : prefs[kind + "Vibrate"] !== false;
  }

  function context(given) {
    if (given && given.state !== "closed") return given;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!ctx || ctx.state === "closed") ctx = new AudioContextClass();
    return ctx;
  }
  let noiseBuffer = null;
  function note(audio, out, at, [start, duration, frequency, wave, gain = 1, slideTo]) {
    const amp = audio.createGain(), begin = at + start, end = begin + duration;
    amp.gain.setValueAtTime(0.0001, begin);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), begin + Math.min(0.008, duration / 3));
    amp.gain.exponentialRampToValueAtTime(0.0001, end);
    let source;
    if (wave === "noise") {
      if (!noiseBuffer || noiseBuffer.sampleRate !== audio.sampleRate) { noiseBuffer = audio.createBuffer(1, Math.round(audio.sampleRate * 0.2), audio.sampleRate); const d = noiseBuffer.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      source = audio.createBufferSource(); source.buffer = noiseBuffer;
      const hp = audio.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = Math.min(frequency, audio.sampleRate / 2 - 100);
      source.connect(hp).connect(amp);
    } else {
      source = audio.createOscillator(); source.type = wave; source.frequency.value = frequency;
      source.frequency.setValueAtTime(frequency, begin);
      if (slideTo) source.frequency.exponentialRampToValueAtTime(slideTo, end);
      source.connect(amp);
    }
    amp.connect(out);
    source.start(begin); source.stop(end + 0.02);
  }
  // Owner 2026-11-19: "real quiet, turn it up at least 10 dB". Phone speakers barely play below ~400 Hz, where most ring
  // notes sit, so: cut the lows, saturate (tanh) to put harmonics in the 1–5 kHz band the speaker and ear hear best,
  // compress, lift, and hard-limit just under full scale so nothing clips at the output. Used by play() (Web Audio) and
  // render() (the call ringer's <audio> loop), so both ring paths are exactly as loud.
  function ringChain(out, master) {
    if (!out.createDynamicsCompressor) return null;
    try {
      const hp = out.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = RING_HIGHPASS_HZ;
      const drive = out.createGain(); drive.gain.value = RING_DRIVE;
      const shaper = out.createWaveShaper(); shaper.curve = ringCurve("tanh"); shaper.oversample = "4x";
      const comp = out.createDynamicsCompressor(); comp.threshold.value = -24; comp.knee.value = 4; comp.ratio.value = 12; comp.attack.value = 0.002; comp.release.value = 0.1;
      const makeup = out.createGain(); makeup.gain.value = RING_MAKEUP_GAIN;
      const limiter = out.createWaveShaper(); limiter.curve = ringCurve("limit");
      master.connect(hp); hp.connect(drive); drive.connect(shaper); shaper.connect(comp); comp.connect(makeup); makeup.connect(limiter); limiter.connect(out.destination);
      return [hp, drive, shaper, comp, makeup, limiter];
    } catch { return null; }
  }
  // 5a00: whole loops of a tone, through the same notes and ring chain as play(), into an OfflineAudioContext. The call
  // ringer (call-ringer.js) turns the result into the looping ringtone of its <audio> element.
  function render(id, audio, { volume = 0.4, loops = 1 } = {}) {
    const tone = TONES[id]; if (!tone || !audio) return 0;
    const master = audio.createGain(); master.gain.value = Math.max(0, Math.min(1, volume));
    if (!(tone.kind === "ring" && ringChain(audio, master))) master.connect(audio.destination);
    for (let loop = 0; loop < loops; loop++) for (const n of tone.notes) note(audio, master, loop * tone.period, n);
    return tone.period * loops;
  }
  function setSession(type) { try { if (navigator.audioSession) { const before = navigator.audioSession.type; navigator.audioSession.type = type; return before; } } catch {} return null; }

  // Plays one tone, looping until stop() or maxMs. Only one tone ever sounds: a new one stops the previous one.
  function play(id, { audio, volume = 0.4, loop = false, maxMs = MAX_RING_MS, vibrate = null, quiet = false } = {}) {
    stop();
    const tone = TONES[id]; const out = context(audio);
    if (!tone || !out) return { stop() {} };
    // 16-H quiet hours: rings and message tones stay silent (previews always play).
    if (quiet && window.danzstakSyncPrefs?.quiet?.(tone.kind === "ring" ? "call" : "message")) return { id, stop() {} };
    // "ambient" makes iOS/Safari respect the silent switch while a tone plays (where the browser exposes it).
    const previousSession = setSession("ambient");
    const master = out.createGain(); master.gain.value = Math.max(0, Math.min(1, volume));
    // Owner 2026-11-18: "the ring tones are quiet". Rings go through the loud ring chain (ringChain) so a phone speaker
    // plays them loud without clipping (message tones stay gentle).
    const loudChain = tone.kind === "ring" ? ringChain(out, master) : null;
    if (!loudChain) master.connect(out.destination);
    const until = Date.now() + Math.min(maxMs, MAX_RING_MS);
    let next = out.currentTime + 0.03, timer = null, vibeTimer = null, stopped = false;
    const handle = {
      id, stop() {
        if (stopped) return; stopped = true;
        clearInterval(timer); clearInterval(vibeTimer);
        try { master.gain.cancelScheduledValues(out.currentTime); master.gain.setValueAtTime(0, out.currentTime); master.disconnect(); loudChain?.forEach(node => node.disconnect()); } catch {}
        if (vibrate) try { navigator.vibrate?.(0); } catch {}
        if (previousSession !== null) setSession(previousSession);
        if (active === handle) active = null;
      }
    };
    const tick = () => {
      if (stopped) return;
      if (Date.now() >= until) { handle.stop(); return; }
      while (next < out.currentTime + 0.6) { for (const n of tone.notes) note(out, master, next, n); next += tone.period; if (!loop) { clearInterval(timer); setTimeout(() => handle.stop(), Math.ceil((next - out.currentTime) * 1000) + 60); return; } }
    };
    if (out.state === "suspended") out.resume?.().catch(() => {});
    tick(); if (loop && !stopped) timer = setInterval(tick, 150);
    if (vibrate && navigator.vibrate) { const buzz = () => { try { navigator.vibrate(vibrate); } catch {} }; buzz(); if (loop) vibeTimer = setInterval(buzz, Math.max(1200, tone.period * 1000)); }
    active = handle;
    return handle;
  }
  function stop() { active?.stop(); }

  // Incoming call: the member's ringtone (the caller's override first), looping until answered/declined, 30 s at most.
  function startRing(audio, { contact = "", volume, durationMs = MAX_RING_MS } = {}) {
    return play(toneFor("ring", contact), { audio, volume: volume ?? window.danzstakCallSetup?.ringVolume?.() ?? 0.4, loop: true, maxMs: durationMs, quiet: true, vibrate: vibrates("ring", contact) ? (window.danzstakSyncPrefs ? window.danzstakSyncPrefs.vibration() : [400, 200, 400]) : null });
  }
  // A new message while the app is open: once, quietly, and never on top of a ringing call.
  function messageArrived(contact) {
    if (active || document.hidden) return false;
    if (ringerBusy()) return false; // 5a00: the call ringer may be playing through <audio>
    const out = context(); if (!out || out.state !== "running") { if (vibrates("message", contact)) try { navigator.vibrate?.(120); } catch {} return false; }
    play(toneFor("message", contact), { audio: out, volume: 0.35, loop: false, maxMs: 1500, quiet: true, vibrate: vibrates("message", contact) && (!window.danzstakSyncPrefs || window.danzstakSyncPrefs.vibration()) ? [120] : null });
    return true;
  }
  function preview(id) { clearTimeout(previewTimer); const out = context(); if (!out) return null; out.resume?.().catch(() => {}); const h = play(id, { audio: out, volume: window.danzstakCallSetup?.ringVolume?.() ?? 0.4, loop: TONES[id]?.kind === "ring", maxMs: 3000 }); previewTimer = setTimeout(() => h.stop(), 3000); return h; }
  // Browsers only start audio after a tap; unlock our context on the first one so message tones can play later.
  const unlock = () => { const out = context(); out?.resume?.().catch(() => {}); };
  window.addEventListener("pointerdown", unlock, { once: true, capture: true });
  window.addEventListener("keydown", unlock, { once: true, capture: true });

  // Settings: choose (scope "all" or a contact) and save.
  function choose(kind, id, contact = "") {
    if (!valid(id, kind) && id !== "") return false;
    const prefs = load();
    if (contact) { const key = contactKey(contact), own = { ...(prefs.contacts[key] || {}) }; if (id) own[kind] = id; else delete own[kind]; if (Object.keys(own).length) prefs.contacts[key] = own; else delete prefs.contacts[key]; }
    else prefs[kind] = id || DEFAULTS[kind];
    return save(prefs);
  }
  function setVibrate(kind, on, contact = "") {
    const prefs = load();
    if (contact) { const key = contactKey(contact); prefs.contacts[key] = { ...(prefs.contacts[key] || {}), [kind + "Vibrate"]: !!on }; }
    else prefs[kind + "Vibrate"] = !!on;
    return save(prefs);
  }
  function reset(contact = "") { const prefs = load(); if (contact) delete prefs.contacts[contactKey(contact)]; else { const keep = prefs.contacts; Object.assign(prefs, DEFAULTS, { contacts: keep }); } return save(prefs); }
  const list = kind => Object.entries(TONES).filter(([, tone]) => tone.kind === kind).map(([id, tone]) => ({ id, name: tone.name, seconds: tone.period }));

  // ---- The picker sheet ----
  let dialog = null, scopeContact = "";
  function row(kind, tone, current) {
    const label = document.createElement("label"); label.className = "sync-tone-row";
    label.innerHTML = '<input type="radio"><span></span><button type="button" class="sync-tone-play"></button>';
    const input = label.querySelector("input"); input.name = "sync-" + kind; input.value = tone.id; input.checked = tone.id === current;
    label.querySelector("span").textContent = t(tone.name);
    const playButton = label.querySelector("button"); playButton.setAttribute("aria-label", t("Preview") + " " + t(tone.name)); playButton.textContent = "▶";
    playButton.addEventListener("click", event => { event.preventDefault(); preview(tone.id); });
    input.addEventListener("change", () => { choose(kind, tone.id, scopeContact); preview(tone.id); });
    return label;
  }
  function section(kind) {
    const wrap = document.createElement("section"); wrap.className = "sync-tone-section"; wrap.dataset.kind = kind;
    const h = document.createElement("h3"); h.textContent = t(kind === "ring" ? "Ringtone" : "Message tone"); wrap.append(h);
    const own = scopeContact ? load().contacts[contactKey(scopeContact)]?.[kind] : "";
    if (scopeContact) {
      const label = document.createElement("label"); label.className = "sync-tone-row";
      label.innerHTML = '<input type="radio"><span></span>';
      const input = label.querySelector("input"); input.name = "sync-" + kind; input.value = ""; input.checked = !own;
      label.querySelector("span").textContent = t("Use my default");
      input.addEventListener("change", () => choose(kind, "", scopeContact));
      wrap.append(label);
    }
    const current = scopeContact ? own : toneFor(kind, "");
    for (const tone of list(kind)) wrap.append(row(kind, tone, current));
    const vib = document.createElement("label"); vib.className = "sync-tone-switch";
    vib.innerHTML = '<span></span><input type="checkbox" role="switch">';
    vib.querySelector("span").textContent = t("Vibrate");
    const box = vib.querySelector("input"); box.checked = vibrates(kind, scopeContact);
    box.addEventListener("change", () => setVibrate(kind, box.checked, scopeContact));
    wrap.append(vib);
    return wrap;
  }
  function open(contact = "") {
    scopeContact = String(contact || "").trim().toLowerCase();
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.className = "call-setup-dialog sync-wallpaper-dialog sync-tones-dialog";
      dialog.setAttribute("aria-labelledby", "syncTonesTitle");
      dialog.innerHTML = '<header><div><p class="phone-setup-count" data-scope></p><h2 id="syncTonesTitle"></h2></div><button type="button" class="call-setup-close" data-icon="close"></button></header><div class="sync-tone-body"></div><p class="sync-wp-note" data-note></p><div class="phone-setup-actions"><button type="button" class="secondary" data-reset></button><span></span><button type="button" class="primary" data-done></button></div>';
      dialog.querySelector(".call-setup-close").addEventListener("click", () => { stop(); dialog.close(); });
      dialog.querySelector("[data-done]").addEventListener("click", () => { stop(); dialog.close(); window.dispatchEvent(new CustomEvent("danzstak:sync-tones-saved")); });
      dialog.querySelector("[data-reset]").addEventListener("click", () => { reset(scopeContact); open(scopeContact); });
      dialog.addEventListener("close", stop);
      document.body.appendChild(dialog);
    }
    dialog.querySelector("h2").textContent = t("Ringtones");
    dialog.querySelector("[data-scope]").textContent = scopeContact ? t("This contact: {name}").replace("{name}", window.danzstakActiveContactName || t("DanzStak member")) : t("All chats");
    dialog.querySelector("[data-note]").textContent = t("With SYNC closed or the phone locked, your phone's own notification sound plays. Your SYNC tone takes over while SYNC is open.");
    dialog.querySelector("[data-reset]").textContent = t("Reset to default");
    dialog.querySelector("[data-done]").textContent = t("Done");
    dialog.querySelector(".call-setup-close").setAttribute("aria-label", t("Close"));
    dialog.querySelector(".sync-tone-body").replaceChildren(section("ring"), section("message"));
    window.danzstakIcons?.enhance?.(dialog);
    if (!dialog.open) dialog.showModal();
  }
  function addChatMenuItem() {
    const menu = document.getElementById("conversationMenu");
    if (!menu || menu.querySelector("#headerRingtoneMenu")) return;
    const item = document.createElement("button");
    item.type = "button"; item.id = "headerRingtoneMenu"; item.setAttribute("role", "menuitem"); item.dataset.icon = "bell";
    item.textContent = t("Ringtone");
    item.addEventListener("click", () => { menu.hidden = true; document.getElementById("conversationMore")?.setAttribute("aria-expanded", "false"); open(document.getElementById("contactEmail")?.value || ""); });
    menu.insertBefore(item, menu.querySelector("#headerDeleteChat"));
    window.danzstakIcons?.enhance?.(menu);
  }
  window.danzstakSyncSettings?.add({ id: "tones", label: "Ringtones", hint: "Ringtone, message tone and vibration", icon: "bell", order: 20, run: () => open("") });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addChatMenuItem); else addChatMenuItem();
  // 5a00: the call ringer (call-ringer.js) may be ringing through its <audio> element instead of play().
  const ringerBusy = () => ["audio", "webaudio"].includes(window.danzstakCallRinger?.state?.());
  const period = id => TONES[id]?.period || 0;
  window.danzstakSyncTones = { list, toneFor, vibrates, choose, setVibrate, reset, play, stop, startRing, messageArrived, preview, open, render, period, isPlaying: () => !!active || ringerBusy(), contactKey };
})();
