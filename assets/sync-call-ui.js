"use strict";
// F15k (owner 2026-11-19, a familiar messenger's voice call: "SYNC phone should open like this … It needs to open calls
// like this"). The call screen, voice and video, in one layout:
// - top: a round minimise button (the call shrinks to a bubble so the member can use the chat; tap it to come back),
//   the other person's name, "SYNC Mobile" while calling or ringing (then the running call time), and "Encrypted"
//   (never "End-to-end": nothing here proves the media path is end to end);
// - middle: their big round photo with "Calling…" / "Ringing…" / the call time (voice calls; video calls keep the video
//   full screen and your camera in the picture-in-picture from call-screen.js);
// - bottom: one rounded panel, two rows of three equal round buttons with labels under them:
//   Speaker · Video · Mute / More · Share · End.
// Media and signalling stay in chat.js: its own buttons (Mute, Camera, Hang up, the note button) move into the panel
// and keep their handlers; the label under each reflects the real track state, not button text.
(() => {
  const t = value => window.danzstakTranslate?.(value) || value;
  const $ = id => document.getElementById(id);
  const phone = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "") || navigator.maxTouchPoints > 1;
  let built = false, connectedAt = 0, toastTimer = 0;

  // chat.js keeps the call's state in page-level variables (the page's CSP has no eval); read them by name.
  const localStream = () => { try { return typeof stream !== "undefined" ? stream : null; } catch { return null; } }; // eslint-disable-line no-undef
  const otherName = () => { try { return typeof contactName !== "undefined" ? String(contactName || "") : ""; } catch { return ""; } }; // eslint-disable-line no-undef
  const callKind = () => document.body.dataset.callMode || "";

  function icon(button, name) { button.dataset.icon = name; window.danzstakIcons?.upgrade?.(button); }
  function key(button, label, extra = "") {
    const cell = document.createElement("div");
    cell.className = `ds-call-key ${extra}`.trim();
    const text = document.createElement("span");
    text.className = "ds-call-label";
    text.textContent = t(label);
    text.setAttribute("aria-hidden", "true");
    cell.append(button, text);
    return cell;
  }
  function newButton(id, name, label) {
    const button = document.createElement("button");
    button.type = "button"; button.id = id;
    button.setAttribute("aria-label", t(label)); button.title = t(label);
    icon(button, name);
    return button;
  }
  function setLabel(button, label) {
    button.setAttribute("aria-label", t(label)); button.title = t(label);
    const span = button.closest(".ds-call-key")?.querySelector(".ds-call-label");
    if (span) span.textContent = t(label);
  }

  function toast(text) {
    let node = $("callToast");
    if (!node) { node = document.createElement("p"); node.id = "callToast"; node.className = "ds-call-toast"; node.setAttribute("role", "status"); document.querySelector(".conversation")?.append(node); }
    node.textContent = text; node.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { node.hidden = true; }, 3500);
  }

  // The panel's live state comes from the tracks themselves.
  function refreshKeys() {
    const audio = localStream()?.getAudioTracks?.()[0], video = localStream()?.getVideoTracks?.()[0];
    const mic = $("toggleMic"), camera = $("toggleCamera"), speaker = $("callSpeaker"), ringback = $("toggleRingback");
    if (mic) { const muted = audio ? !audio.enabled : false; mic.setAttribute("aria-pressed", String(muted)); icon(mic, muted ? "microphone-off" : "microphone"); setLabel(mic, muted ? "Unmute" : "Mute"); }
    if (camera) { const off = callKind() !== "video" || (video ? !video.enabled : true); camera.setAttribute("aria-pressed", String(off && callKind() === "video")); icon(camera, off ? "video-off" : "video"); setLabel(camera, "Video"); }
    if (speaker) { const ringing = ringback && !ringback.hidden, quiet = ringing && ringback.getAttribute("aria-pressed") === "true"; speaker.setAttribute("aria-pressed", String(Boolean(quiet))); icon(speaker, quiet ? "volume-x" : "volume-2"); }
  }

  function speakerAction() {
    const ringback = $("toggleRingback");
    if (ringback && !ringback.hidden) { ringback.click(); setTimeout(refreshKeys); return; }
    if (!phone && window.danzstakCallSetup?.openCheck) { window.danzstakCallSetup.openCheck(); return; }
    toast(t("Use your phone's volume buttons or its speaker control to change where the call plays."));
  }

  function sheet(title, items) {
    $("callSheet")?.remove();
    const box = document.createElement("div");
    box.id = "callSheet"; box.className = "ds-call-sheet"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", t(title));
    const head = document.createElement("strong"); head.textContent = t(title);
    const close = document.createElement("button"); close.type = "button"; close.className = "ds-call-sheet-close"; close.setAttribute("aria-label", t("Close")); icon(close, "close");
    close.addEventListener("click", () => box.remove());
    box.append(head, close);
    for (const item of items) {
      const row = document.createElement("button"); row.type = "button"; row.className = "ds-call-sheet-row"; row.dataset.iconLayout = "label";
      row.textContent = t(item.label);
      row.addEventListener("click", () => { box.remove(); item.run(); });
      box.append(row);
    }
    document.querySelector(".conversation")?.append(box);
    box.querySelector(".ds-call-sheet-row")?.focus();
  }
  function moreAction() {
    const items = [];
    if ($("callNoteButton")) items.push({ label: "Text note", run: () => $("callNoteButton").click() });
    if (!phone && window.danzstakCallSetup?.openCheck) items.push({ label: "Audio & video check", run: () => window.danzstakCallSetup.openCheck() });
    if ($("enableRinging")) items.push({ label: "Call alerts", run: () => $("enableRinging").click() });
    sheet("More", items);
  }
  // Share puts your DanzStak profile on their screen as a note with a link (never a phone number).
  async function shareAction() {
    let member = "";
    try { const session = await (await fetch("https://api.danzstak.com/auth/session", { credentials: "include", cache: "no-store" })).json(); member = String(session?.user?.sub || ""); } catch { /* offline */ }
    const items = [];
    if (/^[a-f0-9-]{36}$/.test(member)) items.push({ label: "My DanzStak profile", run: () => sendShare(`${location.origin}/profile.html?member=${member}`) });
    if (!items.length) { toast(t("Nothing to share right now.")); return; }
    sheet("Share into this call", items);
  }
  function sendShare(url) {
    const sent = window.danzstakCallNote?.send?.(`${t("My DanzStak profile")}: ${url}`);
    toast(t(sent ? "Shared ✓" : "Not shared, try again"));
  }

  // Minimised, the page leaves call mode (every full-screen call rule steps aside and the chat comes back) while the
  // call's audio and video keep playing; the bubble puts the call back.
  function minimise(on) {
    const body = document.body, bubble = $("callBubble");
    if (on && body.dataset.callMode) { body.dataset.callMinimised = body.dataset.callMode; delete body.dataset.callMode; }
    else if (!on && body.dataset.callMinimised) { body.dataset.callMode = body.dataset.callMinimised; delete body.dataset.callMinimised; }
    if (bubble) bubble.hidden = !body.dataset.callMinimised;
    if (on) bubble?.focus(); else $("callMinimise")?.focus();
  }

  // The chat header draws the contact's photo as a background image (direct-messages.js), not an <img>: reading only
  // an <img> left every call on the letter (owner 2026-11-23: "Images are funky").
  function photoFor() {
    const avatar = $("conversationAvatar"), img = avatar?.querySelector("img");
    if (img?.currentSrc || img?.src) return img.currentSrc || img.src;
    const match = /url\(["']?(.+?)["']?\)/.exec(avatar?.style.backgroundImage || "");
    return match ? match[1] : "";
  }
  // chat.js writes "Calling {name}…" / "Connecting to {name}…" to the status line while the photo already says
  // "Calling…": the same words twice on one screen. Those two hide; anything else (an error, Hear call) still shows.
  function echoesStage() {
    const text = $("callStatus")?.textContent.trim() || "", name = otherName() || $("conversationName")?.textContent?.trim() || "";
    if (!text || connectedAt) return false;
    return ["Calling {name}…", "Connecting to {name}…"].some(line => t(line).replace("{name}", name) === text || line.replace("{name}", name) === text);
  }
  function paintWho() {
    const name = otherName() || $("conversationName")?.textContent?.trim() || "";
    document.querySelectorAll(".ds-call-name").forEach(node => { node.textContent = name; });
    const picture = photoFor(), initial = (name.trim()[0] || "S").toUpperCase();
    document.querySelectorAll(".ds-call-photo").forEach(node => {
      const img = node.querySelector("img");
      if (picture) { if (!img || img.src !== picture) { const next = document.createElement("img"); next.src = picture; next.alt = ""; node.replaceChildren(next); } }
      else node.textContent = initial;
    });
    // The chat's own wallpaper, dimmed, behind the call.
    const list = document.querySelector(".message-list[data-wallpaper]");
    for (const screen of [document.querySelector(".conversation"), $("incomingCall")]) {
      if (screen) for (const name of ["--sync-wp-image", "--sync-wp-color"]) { const value = list?.style.getPropertyValue(name); if (value) screen.style.setProperty(name, value); else screen.style.removeProperty(name); }
    }
  }
  // Everything that sits above the panel (status line, note, note box, sheets, your camera window) uses its real height.
  function fitPanel() {
    const panel = $("mediaControls");
    if (!callKind() || !panel || panel.hidden) { document.body.style.removeProperty("--call-panel-h"); return; }
    const top = panel.getBoundingClientRect().top;
    if (top > 0) document.body.style.setProperty("--call-panel-h", `${Math.ceil(window.innerHeight - top)}px`);
  }
  function clock() {
    const s = Math.max(0, Math.floor((Date.now() - connectedAt) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }
  function paintState() {
    const kind = callKind() || document.body.dataset.callMinimised || "", sub = connectedAt ? clock() : t("SYNC Mobile");
    document.querySelectorAll(".ds-call-sub").forEach(node => { node.textContent = sub; });
    const state = $("callStage")?.querySelector(".ds-call-state");
    // "Ringing…" on the caller's side only once the server says the other phone is ringing (owner 2026-11-24), like a messenger.
    const waiting = document.body.dataset.syncScreen === "incoming-call" || document.body.dataset.callReach === "ringing" ? "Ringing…" : "Calling…";
    if (state) state.textContent = connectedAt ? clock() : t(waiting);
    const bubbleTime = $("callBubble")?.querySelector(".ds-call-bubble-time");
    if (bubbleTime) bubbleTime.textContent = connectedAt ? clock() : t(waiting);
    document.body.toggleAttribute("data-call-connected", Boolean(connectedAt) && Boolean(kind));
    document.body.toggleAttribute("data-call-status-echo", Boolean(kind) && echoesStage());
  }

  // Owner 2026-11-23 (a video call with a desktop): "Control panel in video it should hide when the answer should hide
  // from both". On a connected video call the top bar, the status line and the button panel step aside 4 s after the last
  // touch, on both sides of the call (both run this screen). A tap on the video brings them back; a tap on the video while
  // they're on show puts them away. They stay while a sheet or the note box is open, while the call is reconnecting, while
  // "Hear call" waits for a tap, and while a keyboard user is in the panel. Voice calls keep their buttons.
  const CHROME_IDLE_MS = 4000;
  let chromeTimer = 0;
  const chromeHidden = () => document.body.dataset.callChrome === "hidden";
  function chromeMayHide() {
    return callKind() === "video" && Boolean(connectedAt) && document.body.dataset.callLink !== "reconnecting"
      && !$("callSheet") && !document.querySelector(".call-note-sheet:not([hidden])")
      && $("resumeRemoteAudio")?.hidden !== false && !$("mediaControls")?.querySelector(":focus-visible");
  }
  function showChrome() {
    clearTimeout(chromeTimer);
    delete document.body.dataset.callChrome;
    if (callKind() === "video" && connectedAt) chromeTimer = setTimeout(hideChrome, CHROME_IDLE_MS);
  }
  function hideChrome() {
    clearTimeout(chromeTimer);
    if (chromeMayHide()) document.body.dataset.callChrome = "hidden";
    else if (callKind() === "video" && connectedAt) chromeTimer = setTimeout(hideChrome, CHROME_IDLE_MS);
  }
  function resetChrome() { clearTimeout(chromeTimer); delete document.body.dataset.callChrome; }
  function watchChrome(conversation) {
    // Capture, so a tap that only brings the buttons back never also presses one.
    // The click that follows that tap would land on whatever button is now back under the finger (End, for one), so it
    // is swallowed.
    const swallowNextClick = () => {
      const swallow = event => { event.preventDefault(); event.stopPropagation(); };
      conversation.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => conversation.removeEventListener("click", swallow, { capture: true }), 700);
    };
    conversation.addEventListener("pointerdown", event => {
      if (callKind() !== "video" || !connectedAt) return;
      const onVideo = event.target.closest?.(".video-grid") && !event.target.closest(".local-video");
      if (chromeHidden()) { swallowNextClick(); showChrome(); return; }
      if (onVideo && chromeMayHide()) { event.preventDefault(); hideChrome(); return; }
      showChrome();
    }, true);
    document.addEventListener("keydown", () => { if (chromeHidden() || chromeTimer) showChrome(); });
  }

  function build() {
    const conversation = document.querySelector(".conversation"), controls = $("mediaControls"), incoming = $("incomingCall");
    if (built || !conversation || !controls || !$("toggleMic") || !$("hangUp")) return;
    built = true;
    // Top bar.
    const top = document.createElement("div");
    top.className = "ds-call-top";
    const minimiseButton = newButton("callMinimise", "minimize", "Minimise call");
    minimiseButton.classList.add("ds-call-round");
    minimiseButton.addEventListener("click", () => minimise(true));
    const who = document.createElement("div"); who.className = "ds-call-who";
    who.innerHTML = '<strong class="ds-call-name"></strong><span class="ds-call-sub"></span><span class="ds-call-lock"></span>';
    who.querySelector(".ds-call-lock").textContent = t("Encrypted");
    const spacer = document.createElement("span"); spacer.className = "ds-call-spacer"; spacer.setAttribute("aria-hidden", "true");
    top.append(minimiseButton, who, spacer);
    // Middle: photo and state.
    const stage = document.createElement("div"); stage.id = "callStage"; stage.className = "ds-call-stage";
    stage.innerHTML = '<div class="ds-call-photo" aria-hidden="true"></div><p class="ds-call-state" role="status"></p>';
    conversation.prepend(top, stage);
    // Bottom: two rows of three.
    const speaker = newButton("callSpeaker", "volume-2", "Speaker"); speaker.addEventListener("click", speakerAction);
    const more = newButton("callMore", "more", "More"); more.addEventListener("click", moreAction);
    const share = newButton("callShare", "share", "Share"); share.addEventListener("click", shareAction);
    const camera = $("toggleCamera"), mic = $("toggleMic"), end = $("hangUp");
    end.setAttribute("aria-label", t("End call")); end.title = t("End call"); icon(end, "phone");
    const keys = [key(speaker, "Speaker"), key(camera, "Video"), key(mic, "Mute"), key(more, "More"), key(share, "Share"), key(end, "End", "ds-call-key--end")];
    const grid = document.createElement("div"); grid.className = "ds-call-keys";
    grid.append(...keys);
    controls.append(grid);
    controls.classList.add("ds-call-panel");
    // The note button lives in More; Hear call stays a pill above the panel.
    const placeNote = () => { const note = $("callNoteButton"); if (note && note.parentElement !== controls) controls.append(note); };
    placeNote(); new MutationObserver(placeNote).observe(controls, { childList: true });
    // The bubble that brings a minimised call back.
    const bubble = document.createElement("button");
    bubble.type = "button"; bubble.id = "callBubble"; bubble.className = "ds-call-bubble"; bubble.hidden = true;
    bubble.setAttribute("aria-label", t("Back to the call"));
    bubble.dataset.iconLayout = "label";
    bubble.innerHTML = '<span class="ds-call-photo" aria-hidden="true"></span><span class="ds-call-bubble-time"></span>';
    bubble.addEventListener("click", () => minimise(false));
    document.body.append(bubble);
    // Incoming: the same top and photo, Decline / Accept at the bottom.
    if (incoming && !incoming.querySelector(".ds-call-top")) {
      const incomingTop = top.cloneNode(true);
      const slot = document.createElement("span"); slot.className = "ds-call-spacer"; slot.setAttribute("aria-hidden", "true");
      incomingTop.querySelector("#callMinimise")?.replaceWith(slot); // nothing to minimise before answering; the name stays centred
      incomingTop.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));
      incoming.prepend(incomingTop);
      incoming.classList.add("ds-call-incoming");
      incoming.querySelector(".sync-call-avatar")?.classList.add("ds-call-photo");
      const ringing = document.createElement("p"); ringing.className = "ds-call-incoming-state"; ringing.textContent = t("Incoming call");
      incoming.querySelector(".sync-call-avatar")?.after(ringing);
      const decline = $("declineCall"), accept = $("acceptCall"), actions = incoming.querySelector(".call-actions");
      if (decline && accept && actions) {
        icon(decline, "phone"); icon(accept, "phone");
        actions.replaceChildren(key(decline, "Decline", "ds-call-key--end"), key(accept, "Accept"));
      }
    }
    // State: call mode on/off, connection, track changes. A call that ends while minimised clears the bubble.
    new MutationObserver(() => {
      if (!callKind() && !document.body.dataset.callMinimised) { connectedAt = 0; $("callSheet")?.remove(); }
      if (callKind() !== "video") resetChrome();
      paintWho(); paintState(); refreshKeys(); requestAnimationFrame(fitPanel);
    }).observe(document.body, { attributes: true, attributeFilter: ["data-call-mode", "data-sync-screen", "data-call-reach"] });
    // The link dropping brings the buttons and "Reconnecting…" back on show.
    new MutationObserver(() => { if (document.body.dataset.callLink === "reconnecting" && chromeHidden()) showChrome(); })
      .observe(document.body, { attributes: true, attributeFilter: ["data-call-link"] });
    watchChrome(conversation);
    window.addEventListener("resize", () => requestAnimationFrame(fitPanel));
    new MutationObserver(() => {
      requestAnimationFrame(fitPanel);
      if (!controls.hidden) return;
      connectedAt = 0; resetChrome(); delete document.body.dataset.callMinimised; $("callBubble").hidden = true; $("callSheet")?.remove(); paintState();
    }).observe(controls, { attributes: true, attributeFilter: ["hidden"] });
    window.addEventListener("danzstak:remote-media", () => { if (!connectedAt) { connectedAt = Date.now(); showChrome(); } paintWho(); paintState(); });
    for (const button of [mic, camera, $("toggleRingback")]) button?.addEventListener("click", () => setTimeout(refreshKeys));
    new MutationObserver(refreshKeys).observe($("toggleRingback") || controls, { attributes: true, attributeFilter: ["hidden", "aria-pressed"] });
    setInterval(() => { if (callKind() && connectedAt) paintState(); }, 1000);
    if ($("callStatus")) new MutationObserver(paintState).observe($("callStatus"), { childList: true, characterData: true, subtree: true });
    // A tap focuses End (chat.js moves focus there for keyboards and screen readers); only a keyboard shows the ring.
    document.addEventListener("pointerdown", () => { document.documentElement.dataset.callPointer = "1"; }, true);
    document.addEventListener("keydown", () => { delete document.documentElement.dataset.callPointer; }, true);
    paintWho(); paintState(); refreshKeys();
  }
  window.danzstakCallScreen = Object.freeze({ refresh: () => { paintWho(); paintState(); refreshKeys(); } });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build, { once: true }); else build();
})();
