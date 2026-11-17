"use strict";
// Owner SYNC call test 2026-11-17: call audio was silent or very quiet on the owner's phone. chat.js now forces the
// remote element unmuted at full volume; this adds a Speaker button that routes the call to another output where the
// browser allows it (selectAudioOutput / setSinkId: Chrome and Edge on computers, some Android builds). Where the web
// cannot choose earpiece vs loudspeaker (iPhone and most phones), the button stays hidden and one line says so.
(() => {
  const t = value => window.danzstakTranslate?.(value) || value;
  const canChoose = typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
  const canPick = Boolean(navigator.mediaDevices?.selectAudioOutput);
  let outputs = [], index = 0, sinkId = "";

  const targets = () => ["remoteAudio", "remoteVideo"].map(id => document.getElementById(id)).filter(Boolean);
  async function apply(id) {
    sinkId = id;
    for (const element of targets()) { try { await element.setSinkId(id); } catch {} }
  }
  async function listOutputs() {
    try { outputs = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === "audiooutput"); }
    catch { outputs = []; }
    return outputs;
  }

  function mount() {
    const controls = document.getElementById("mediaControls");
    if (!controls || document.getElementById("toggleSpeaker")) return;
    const note = document.createElement("p");
    note.className = "call-speaker-note";
    note.id = "callSpeakerNote";
    if (!canChoose) {
      note.textContent = t("Use your phone's volume buttons or its speaker control to change where the call plays.");
      controls.after(note);
      return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.id = "toggleSpeaker";
    button.dataset.icon = "volume-2";
    button.setAttribute("aria-label", t("Speaker"));
    button.title = t("Speaker");
    const status = document.createElement("span");
    status.className = "sr-only";
    status.setAttribute("aria-live", "polite");
    button.addEventListener("click", async () => {
      try {
        if (canPick) {
          const device = await navigator.mediaDevices.selectAudioOutput();
          await apply(device.deviceId);
          status.textContent = device.label || t("Speaker");
          return;
        }
        if (!outputs.length) await listOutputs();
        if (outputs.length < 2) { status.textContent = t("Only one speaker is available on this device."); return; }
        index = (index + 1) % outputs.length;
        await apply(outputs[index].deviceId);
        status.textContent = outputs[index].label || t("Speaker");
      } catch { /* the member closed the picker */ }
    });
    const hangUp = document.getElementById("hangUp");
    if (hangUp) hangUp.before(button); else controls.appendChild(button);
    controls.appendChild(status);
    window.danzstakIcons?.upgrade?.(button);
  }

  // A newly attached remote stream keeps the member's chosen output.
  window.addEventListener("danzstak:remote-media", event => { if (sinkId && canChoose) event.detail?.element?.setSinkId?.(sinkId).catch(() => {}); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true }); else mount();
  window.danzstakCallSpeaker = { canChoose, canPick };
})();
