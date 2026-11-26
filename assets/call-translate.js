"use strict";
// Task 21, step 1: live translated captions in SYNC calls (owner 2026-11-25: "my cousin who speaks French to be able to
// talk in french and shows up on my side in English"; "I understand many languages but not perfect conversational
// language", so every caption keeps the speaker's own words, small, under the translation).
// - More → Live translation: pick your language, Start. The other person is asked first ("allow your voice to be
//   translated?"); nothing leaves either phone until they allow it. Then each phone streams only its OWN microphone to
//   Amazon Transcribe (signed address from the Auth API, call-translate.mjs) and sends the words over the call's own
//   data channel. The other phone translates them into its language (Amazon Translate) and shows them as captions that
//   roll like a teleprompter above the call buttons. On a video call the video keeps the whole screen and the captions
//   are subtitles over its bottom edge (owner 2026-11-25: "Still need to make the video visible as well").
// - Either person can stop it (✕ on the captions, or More → Stop live translation); it stops on both phones at once.
// - Muting the call mutes the captions too (a muted microphone sends silence).
// - Nothing is stored. Free for testers for now: today's minutes per account come from the server.
(() => {
  const API = "https://api.danzstak.com";
  const t = value => window.danzstakTranslate?.(value) || value;
  const tf = (value, values) => t(value).replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
  const STORE = "danzstak_call_translate_language";
  const PARTIAL_SEND_MS = 250, PARTIAL_TRANSLATE_MS = 900, MAX_LINES = 3, MAX_TEXT = 500;

  let languages = null, myLang = "", partnerLang = "", partnerName = "", on = false, asked = false;
  let socket = null, audio = null, minuteTimer = null, reconnects = 0, band = null, sheet = null, prompt = null;
  const lines = new Map(), sentAt = new Map(), translateTimers = new Map(), translateSeq = new Map();

  // ---------- AWS event stream (the framing Transcribe streaming speaks over its WebSocket) ----------
  const CRC_TABLE = (() => { const table = new Uint32Array(256); for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; } return table; })();
  function crc32(bytes) { let crc = 0xffffffff; for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
  const utf8 = new TextEncoder(), fromUtf8 = new TextDecoder();
  function encodeEvent(headers, payload) {
    const parts = [];
    for (const [name, value] of Object.entries(headers)) {
      const n = utf8.encode(name), v = utf8.encode(value), part = new Uint8Array(1 + n.length + 1 + 2 + v.length);
      part[0] = n.length; part.set(n, 1); part[1 + n.length] = 7; new DataView(part.buffer).setUint16(2 + n.length, v.length); part.set(v, 4 + n.length);
      parts.push(part);
    }
    const headerLength = parts.reduce((sum, part) => sum + part.length, 0), body = payload instanceof Uint8Array ? payload : new Uint8Array(payload || 0);
    const total = 12 + headerLength + body.length + 4, out = new Uint8Array(total), view = new DataView(out.buffer);
    view.setUint32(0, total); view.setUint32(4, headerLength); view.setUint32(8, crc32(out.subarray(0, 8)));
    let offset = 12; for (const part of parts) { out.set(part, offset); offset += part.length; }
    out.set(body, offset); view.setUint32(total - 4, crc32(out.subarray(0, total - 4)));
    return out;
  }
  function decodeEvent(buffer) {
    const bytes = new Uint8Array(buffer), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const total = view.getUint32(0), headerLength = view.getUint32(4), headers = {};
    if (total !== bytes.length || crc32(bytes.subarray(0, 8)) !== view.getUint32(8) || crc32(bytes.subarray(0, total - 4)) !== view.getUint32(total - 4)) throw new Error("Bad event");
    let offset = 12;
    while (offset < 12 + headerLength) {
      const nameLength = bytes[offset]; const name = fromUtf8.decode(bytes.subarray(offset + 1, offset + 1 + nameLength)); offset += 1 + nameLength;
      const type = bytes[offset]; offset += 1;
      if (type === 7 || type === 6) { const length = view.getUint16(offset); const value = bytes.subarray(offset + 2, offset + 2 + length); headers[name] = type === 7 ? fromUtf8.decode(value) : value; offset += 2 + length; }
      else offset += ({ 0: 0, 1: 0, 2: 1, 3: 2, 4: 4, 5: 8, 8: 8, 9: 16 })[type] ?? 0;
    }
    return { headers, payload: bytes.subarray(12 + headerLength, total - 4) };
  }
  const audioEvent = pcm => encodeEvent({ ":content-type": "application/octet-stream", ":event-type": "AudioEvent", ":message-type": "event" }, pcm);

  // ---------- helpers ----------
  function liveChannel() { try { return typeof channel !== "undefined" && channel && channel.readyState === "open" ? channel : null; } catch { return null; } } // eslint-disable-line no-undef
  function callStream() { try { return typeof stream !== "undefined" ? stream : null; } catch { return null; } } // eslint-disable-line no-undef
  function tell(message) { try { liveChannel()?.send(JSON.stringify(message)); return true; } catch { return false; } }
  async function api(path, body) {
    const response = await fetch(API + path, body ? { method: "POST", credentials: "include", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { credentials: "include", cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || "Live translation isn't available right now."), { status: response.status, code: data.code || "" });
    return data;
  }
  const appLanguage = () => String(document.documentElement.lang || navigator.language || "en").toLowerCase().split(/[-_]/)[0];
  function rememberedLanguage() { try { return localStorage.getItem(STORE) || ""; } catch { return ""; } }
  function languageInfo(code) { return (languages || []).find(language => language.code === code) || null; }
  function pickDefault() {
    const want = [rememberedLanguage(), appLanguage(), "en"];
    return want.find(code => languageInfo(code)) || languages?.[0]?.code || "en";
  }
  async function loadLanguages() {
    if (languages) return languages;
    const data = await api("/call-translate");
    languages = data.languages || [];
    return languages;
  }
  function select(id, value) {
    const box = document.createElement("select"); box.id = id; box.className = "call-translate-select";
    for (const language of languages || []) box.append(new Option(language.label, language.code, false, language.code === value));
    box.setAttribute("aria-label", t("Your language"));
    return box;
  }
  function rememberLanguage(code) { try { localStorage.setItem(STORE, code); } catch { /* private mode */ } }
  function stage() { return document.querySelector(".call-panel, #videoGrid")?.parentElement || document.body; }

  // ---------- the captions band ----------
  function showBand() {
    if (band?.isConnected) return band;
    band = document.createElement("section");
    band.className = "call-captions"; band.setAttribute("aria-live", "polite"); band.setAttribute("aria-label", t("Live translation"));
    const head = document.createElement("div"); head.className = "call-captions-head";
    const label = document.createElement("span"); label.className = "call-captions-label";
    const stop = document.createElement("button"); stop.type = "button"; stop.className = "call-captions-stop"; stop.dataset.iconLayout = "label";
    stop.setAttribute("aria-label", t("Stop live translation")); stop.textContent = "✕";
    stop.addEventListener("click", () => stopAll(true));
    head.append(label, stop);
    const list = document.createElement("div"); list.className = "call-captions-lines";
    band.append(head, list);
    stage().appendChild(band);
    paintLabel(); fit();
    return band;
  }
  function paintLabel(text = "") {
    const label = band?.querySelector(".call-captions-label");
    if (!label) return;
    const from = partnerLang.toUpperCase(), to = myLang.toUpperCase();
    label.textContent = text || (from && to ? tf("Live translation · {from} → {to}", { from, to }) : t("Live translation"));
  }
  function setNotice(text) {
    showBand(); paintLabel(text);
  }
  function fit() {
    const body = document.body;
    if (!band?.isConnected) { body.style.removeProperty("--call-caption-h"); delete body.dataset.callCaptions; return; }
    body.dataset.callCaptions = "on";
    // Not --call-subtitle-band: that one lifts the call panel itself (sync-call-ui.css) and would push it under the band.
    // The video never shrinks for captions; only a call note moves up to stay clear of them.
    body.style.setProperty("--call-caption-h", `${Math.ceil(band.getBoundingClientRect().height + 8)}px`);
  }
  window.addEventListener("resize", () => { if (band) fit(); });
  function paintLine(line) {
    const rtl = Boolean(languageInfo(myLang)?.rtl), rtlOriginal = Boolean(languageInfo(line.lang)?.rtl);
    const main = line.el.querySelector(".call-caption-text"), small = line.el.querySelector(".call-caption-original");
    const translated = line.lang === myLang ? line.original : line.translated;
    main.textContent = translated || line.original; main.dir = translated ? (rtl ? "rtl" : "ltr") : (rtlOriginal ? "rtl" : "ltr");
    main.classList.toggle("is-waiting", !translated);
    small.textContent = line.lang === myLang || !translated ? "" : line.original; small.dir = rtlOriginal ? "rtl" : "ltr";
    line.el.classList.toggle("is-partial", !line.final);
    fit(); // the band grows when the translation and the original line arrive
  }
  function addOrUpdate(id, text, final, lang) {
    const list = showBand().querySelector(".call-captions-lines");
    let line = lines.get(id);
    if (!line) {
      const el = document.createElement("p"); el.className = "call-caption";
      el.innerHTML = '<span class="call-caption-text"></span><small class="call-caption-original"></small>';
      el.querySelectorAll("span,small").forEach(node => { node.setAttribute("translate", "no"); node.dataset.noTranslate = ""; });
      line = { id, el, original: "", translated: "", final: false, lang };
      lines.set(id, line); list.append(el);
      while (lines.size > MAX_LINES * 2) { const [oldest] = lines.keys(); lines.get(oldest)?.el.remove(); lines.delete(oldest); clearTimeout(translateTimers.get(oldest)); translateTimers.delete(oldest); }
    }
    if (line.final && !final) return;
    line.original = text; line.final = final; line.lang = lang;
    paintLine(line);
    list.scrollTop = list.scrollHeight;
    fit();
    if (lang === myLang) return;
    clearTimeout(translateTimers.get(id));
    if (final) translateLine(line);
    else translateTimers.set(id, setTimeout(() => translateLine(line), line.translated ? PARTIAL_TRANSLATE_MS : 250));
  }
  async function translateLine(line) {
    translateTimers.delete(line.id);
    const seq = (translateSeq.get(line.id) || 0) + 1; translateSeq.set(line.id, seq);
    const text = line.original;
    try {
      const data = await api("/call-translate/text", { texts: [text], from: line.lang, to: myLang });
      if (translateSeq.get(line.id) !== seq || !lines.has(line.id)) return;
      line.translated = String(data.texts?.[0] || "");
      paintLine(line);
    } catch (error) {
      if (error.code === "minutes") { stopAll(true, "minutes"); return; }
      if (line.final) { line.translated = ""; paintLine(line); }
    }
  }

  // ---------- my own microphone → Transcribe ----------
  async function prepareAudio() {
    if (audio) { await audio.context.resume?.().catch(() => {}); return audio; }
    const context = new (window.AudioContext || window.webkitAudioContext)();
    await context.resume?.().catch(() => {});
    audio = { context, node: null, source: null, track: null };
    return audio;
  }
  async function connectMic() {
    const track = callStream()?.getAudioTracks?.()[0];
    if (!track) throw new Error(t("Live translation needs your microphone in the call."));
    const { context } = await prepareAudio();
    if (audio.track === track && audio.node) return;
    audio.source?.disconnect(); audio.node?.disconnect();
    audio.track = track;
    audio.source = context.createMediaStreamSource(new MediaStream([track]));
    const send = buffer => { if (socket?.readyState === WebSocket.OPEN) socket.send(audioEvent(new Uint8Array(buffer))); };
    // The worklet keeps the 16 kHz conversion off the page's thread. Some browsers (Edge on a computer without a sound card,
    // seen in CI) never finish loading it, so after 3 s the same conversion runs on the page instead.
    if (context.audioWorklet && audio.worklet !== "failed" && !audio.worklet) {
      const loaded = context.audioWorklet.addModule(new URL("assets/call-translate-worklet.js?v=1", document.baseURI).href).then(() => true, () => false);
      audio.worklet = await Promise.race([loaded, new Promise(resolve => setTimeout(() => resolve(false), 3000))]) ? true : "failed";
    }
    if (audio.worklet === true) {
      audio.node = new AudioWorkletNode(context, "danzstak-pcm16");
      audio.node.port.onmessage = event => send(event.data);
      audio.source.connect(audio.node);
    } else {
      // Older browsers: the same 16 kHz conversion on the page.
      const node = context.createScriptProcessor(4096, 1, 1), ratio = context.sampleRate / 16000;
      let step = 0, sum = 0, count = 0, out = new Int16Array(1600), filled = 0;
      node.onaudioprocess = event => {
        const input = event.inputBuffer.getChannelData(0);
        for (let i = 0; i < input.length; i += 1) {
          sum += input[i]; count += 1; step += 1;
          if (step < ratio) continue;
          step -= ratio; const value = Math.max(-1, Math.min(1, sum / count)); sum = 0; count = 0;
          out[filled++] = value < 0 ? value * 0x8000 : value * 0x7fff;
          if (filled === out.length) { send(out.buffer); out = new Int16Array(1600); filled = 0; }
        }
      };
      const sink = context.createGain(); sink.gain.value = 0; // the processor only runs when connected to the output
      audio.source.connect(node); node.connect(sink); sink.connect(context.destination);
      audio.node = node;
    }
  }
  async function openStream() {
    const data = await api("/call-translate/stream", { language: myLang });
    await connectMic();
    socket = new WebSocket(data.url);
    socket.binaryType = "arraybuffer";
    const mine = socket;
    socket.addEventListener("open", () => { reconnects = 0; });
    socket.addEventListener("message", event => { if (mine === socket) heard(event.data); });
    socket.addEventListener("close", () => {
      if (mine !== socket || !on) return;
      socket = null;
      // Transcribe ends a stream that stays silent too long; open a new one while translation is on.
      if (reconnects++ < 5) setTimeout(() => { if (on && !socket) openStream().catch(failed); }, 600);
      else failed(new Error(t("Live translation stopped. Try again.")));
    });
  }
  function heard(data) {
    let message;
    try { message = decodeEvent(data); } catch { return; }
    if (message.headers[":message-type"] === "exception") { failed(new Error(t("Live translation stopped. Try again."))); return; }
    if (message.headers[":event-type"] !== "TranscriptEvent") return;
    let json; try { json = JSON.parse(fromUtf8.decode(message.payload)); } catch { return; }
    for (const result of json?.Transcript?.Results || []) {
      const text = String(result.Alternatives?.[0]?.Transcript || "").trim().slice(0, MAX_TEXT), id = String(result.ResultId || "").slice(0, 64);
      if (!text || !id) continue;
      const final = result.IsPartial === false, last = sentAt.get(id) || 0;
      if (!final && Date.now() - last < PARTIAL_SEND_MS) continue;
      sentAt.set(id, Date.now());
      if (final) sentAt.delete(id);
      tell({ type: "call-translate-text", id, text, final, lang: myLang });
    }
  }
  function failed(error) {
    if (!on) return;
    stopLocal();
    setNotice(error?.message || t("Live translation stopped. Try again."));
  }
  async function startMine() {
    on = true; reconnects = 0; showBand(); paintLabel();
    try { await openStream(); }
    catch (error) {
      if (error.code === "minutes") { stopAll(true, "minutes"); return; }
      failed(error); tell({ type: "call-translate-stop", reason: "error" }); return;
    }
    clearInterval(minuteTimer);
    minuteTimer = setInterval(async () => {
      try { await api("/call-translate/minute", {}); }
      catch (error) { if (error.code === "minutes") stopAll(true, "minutes"); }
    }, 60000);
  }
  function stopLocal() {
    on = false; asked = false;
    clearInterval(minuteTimer); minuteTimer = null;
    const old = socket; socket = null;
    try { if (old?.readyState === WebSocket.OPEN) old.send(audioEvent(new Uint8Array(0))); } catch { /* closing anyway */ }
    try { old?.close(); } catch { /* already closed */ }
    try { audio?.source?.disconnect(); audio?.node?.disconnect(); } catch { /* gone */ }
    if (audio) { audio.source = null; audio.node = null; audio.track = null; }
  }
  function stopAll(notify = true, reason = "") {
    if (notify) tell({ type: "call-translate-stop", reason });
    stopLocal();
    if (reason === "minutes") { setNotice(t("Today's free translation minutes are used up. They come back tomorrow.")); setTimeout(hideBand, 6000); return; }
    hideBand();
  }
  function hideBand() {
    for (const timer of translateTimers.values()) clearTimeout(timer);
    translateTimers.clear(); lines.clear(); sentAt.clear();
    band?.remove(); band = null; fit();
  }

  // ---------- asking, allowing ----------
  function closeSheet() { sheet?.remove(); sheet = null; }
  function closePrompt() { prompt?.remove(); prompt = null; }
  async function openStart() {
    closeSheet();
    sheet = document.createElement("form"); sheet.className = "call-translate-sheet"; sheet.setAttribute("aria-label", t("Live translation"));
    const title = document.createElement("strong"); title.textContent = t("Live translation");
    const note = document.createElement("p"); note.textContent = tf("{name}'s words show up here as captions in your language. They're asked first.", { name: firstName() });
    const status = document.createElement("p"); status.className = "call-translate-status"; status.setAttribute("role", "status");
    sheet.append(title, note, status);
    stage().appendChild(sheet);
    try { await loadLanguages(); }
    catch (error) { status.textContent = error.status === 401 ? t("Sign in again to use live translation.") : t("Live translation isn't available right now."); addClose(sheet, closeSheet); return; }
    const label = document.createElement("label"); label.className = "call-translate-field"; label.textContent = t("Your language");
    const box = select("callTranslateLanguage", pickDefault()); label.append(box);
    const row = document.createElement("div"); row.className = "call-translate-row";
    const cancel = document.createElement("button"); cancel.type = "button"; cancel.className = "call-translate-quiet"; cancel.dataset.iconLayout = "label"; cancel.textContent = t("Cancel");
    const go = document.createElement("button"); go.type = "submit"; go.className = "call-translate-go"; go.dataset.iconLayout = "label"; go.textContent = t("Start");
    cancel.addEventListener("click", closeSheet);
    row.append(cancel, go);
    sheet.insertBefore(label, status); sheet.append(row);
    sheet.addEventListener("submit", async event => {
      event.preventDefault();
      if (!liveChannel()) { status.textContent = t("Wait until the call is connected."); return; }
      myLang = box.value; rememberLanguage(myLang);
      await prepareAudio().catch(() => {}); // unlocked by this tap, used once they allow
      asked = true;
      tell({ type: "call-translate-ask", lang: myLang });
      closeSheet();
      setNotice(tf("Waiting for {name} to allow live translation…", { name: firstName() }));
    });
    box.focus();
  }
  function addClose(node, close) {
    const button = document.createElement("button"); button.type = "button"; button.className = "call-translate-quiet"; button.dataset.iconLayout = "label"; button.textContent = t("Close");
    button.addEventListener("click", close); node.append(button);
  }
  async function openPrompt(theirLang) {
    closePrompt();
    try { await loadLanguages(); } catch { tell({ type: "call-translate-no", reason: "unavailable" }); return; }
    prompt = document.createElement("form"); prompt.className = "call-translate-sheet is-prompt"; prompt.setAttribute("role", "alertdialog"); prompt.setAttribute("aria-label", t("Live translation"));
    const title = document.createElement("strong"); title.textContent = tf("{name} turned on live translation", { name: firstName() });
    const note = document.createElement("p"); note.textContent = t("Allow your voice to be turned into captions in their language? Machine translation can be wrong. Double-check prices, dates and deals in writing.");
    const label = document.createElement("label"); label.className = "call-translate-field"; label.textContent = t("You speak");
    const box = select("callTranslateMine", pickDefault()); label.append(box);
    const row = document.createElement("div"); row.className = "call-translate-row";
    const no = document.createElement("button"); no.type = "button"; no.className = "call-translate-quiet"; no.dataset.iconLayout = "label"; no.textContent = t("Not now");
    const yes = document.createElement("button"); yes.type = "submit"; yes.className = "call-translate-go"; yes.dataset.iconLayout = "label"; yes.textContent = t("Allow");
    no.addEventListener("click", () => { tell({ type: "call-translate-no" }); closePrompt(); });
    row.append(no, yes);
    prompt.append(title, note, label, row);
    prompt.addEventListener("submit", async event => {
      event.preventDefault();
      myLang = box.value; rememberLanguage(myLang); partnerLang = theirLang;
      await prepareAudio().catch(() => {});
      closePrompt();
      tell({ type: "call-translate-ok", lang: myLang });
      startMine();
    });
    stage().appendChild(prompt);
    yes.focus();
  }
  // The person on the call: the name they sent, else the chat's own (chat.js contactName, the name on the call screen).
  function callName() { try { if (typeof contactName !== "undefined" && contactName) return String(contactName); } catch { /* not on SYNC's page */ } return document.getElementById("conversationName")?.textContent?.trim() || ""; } // eslint-disable-line no-undef
  function firstName() { return String(partnerName || callName() || "").split(/\s+/)[0] || t("The other person"); }

  // ---------- messages from the other phone (chat.js hands every {"type":"call-translate… here) ----------
  function receive(raw, senderName = "") {
    let message; try { message = JSON.parse(raw); } catch { return false; }
    if (!message || typeof message.type !== "string" || !message.type.startsWith("call-translate")) return false;
    partnerName = senderName || partnerName;
    const lang = String(message.lang || "").toLowerCase().slice(0, 5);
    if (message.type === "call-translate-ask") { if (!on) openPrompt(lang); return true; }
    if (message.type === "call-translate-ok") { if (asked && !on) { partnerLang = lang; startMine(); } return true; }
    if (message.type === "call-translate-no") { asked = false; setNotice(tf("{name} said not now.", { name: firstName() })); setTimeout(() => { if (!on) hideBand(); }, 4000); return true; }
    if (message.type === "call-translate-stop") {
      const wasOn = on || band;
      closePrompt(); stopLocal(); hideBand();
      if (wasOn && message.reason === "minutes") { setNotice(tf("{name}'s free translation minutes are used up for today.", { name: firstName() })); setTimeout(hideBand, 6000); }
      return true;
    }
    if (message.type === "call-translate-text") {
      if (!on) return true; // nothing shows unless both allowed
      const text = String(message.text || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, MAX_TEXT), id = String(message.id || "").slice(0, 64);
      if (!text || !id || !languageInfo(lang)) return true;
      partnerLang = lang; paintLabel();
      addOrUpdate(id, text, message.final === true, lang);
      return true;
    }
    return true;
  }

  // More → Live translation / Stop live translation (sync-call-ui.js).
  function menuItem() {
    if (on || asked) return { label: "Stop live translation", run: () => stopAll(true) };
    return { label: "Live translation", run: openStart };
  }
  function reset() { closeSheet(); closePrompt(); stopLocal(); hideBand(); partnerLang = ""; try { audio?.context?.close(); } catch { /* closed */ } audio = null; }
  function watch() {
    const controls = document.getElementById("mediaControls");
    if (controls) new MutationObserver(() => { if (controls.hidden) reset(); }).observe(controls, { attributes: true, attributeFilter: ["hidden"] });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch, { once: true }); else watch();
  window.danzstakCallTranslate = Object.freeze({ receive, menuItem, reset, isOn: () => on, _audioState: () => ({ state: audio?.context?.state || "", rate: audio?.context?.sampleRate || 0, worklet: Boolean(audio?.worklet), node: Boolean(audio?.node), track: audio?.track?.readyState || "", socket: socket?.readyState ?? -1 }), _eventStream: { encodeEvent, decodeEvent, crc32 } });
})();
