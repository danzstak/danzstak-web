"use strict";
// Call audio setup (owner 2026-11-17: "it should open the box in the middle of the page that users can set the audio";
// "on a computer, and on a phone they should use the phone controls").
// - Computers: a centered "Audio & video check" box. It opens before the first outgoing call, and from a gear on the call
//   screen and in the SYNC device panel. It has a microphone picker with a live level meter, a speaker picker with a test
//   sound, a camera picker with a preview, and a ring-volume slider with a preview ring. Choices stay on this device only
//   (localStorage), never synced and never sent to the server.
// - Phones: no box. Calls use the phone's own volume, speaker, earpiece and Bluetooth controls; one line says so.
// - Blocked microphone/camera (phones and computers): explain exactly how to allow it in this browser, with Try again,
//   instead of Accept silently doing nothing.
(() => {
  const KEY = "danzstak_call_av", CHECKED = "danzstak_call_av_checked";
  const DEFAULT_RING = 1; // F15e (owner 2026-11-19: "10 dB louder minimum"): the loudest by default (was 0.8, before that 0.4)
  const t = value => window.danzstakTranslate?.(value) || value;
  const ua = navigator.userAgent || "";
  const isPhone = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua) && !matchMedia?.("(pointer: fine)").matches);
  const isComputer = !isPhone && Boolean(window.matchMedia?.("(hover: hover) and (pointer: fine)").matches);
  const canSink = typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;

  function read() { try { return { ringVolume: DEFAULT_RING, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { ringVolume: DEFAULT_RING }; } }
  function save(next) { const merged = { ...read(), ...next }; try { localStorage.setItem(KEY, JSON.stringify(merged)); } catch {} return merged; }
  const settings = () => read();

  // getUserMedia constraints with the member's chosen devices (computers only; phones use the system defaults).
  function constraints(kind) {
    const s = isComputer ? read() : {};
    const video = kind === "video" ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 }, ...(s.camera ? { deviceId: { ideal: s.camera } } : {}) } : false;
    return { audio: s.mic ? { deviceId: { ideal: s.mic } } : true, video };
  }
  // ---------- headsets first ----------
  // Owner 2026-11-24: "the sync audio does not come through blutooth headsets", for "both the caller and reciever".
  // Chrome on Android sends a call's sound to the device whose microphone the call uses ("the input device selection will
  // affect the output device as well", Chromium audio_manager_android.cc), and SYNC asked for the default microphone: the
  // phone's own. Now a connected headset's microphone is asked for by its own id, on phones and computers, so the call is
  // heard and spoken in the headset; one that connects during the call takes it over, and one that goes away hands it
  // back (chat.js, devicechange). On computers the call's sound goes to the same headset (setSinkId, matched by group).
  // Android names its inputs "Speakerphone", "Wired headset", "Headset earpiece", "Bluetooth headset", "USB audio": the
  // earpiece is the phone's own, never a headset.
  const NOT_HEADSET = /earpiece|speaker ?phone|built-?in|internal|microphone array|webcam|camera/i;
  const BLUETOOTH = /bluetooth|airpods|buds|hands-?free|\bbt\b/i;
  const WIRED = /headset|headphone|earphone|wired|usb/i;
  const virtualId = id => id === "default" || id === "communications" || !id;
  function headsetRank(device) {
    const label = String(device?.label || "");
    if (!label || virtualId(device.deviceId) || NOT_HEADSET.test(label)) return 0;
    return BLUETOOTH.test(label) ? 2 : WIRED.test(label) ? 1 : 0;
  }
  async function devices() { try { return await navigator.mediaDevices.enumerateDevices(); } catch { return []; } }
  const headsetIn = list => list.filter(device => device.kind === "audioinput" && headsetRank(device)).sort((a, b) => headsetRank(b) - headsetRank(a))[0] || null;
  function headsetOut(list) {
    const input = headsetIn(list);
    const outputs = list.filter(device => device.kind === "audiooutput" && !virtualId(device.deviceId));
    return (input && outputs.find(device => device.groupId && device.groupId === input.groupId)) || outputs.filter(headsetRank).sort((a, b) => headsetRank(b) - headsetRank(a))[0] || null;
  }
  // The microphone a call should use now: a connected headset first; otherwise the member's pick (computers) while it is
  // still there; otherwise the system default (null). Labels only exist once the microphone is allowed.
  function wantedMic(list) {
    const headset = headsetIn(list);
    if (headset) return headset.deviceId;
    const s = isComputer ? read() : {};
    return s.mic && list.some(device => device.kind === "audioinput" && device.deviceId === s.mic) ? s.mic : null;
  }
  // A new microphone track when the call should move to another microphone (a headset came or went, or the microphone
  // stopped), else null. The old track is left to the caller (chat.js swaps the new one into the call with replaceTrack,
  // keeps mute, then stops the old one).
  async function micSwap(current) {
    const list = await devices(), wanted = wantedMic(list);
    if (current?.readyState === "live") {
      const using = current.getSettings?.().deviceId || "";
      if (!list.length || !using) return null; // nothing to compare with: keep the microphone that works
      if (wanted === using) return null; // already on the headset (or the member's pick)
      const stillThere = list.some(device => device.kind === "audioinput" && device.deviceId === using);
      if (!wanted && (stillThere || virtualId(using))) return null; // no headset: the microphone in use stays
    }
    try {
      const fresh = await navigator.mediaDevices.getUserMedia({ audio: wanted ? { deviceId: { exact: wanted } } : true });
      return fresh.getAudioTracks()[0] || null;
    } catch { return null; }
  }
  // The call's microphone stream with the headset in it: swaps the audio track of a stream just opened by chat.js.
  async function preferHeadset(stream) {
    const current = stream?.getAudioTracks?.()[0];
    if (!current) return stream;
    const next = await micSwap(current);
    if (next) { stream.removeTrack(current); current.stop(); stream.addTrack(next); }
    return stream;
  }
  async function routeOutput(element) {
    if (!isComputer || !canSink || !element?.setSinkId) return;
    const list = await devices(), headset = headsetOut(list), s = read();
    const picked = s.speaker && list.some(device => device.kind === "audiooutput" && device.deviceId === s.speaker) ? s.speaker : "";
    const target = headset?.deviceId || picked || "";
    if (element.sinkId === target) return;
    try { await element.setSinkId(target); } catch {}
  }

  // ---------- blocked permission explainer ----------
  function browserSteps(kind) {
    const what = kind === "video" ? t("Microphone and Camera") : t("Microphone");
    const installed = matchMedia?.("(display-mode: standalone)").matches;
    if (/iPhone|iPad|iPod/.test(ua)) return installed ? t("Open the iPhone Settings app → DanzStak (or Safari) → allow {what}, then come back and tap Try again.").replace("{what}", what) : t("Tap aA in the address bar → Website Settings → set {what} to Allow, then tap Try again.").replace("{what}", what);
    if (/Android/.test(ua)) return installed ? t("Long-press the DanzStak icon → App info → Permissions → allow {what}, then tap Try again.").replace("{what}", what) : t("Tap the icon left of the address → Permissions → allow {what}, then tap Try again.").replace("{what}", what);
    if (/Firefox\//.test(ua)) return t("Click the crossed-out microphone in the address bar → Allow, then click Try again.");
    if (/Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua)) return t("Safari menu → Settings for danzstak.com → set {what} to Allow, then click Try again.").replace("{what}", what);
    return t("Click the icon left of the address (lock or sliders) → Site settings → set {what} to Allow, then click Try again.").replace("{what}", what);
  }
  let blockedDialog = null;
  function explainBlocked(kind, retry) {
    if (!blockedDialog) {
      blockedDialog = document.createElement("dialog");
      blockedDialog.className = "call-setup-dialog call-blocked-dialog";
      blockedDialog.setAttribute("aria-labelledby", "callBlockedTitle");
      blockedDialog.innerHTML = '<header><h2 id="callBlockedTitle"></h2><button type="button" class="call-setup-close" data-icon="close"></button></header><p class="call-blocked-steps"></p><div class="call-setup-actions"><button type="button" class="primary call-blocked-retry"></button></div>';
      blockedDialog.querySelector(".call-setup-close").addEventListener("click", () => blockedDialog.close());
      document.body.appendChild(blockedDialog);
      window.danzstakIcons?.enhance?.(blockedDialog);
    }
    blockedDialog.querySelector("h2").textContent = t(kind === "video" ? "Allow your microphone and camera" : "Allow your microphone");
    blockedDialog.querySelector(".call-setup-close").setAttribute("aria-label", t("Close"));
    blockedDialog.querySelector(".call-blocked-steps").textContent = browserSteps(kind);
    const again = blockedDialog.querySelector(".call-blocked-retry");
    again.textContent = t("Try again");
    again.hidden = typeof retry !== "function";
    again.onclick = () => { blockedDialog.close(); retry?.(); };
    if (!blockedDialog.open) blockedDialog.showModal();
    again.hidden ? blockedDialog.querySelector(".call-setup-close").focus() : again.focus();
  }

  // ---------- audio & video check (computers) ----------
  let box = null, testStream = null, meterFrame = 0, meterContext = null, previewAudio = null;
  function stopTest() {
    cancelAnimationFrame(meterFrame); meterFrame = 0;
    testStream?.getTracks().forEach(track => track.stop()); testStream = null;
    meterContext?.close?.().catch?.(() => {}); meterContext = null;
    const video = box?.querySelector(".call-setup-preview"); if (video) video.srcObject = null;
  }
  async function fillPickers() {
    let devices = [];
    try { devices = await navigator.mediaDevices.enumerateDevices(); } catch {}
    const s = read();
    for (const [kind, select, field] of [["audioinput", ".call-setup-mic", "mic"], ["audiooutput", ".call-setup-speaker", "speaker"], ["videoinput", ".call-setup-camera", "camera"]]) {
      const el = box.querySelector(select), list = devices.filter(device => device.kind === kind);
      el.replaceChildren(...list.map((device, index) => { const o = document.createElement("option"); o.value = device.deviceId; o.textContent = device.label || `${t(kind === "audioinput" ? "Microphone" : kind === "audiooutput" ? "Speaker" : "Camera")} ${index + 1}`; return o; }));
      if (!list.length) { const o = document.createElement("option"); o.value = ""; o.textContent = t(kind === "audiooutput" ? "System default" : "None found"); el.appendChild(o); }
      if (s[field] && list.some(device => device.deviceId === s[field])) el.value = s[field];
      el.closest("label").hidden = kind === "audiooutput" && !canSink;
    }
  }
  async function startTest() {
    stopTest();
    const s = read(), status = box.querySelector(".call-setup-status");
    try {
      testStream = await navigator.mediaDevices.getUserMedia({ audio: s.mic ? { deviceId: { exact: s.mic } } : true, video: s.camera ? { deviceId: { exact: s.camera } } : true });
      status.textContent = "";
    } catch (error) {
      try { testStream = await navigator.mediaDevices.getUserMedia({ audio: s.mic ? { deviceId: { exact: s.mic } } : true }); status.textContent = t("No camera available. Voice calls still work."); }
      catch (audioError) {
        if (["NotAllowedError", "SecurityError"].includes(audioError?.name || error?.name)) { status.textContent = browserSteps("video"); return; }
        status.textContent = t("The microphone could not start. Check device permissions and try again."); return;
      }
    }
    await fillPickers(); // labels appear once permission is granted
    const video = box.querySelector(".call-setup-preview");
    video.srcObject = testStream.getVideoTracks().length ? testStream : null;
    video.hidden = !testStream.getVideoTracks().length;
    try {
      meterContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = meterContext.createAnalyser(); analyser.fftSize = 512;
      meterContext.createMediaStreamSource(testStream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize), bar = box.querySelector(".call-setup-level span"), meter = box.querySelector(".call-setup-level");
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0; for (const value of data) peak = Math.max(peak, Math.abs(value - 128));
        const level = Math.min(1, peak / 64);
        bar.style.transform = `scaleX(${level.toFixed(3)})`;
        meter.setAttribute("aria-valuenow", String(Math.round(level * 100)));
        meterFrame = requestAnimationFrame(tick);
      };
      tick();
    } catch {}
  }
  function tone(volume, pattern) {
    try {
      const context = new (window.AudioContext || window.webkitAudioContext)();
      const destination = context.createMediaStreamDestination();
      previewAudio?.pause(); previewAudio = new Audio(); previewAudio.srcObject = destination.stream; routeOutput(previewAudio).then(() => previewAudio.play().catch(() => {}));
      let at = context.currentTime + 0.05;
      for (const [frequency, length, gap] of pattern) {
        const oscillator = context.createOscillator(), gain = context.createGain();
        oscillator.frequency.value = frequency; gain.gain.value = volume;
        oscillator.connect(gain).connect(destination); oscillator.start(at); oscillator.stop(at + length); at += length + gap;
      }
      setTimeout(() => { context.close().catch(() => {}); }, (at - context.currentTime + 0.3) * 1000);
    } catch {}
  }
  function ensureBox() {
    if (box) return box;
    box = document.createElement("dialog");
    box.className = "call-setup-dialog";
    box.setAttribute("aria-labelledby", "callSetupTitle");
    box.innerHTML = '<header><h2 id="callSetupTitle"></h2><button type="button" class="call-setup-close" data-icon="close"></button></header>'
      + '<p class="call-setup-status" role="status"></p>'
      + '<label><span class="call-setup-label" data-k="Microphone"></span><select class="call-setup-mic"></select></label>'
      + '<div class="call-setup-level" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div><p class="call-setup-hint" data-k="Say something to see the level move."></p>'
      + '<label><span class="call-setup-label" data-k="Speaker"></span><select class="call-setup-speaker"></select></label>'
      + '<div class="call-setup-row"><button type="button" class="secondary call-setup-test" data-k="Play test sound"></button></div>'
      + '<label><span class="call-setup-label" data-k="Camera"></span><select class="call-setup-camera"></select></label>'
      + '<video class="call-setup-preview" autoplay muted playsinline hidden></video>'
      + '<label><span class="call-setup-label" data-k="Ring volume"></span><input class="call-setup-ring" type="range" min="0.05" max="1" step="0.05"></label>'
      + '<div class="call-setup-row"><button type="button" class="secondary call-setup-ring-test" data-k="Preview ring"></button></div>'
      + '<div class="call-setup-actions"><button type="button" class="primary call-setup-done" data-k="Done"></button></div>';
    box.querySelectorAll("[data-k]").forEach(node => { node.textContent = t(node.dataset.k); });
    box.querySelector("h2").textContent = t("Audio & video check");
    const close = box.querySelector(".call-setup-close"); close.setAttribute("aria-label", t("Close"));
    box.querySelector(".call-setup-level").setAttribute("aria-label", t("Microphone level"));
    const finish = () => { try { localStorage.setItem(CHECKED, "1"); } catch {} box.close(); };
    close.addEventListener("click", finish);
    box.querySelector(".call-setup-done").addEventListener("click", finish);
    box.addEventListener("close", () => { stopTest(); previewAudio?.pause(); box.dispatchEvent(new CustomEvent("call-setup-closed")); });
    box.querySelector(".call-setup-mic").addEventListener("change", event => { save({ mic: event.target.value }); startTest(); });
    box.querySelector(".call-setup-camera").addEventListener("change", event => { save({ camera: event.target.value }); startTest(); });
    box.querySelector(".call-setup-speaker").addEventListener("change", async event => { save({ speaker: event.target.value }); for (const id of ["remoteAudio", "remoteVideo"]) await routeOutput(document.getElementById(id)); });
    const ring = box.querySelector(".call-setup-ring");
    ring.addEventListener("input", () => { save({ ringVolume: Number(ring.value) }); ring.setAttribute("aria-valuetext", `${Math.round(Number(ring.value) * 100)}%`); });
    box.querySelector(".call-setup-test").addEventListener("click", () => tone(0.25, [[660, 0.18, 0.08], [880, 0.18, 0.08], [990, 0.3, 0]]));
    box.querySelector(".call-setup-ring-test").addEventListener("click", () => tone(read().ringVolume, [[880, 0.24, 0.06], [660, 0.24, 0.5], [880, 0.24, 0.06], [660, 0.24, 0]]));
    document.body.appendChild(box);
    window.danzstakIcons?.enhance?.(box);
    return box;
  }
  // Opens the box on a computer; resolves when it closes. On phones resolves at once (no box).
  function openCheck() {
    if (!isComputer) return Promise.resolve(false);
    ensureBox();
    const ring = box.querySelector(".call-setup-ring"); ring.value = String(read().ringVolume);
    ring.setAttribute("aria-valuetext", `${Math.round(Number(ring.value) * 100)}%`);
    if (!box.open) box.showModal();
    fillPickers().then(startTest);
    box.querySelector(".call-setup-close").focus();
    return new Promise(resolve => box.addEventListener("call-setup-closed", () => resolve(true), { once: true }));
  }
  const needsFirstCheck = () => { if (!isComputer) return false; try { return localStorage.getItem(CHECKED) !== "1"; } catch { return false; } };

  // Gear on the call screen (computers) or one honest line (phones).
  function mountCallScreen() {
    const controls = document.getElementById("mediaControls");
    if (!controls || document.getElementById("callAudioSettings") || document.getElementById("callPhoneAudioNote")) return;
    if (isComputer) {
      const gear = document.createElement("button");
      gear.type = "button"; gear.id = "callAudioSettings"; gear.dataset.icon = "settings";
      gear.setAttribute("aria-label", t("Audio & video check")); gear.title = t("Audio & video check");
      gear.addEventListener("click", () => openCheck());
      const hangUp = document.getElementById("hangUp");
      if (hangUp) hangUp.before(gear); else controls.appendChild(gear);
      window.danzstakIcons?.upgrade?.(gear);
    } else {
      const note = document.createElement("p");
      note.id = "callPhoneAudioNote"; note.className = "call-speaker-note";
      note.textContent = t("Use your phone's volume buttons or its speaker control to change where the call plays.");
      controls.after(note);
    }
  }
  // "Audio & video" entry in the SYNC device panel (computers).
  function mountSettingsEntry() {
    const panel = document.getElementById("callingDevicesDialog");
    if (!isComputer || !panel || panel.querySelector(".call-setup-entry")) return;
    const entry = document.createElement("button");
    entry.type = "button"; entry.className = "secondary call-setup-entry"; entry.textContent = t("Audio & video check");
    entry.addEventListener("click", () => { panel.close(); openCheck(); });
    (panel.querySelector("#registeredDevices") || panel.lastElementChild).after(entry);
  }

  window.addEventListener("danzstak:remote-media", event => routeOutput(event.detail?.element));
  const start = () => { mountCallScreen(); mountSettingsEntry(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
  window.danzstakCallSetup = { isComputer, settings, constraints, preferHeadset, micSwap, routeOutput, openCheck, needsFirstCheck, explainBlocked, browserSteps, ringVolume: () => Number(read().ringVolume) || DEFAULT_RING };
})();
