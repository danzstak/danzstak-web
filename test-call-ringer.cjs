"use strict";
// Queue 5a00, spec docs/tasks/31-call-ringer.md: incoming SYNC calls must ring.
// Real-browser check: browser-checks/call-ringer.cjs. Handset results need the owner's two real phones.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");

const read = file => fs.readFileSync(file, "utf8");
const ringerSource = read("assets/call-ringer.js"), alertsSource = read("assets/call-alerts.js"), tonesSource = read("assets/sync-tones.js");
const chat = read("assets/chat.js"), incoming = read("assets/incoming-calls.js"), worker = read("service-worker.js");
const template = read("infrastructure/call-signaling/template.yaml"), push = read("assets/push-notifications.js"), i18n = read("assets/i18n-sync.js");
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

// ---------- A small fake browser with a manual clock ----------
function fakeBrowser({ playAllowed = () => true, contextStartsRunning = false, resumeWorks = () => true } = {}) {
  let clock = 1_000_000, nextId = 1;
  const timers = new Map(), listeners = new Map(), windowListeners = new Map(), vibrations = [], posted = [], played = [];
  const schedule = (fn, ms, repeat) => { const id = nextId++; timers.set(id, { fn, at: clock + Math.max(0, ms), every: repeat ? Math.max(1, ms) : 0 }); return id; };
  const clear = id => timers.delete(id);
  async function advance(ms) {
    const end = clock + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      const [id, timer] = due; clock = timer.at;
      if (timer.every) timer.at += timer.every; else timers.delete(id);
      timer.fn(); await flush();
    }
    clock = end; await flush();
  }
  class Element {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.attributes = {}; this.hidden = false; this.textContent = ""; this.className = ""; this.parent = null; this.handlers = {}; this.classes = new Set(); const self = this; this.classList = { add: c => self.classes.add(c), remove: c => self.classes.delete(c), toggle: (c, on) => (on ? self.classes.add(c) : self.classes.delete(c)), contains: c => self.classes.has(c) }; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
    before(node) { const list = this.parent.children; node.parent = this.parent; list.splice(list.indexOf(this), 0, node); }
    remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
    addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
    click() { for (const fn of this.handlers.click || []) fn({ type: "click" }); }
    matches(selector) { return selector.split(",").map(part => part.trim()).some(part => part.startsWith(".") ? this.className.split(/\s+/).includes(part.slice(1)) || this.classes.has(part.slice(1)) : part.startsWith("[") ? part.slice(1, -1) in this.attributes : false); }
    querySelector(selector) { for (const child of this.children) { if (child.matches(selector)) return child; const found = child.querySelector(selector); if (found) return found; } return null; }
  }
  const document = {
    hidden: false, body: new Element("body"),
    createElement: tag => new Element(tag),
    addEventListener: (type, fn) => (listeners.get(type) || listeners.set(type, []).get(type)).push(fn),
    querySelector: selector => document.body.querySelector(selector)
  };
  const media = [];
  class Audio {
    constructor() { this.paused = true; this.muted = false; this.loop = false; this.volume = 1; this.currentTime = 0; this.src = ""; this.attributes = {}; media.push(this); }
    setAttribute(name, value) { this.attributes[name] = value; }
    play() { if (!playAllowed()) return Promise.reject(Object.assign(new Error("blocked"), { name: "NotAllowedError" })); this.paused = false; played.push({ src: this.src, muted: this.muted }); return Promise.resolve(); }
    pause() { this.paused = true; }
  }
  const contexts = [];
  class AudioContext { constructor() { this.state = contextStartsRunning ? "running" : "suspended"; contexts.push(this); } resume() { if (resumeWorks()) this.state = "running"; return Promise.resolve(); } }
  const tonePlays = [];
  const tones = {
    toneFor: () => "classic", vibrates: () => true,
    pattern: id => id === "classic" ? { period: 1, notes: [[0, 0.2, 440, "sine", 0.9], [0.3, 0.1, 9000, "noise", 0.3], [0.5, 0.2, 220, "square", 0.5, 330]] } : null,
    play: (id, options) => { const handle = { id, options, stopped: false, stop() { this.stopped = true; } }; tonePlays.push(handle); return handle; }
  };
  const window = {
    AudioContext, danzstakSyncTones: tones, danzstakTranslate: null, danzstakCallSetup: { ringVolume: () => 0.4 },
    addEventListener: (type, fn) => (windowListeners.get(type) || windowListeners.set(type, []).get(type)).push(fn),
    dispatchEvent: event => { for (const fn of windowListeners.get(event.type) || []) fn(event); return true; }
  };
  window.window = window;
  const navigator = { vibrate: pattern => { vibrations.push(pattern); return true; }, serviceWorker: { controller: { postMessage: message => posted.push(message) } } };
  const blobs = [];
  const sandbox = {
    window, document, navigator, Audio, Blob: class { constructor(parts, options) { this.parts = parts; this.type = options?.type; blobs.push(this); } },
    URL: { createObjectURL: blob => `blob:ringer-${blobs.indexOf(blob)}` }, globalThis: null,
    setTimeout: (fn, ms) => schedule(fn, ms, false), clearTimeout: clear, setInterval: (fn, ms) => schedule(fn, ms, true), clearInterval: clear,
    Date: class extends Date { static now() { return clock; } },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    Math, Promise, Uint8Array, Float32Array, DataView, String, Number, Object, Array, Error
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(ringerSource, sandbox);
  const fire = (type, event = { type }) => { for (const fn of listeners.get(type) || []) fn(event); };
  return { sandbox, window, document, navigator, media, contexts, tonePlays, vibrations, posted, played, blobs, listeners, timers, advance, fire, Element, clock: () => clock };
}

(async () => {
  // ---------- 1. <audio> first: rings without a prior tap when the phone allows it, vibrates, stops on every state ----------
  {
    const b = fakeBrowser();
    const ringer = b.window.danzstakCallRinger;
    const surface = new b.Element("section");
    const handle = ringer.start({ contact: "friend@example.test", durationMs: 25000, surface });
    await b.advance(0);
    assert.equal(ringer.state(), "audio", "the <audio> ringtone plays first");
    const player = b.media[0];
    assert.equal(player.paused, false); assert.equal(player.loop, true, "the ringtone loops");
    assert.match(player.src, /^blob:ringer-/, "the member's tone is rendered in memory (no audio file)");
    assert.equal(b.blobs[0].type, "audio/wav");
    assert.deepEqual([...b.vibrations[0]], [600, 300, 600, 300, 600], "spec vibration pattern");
    await b.advance(3000);
    assert.ok(b.vibrations.length >= 2, "vibration repeats while ringing");
    handle.stop();
    assert.equal(ringer.state(), "idle"); assert.equal(player.paused, true, "answer/decline stop the ringtone at once");
    assert.deepEqual(b.vibrations.at(-1), 0, "and the vibration");
    assert.equal(b.timers.size, 0, "no timers left behind");
    // A ring that nobody answers stops by itself.
    ringer.start({ durationMs: 25000 }); await b.advance(0);
    await b.advance(25001);
    assert.equal(ringer.state(), "idle", "the ring times out"); assert.equal(player.paused, true);
    // Starting a new ring replaces the old one: one ringer at a time.
    ringer.start({ durationMs: 5000 }); await b.advance(0); const first = ringer.state();
    ringer.start({ durationMs: 5000 }); await b.advance(0);
    assert.equal(first, "audio"); assert.equal(b.media.length, 1, "one shared <audio> element");
    ringer.stop();
    // The render is a real looping WAV of at least 3 s.
    const wav = ringer.renderWav({ period: 1, notes: [[0, 0.2, 440, "sine", 0.9]] }, { rate: 8000, minSeconds: 3 });
    const text = (offset, length) => String.fromCharCode(...wav.slice(offset, offset + length));
    assert.equal(text(0, 4), "RIFF"); assert.equal(text(8, 4), "WAVE"); assert.equal(text(36, 4), "data");
    const view = new DataView(wav.buffer);
    assert.equal(view.getUint32(24, true), 8000); assert.equal(view.getUint32(40, true), 3 * 8000 * 2, "three loops of one second");
    let peak = 0; for (let i = 44; i < wav.length; i += 2) peak = Math.max(peak, Math.abs(view.getInt16(i, true)));
    assert.ok(peak > 20000, "loud enough to hear");
    // handled(): the service worker closes that call's notification.
    ringer.handled("11111111-1111-4111-8111-111111111111"); ringer.handled("not-a-call");
    assert.deepEqual(b.posted.map(m => ({ ...m })), [{ type: "DANZSTAK_CALL_HANDLED", callId: "11111111-1111-4111-8111-111111111111" }]);
  }

  // ---------- 2. <audio> blocked → Web Audio ----------
  {
    const b = fakeBrowser({ playAllowed: () => false, resumeWorks: () => true });
    const ringer = b.window.danzstakCallRinger;
    const given = new b.window.AudioContext();
    ringer.start({ contact: "a@b.test", durationMs: 20000, audioContext: given });
    await b.advance(0);
    assert.equal(ringer.state(), "webaudio", "Web Audio is the fallback");
    assert.equal(b.tonePlays.length, 1); assert.equal(b.tonePlays[0].options.audio, given, "uses the page's own audio context");
    assert.equal(b.tonePlays[0].options.loop, true);
    ringer.stop();
    assert.equal(b.tonePlays[0].stopped, true, "stop() stops the Web Audio tone too");
  }

  // ---------- 3. both blocked → visual "Tap to hear the ringer"; one tap rings ----------
  {
    let activated = false;
    const b = fakeBrowser({ playAllowed: () => activated, resumeWorks: () => activated });
    const ringer = b.window.danzstakCallRinger;
    const surface = new b.Element("section"), actions = new b.Element("div"); actions.className = "call-actions"; surface.append(actions);
    ringer.start({ durationMs: 25000, surface });
    await b.advance(1000);
    assert.equal(ringer.state(), "blocked");
    assert.ok(surface.classes.has("call-ringer-needs-tap"), "the call screen pulses");
    const tap = surface.querySelector(".call-ringer-tap");
    assert.ok(tap && tap.hidden === false, "Tap to hear the ringer is shown");
    assert.equal(tap.textContent, "Tap to hear the ringer");
    assert.equal(surface.children.indexOf(tap), surface.children.indexOf(actions) - 1, "placed right above Answer/Decline");
    activated = true; // the member's tap is a user activation
    b.fire("click");
    await b.advance(0);
    assert.equal(ringer.state(), "audio", "after one tap the <audio> ringtone plays");
    assert.equal(tap.hidden, true); assert.equal(surface.classes.has("call-ringer-needs-tap"), false);
    ringer.stop();
  }

  // ---------- 4. unlock on the first gesture (touch-safe events) and again on visibilitychange ----------
  {
    let activated = false;
    const b = fakeBrowser({ playAllowed: () => activated, resumeWorks: () => activated });
    for (const type of ["pointerup", "touchend", "click", "keydown"]) assert.ok((b.listeners.get(type) || []).length, `unlocks on ${type}`);
    assert.ok(!(b.listeners.get("pointerdown") || []).length, "pointerdown is not a user activation on touch screens");
    activated = true;
    b.fire("pointerup"); await b.advance(0);
    assert.equal(b.played.length, 1, "the first tap primes the <audio> element"); assert.equal(b.played[0].muted, true, "silently");
    assert.equal(b.media[0].paused, true, "and pauses it again"); assert.equal(b.media[0].muted, false);
    assert.equal(b.contexts[0].state, "running", "Web Audio is resumed on the same tap");
    b.fire("click"); await b.advance(0);
    assert.equal(b.played.length, 1, "primed once per page session");
    // Screen back on: a blocked ring tries again.
    activated = false;
    const r = b.window.danzstakCallRinger; b.contexts[0].state = "suspended";
    r.start({ durationMs: 20000 }); await b.advance(0);
    assert.equal(r.state(), "blocked");
    activated = true; b.fire("visibilitychange"); await b.advance(0);
    assert.equal(r.state(), "audio", "visibilitychange retries the ring");
    assert.equal(b.contexts[0].state, "running", "and resumes Web Audio");
    r.stop();
  }

  // ---------- 5. quiet hours: no sound, no buzz ----------
  {
    const b = fakeBrowser();
    b.window.danzstakSyncPrefs = { quiet: kind => kind === "call", vibration: () => [200] };
    const r = b.window.danzstakCallRinger; r.start({ durationMs: 10000 }); await b.advance(0);
    assert.equal(r.state(), "quiet"); assert.equal(b.played.length, 0); assert.equal(b.vibrations.length, 0);
    r.stop();
    b.window.danzstakSyncPrefs = { quiet: () => false, vibration: () => null };
    r.start({ durationMs: 10000 }); await b.advance(0);
    assert.equal(r.state(), "audio"); assert.equal(b.vibrations.filter(v => v !== 0).length, 0, "Vibration: off is respected");
    r.stop();
  }

  // ---------- 6. SYNC (chat.js) and the global popup both ring through it, without the old "already unlocked" gate ----------
  assert.match(chat, /function startIncomingRingtone\(\)\{const remaining=incomingRingDeadline-Date\.now\(\);if\(!pending\|\|document\.hidden\|\|ringTimer\|\|remaining<=0\)return;[^\n]*?if\(window\.danzstakCallRinger\?\.start\)\{ringTimer=window\.danzstakCallRinger\.start\(\{contact:pending\.senderEmail\|\|contact,durationMs:remaining,surface:els\.incoming,audioContext\}\);return;\}/);
  assert.doesNotMatch(chat, /function startIncomingRingtone\(\)\{const remaining=incomingRingDeadline-Date\.now\(\);if\(!pending\|\|document\.hidden\|\|audioContext\?\.state!=="running"/, "SYNC no longer gives up silently when audio isn't unlocked yet (PR #578)");
  {
    const fn = chat.match(/function startIncomingRingtone\(\)\{[^\n]+/)[0];
    const calls = [];
    const state = vm.createContext({ incomingRingDeadline: Date.now() + 25000, pending: { senderEmail: "x@y.test" }, contact: "", ringTimer: null, incomingRingStopTimer: null, audioContext: { state: "suspended" }, els: { incoming: {} }, document: { hidden: false }, Date, window: { danzstakCallRinger: { start: options => { calls.push(options); return { stop() {} }; } } } });
    vm.runInContext(fn, state); state.startIncomingRingtone();
    assert.equal(calls.length, 1, "a suspended audio context no longer silences the SYNC ring"); assert.equal(calls[0].surface, state.els.incoming);
  }
  assert.match(chat, /async function accept\(\)\{if\(!pending\)return;const offer=pending;stopRing\(\);window\.danzstakCallRinger\?\.handled\(offer\.callId\);/);
  assert.match(chat, /for\(const type of\["pointerup","touchend","click"\]\)document\.addEventListener\(type,unlockCallAudio/);
  assert.match(chat, /if\(event\.signalType==="offer"&&endedCalls\.has\(event\.callId\)\)return true;/, "a cancelled call's offer never rings again");
  assert.match(chat, /if\(pending\?\.callId===resolvedCallId&&!peer\)\{endedCalls\.add\(resolvedCallId\);stopRing\(\);/, "a ringing call resolved elsewhere stops ringing here");
  assert.match(incoming, /if \(window\.danzstakCallRinger\?\.start\) \{ ringtoneTimer = window\.danzstakCallRinger\.start\(\{ contact: current\.senderEmail \|\| "", durationMs: remaining, surface: popup, audioContext: ringtoneContext \}\); return; \}/);
  assert.match(incoming, /window\.danzstakCallRinger\?\.handled\(event\.callId\);\r?\n    if \(typeof window\.openMessageDrawer/);
  assert.match(incoming, /<div data-ringer-slot><strong id="globalIncomingTitle">/);
  // The tones stay synthesized: the ringer reads the pattern, sync-tones.js ships no audio file.
  assert.match(tonesSource, /const pattern = id => TONES\[id\] \?/);
  assert.doesNotMatch(ringerSource, /fetch\(|\.(mp3|ogg|m4a|aac|flac)\b|<input[^>]*file/i, "no audio file is fetched or uploaded");

  // ---------- 7. Service worker: long vibration, re-ring every 8 s up to 45 s, stops on every resolution ----------
  {
    let clock = 0, nextId = 1; const timers = new Map();
    const advance = async ms => { const end = clock + ms; for (;;) { const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]; if (!due) break; timers.delete(due[0]); clock = due[1].at; due[1].fn(); await flush(); await flush(); } clock = end; await flush(); };
    const handlers = {}, messageHandlers = [], shown = [], closed = [], posted = [];
    let open = [], visible = false;
    const self = {
      location: { origin: "https://danzstak.com" },
      addEventListener: (name, fn) => { if (name === "message") messageHandlers.push(fn); else handlers[name] = fn; },
      registration: {
        showNotification: async (title, options) => { shown.push({ title, options }); open = [{ tag: options.tag, data: options.data, close() { closed.push(options.tag); open = open.filter(n => n !== this); } }]; },
        getNotifications: async ({ tag } = {}) => open.filter(n => !tag || n.tag === tag)
      },
      clients: { matchAll: async () => [{ visibilityState: visible ? "visible" : "hidden", postMessage: m => posted.push(m) }] }
    };
    vm.runInNewContext(worker, { self, URL, setTimeout: (fn, ms) => { const id = nextId++; timers.set(id, { fn, at: clock + ms }); return id; }, clearTimeout: id => timers.delete(id), Date: class extends Date { static now() { return clock; } }, caches: {}, fetch: async () => ({ ok: true }) });
    const extended = [];
    const pushEvent = payload => ({ data: { json: () => payload }, waitUntil: p => extended.push(p) });
    const callId = "22222222-2222-4222-8222-222222222222";
    handlers.push(pushEvent({ type: "call", title: "Incoming call", body: "Tour Friend is calling", tag: `call-${callId}`, url: "/messages.html" }));
    await flush();
    assert.equal(shown.length, 1); assert.deepEqual([...shown[0].options.vibrate], [600, 300, 600, 300, 600, 300, 600]);
    assert.equal(shown[0].options.requireInteraction, true); assert.equal(shown[0].options.renotify, true);
    assert.equal(extended.length, 2, "the worker stays alive while the call rings");
    await advance(8000); assert.equal(shown.length, 2, "rings again after 8 s"); assert.equal(shown[1].options.tag, `call-${callId}`, "same tag: one notification");
    visible = true; await advance(8000); assert.equal(shown.length, 2, "an open, visible SYNC rings in the page instead"); visible = false;
    await advance(8000); assert.equal(shown.length, 3);
    handlers.push(pushEvent({ type: "call-resolved", callId, reason: "cancelled" })); await flush(); await flush();
    assert.deepEqual(closed, [`call-${callId}`], "the caller hung up: the notification closes");
    assert.deepEqual(JSON.parse(JSON.stringify(posted.at(-1))), { type: "DANZSTAK_CALL_RESOLVED", callId, reason: "cancelled" }, "open pages learn why");
    await advance(30000); assert.equal(shown.length, 3, "no more rings after it resolved");
    // The 45 s cap.
    const second = "33333333-3333-4333-8333-333333333333";
    handlers.push(pushEvent({ type: "call", tag: `call-${second}` })); await flush();
    const before = shown.length; await advance(120000);
    assert.equal(shown.length - before, 5, "at most 45 s of re-ringing (5 more times at 8 s)");
    // Answered in an open window, tapped, or dismissed: stops.
    const third = "44444444-4444-4444-8444-444444444444";
    handlers.push(pushEvent({ type: "call", tag: `call-${third}` })); await flush();
    let waited; for (const fn of messageHandlers) fn({ data: { type: "DANZSTAK_CALL_HANDLED", callId: third }, waitUntil: p => (waited = p) });
    await waited; const afterHandled = shown.length; await advance(20000);
    assert.equal(shown.length, afterHandled, "handled in the open app: no more rings"); assert.ok(closed.includes(`call-${third}`));
    const fourth = "55555555-5555-4555-8555-555555555555";
    handlers.push(pushEvent({ type: "call", tag: `call-${fourth}` })); await flush();
    open = []; const afterDismiss = shown.length; await advance(20000);
    assert.equal(shown.length, afterDismiss, "dismissed: no more rings");
    // Quiet hours and the test call ring once.
    handlers.push(pushEvent({ type: "call", tag: "call-66666666-6666-4666-8666-666666666666", silent: true })); await flush();
    handlers.push(pushEvent({ type: "call", test: true, tag: "call-test", url: "/messages.html" })); await flush();
    const afterOnce = shown.length; await advance(20000);
    assert.equal(shown.length, afterOnce, "quiet hours and Test ringer never re-ring");
    assert.equal(shown.at(-1).options.data.callId, "", "a test call has no call to answer or decline");
    assert.equal(timers.size, 0, "no timers left");
  }

  // ---------- 8. Server: cancel push, reason, test call push; inline code still parses ----------
  assert.match(template, /async function notifyCallResolved\(recipientEmail,callId,answeredByDeviceId,reason=answeredByDeviceId\?'answered':'declined'\)\{[^\n]*\{type:'call-resolved',tag:`call-\$\{callId\}`,callId,reason\}/);
  assert.match(template, /async function unansweredOffer\(recipientEmail,senderEmail,callId\)\{[^\n]*FilterExpression:'expiresAt > :n AND callId = :c AND signalType = :o AND senderEmail = :s'/);
  assert.match(template, /if\(signalType==='hangup'&&\['phone','video'\]\.includes\(mode\)&&await unansweredOffer\(recipientEmail,user\.email,callId\)\.catch\(\(\)=>false\)\)await notifyCallResolved\(recipientEmail,callId,'','cancelled'\)/, "a caller who hangs up before an answer stops the callee's lock-screen ring");
  assert.match(template, /if\(body\.kind==='call'\)\{const device=deviceId\?await authenticatedCallingDevice\(event,user,\{allowDisabled:true\}\):null,mine=device\?items\.filter\(item=>item\.deviceId\?\.S===deviceId\):\[\]/, "the test call goes to this registered phone only");
  assert.match(template, /\{type:'call',test:true,\.\.\.copy,tag:'call-test',url:'\/messages\.html'\}/);
  {
    const lines = template.split(/\r?\n/), start = lines.findIndex(line => /^\s+ZipFile: \|/.test(line));
    let end = start + 1; while (end < lines.length && (lines[end].startsWith("          ") || !lines[end].trim())) end++;
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ringer-")), "signal.mjs");
    fs.writeFileSync(file, lines.slice(start + 1, end).map(line => line.slice(10)).join("\n"));
    execFileSync(process.execPath, ["--check", file]);
  }

  // ---------- 9. Push re-link the moment the phone registers ----------
  assert.match(push, /addEventListener\("danzstak:call-device-registered", \(\) => renewExistingSubscription\(true\)\);/);
  assert.match(push, /if \(!force && sessionStorage\.getItem\("danzstak_push_synced"\) === "1"\) return;/);
  assert.match(push, /sessionStorage\.setItem\("danzstak_push_linked", saved\?\.callingDeviceLinked \? "1" : "0"\)/);

  // ---------- 10. SYNC ⋮ → Test ringer and the call-alerts prompt ----------
  {
    const rows = [], requests = [], panel = { before(node) { inserted.push(node); } }, inserted = [];
    let pushState = "prompt", enabled = 0, tests = 0;
    const store = new Map();
    const makeNode = tag => ({ tag, children: [], attributes: {}, textContent: "", hidden: false, handlers: {}, setAttribute(k, v) { this.attributes[k] = v; }, append(...n) { this.children.push(...n); }, addEventListener(t, f) { this.handlers[t] = f; }, remove() { this.removed = true; inserted.splice(inserted.indexOf(this), 1); } });
    const sandbox = {
      window: null, localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
      document: { body: { classList: { contains: c => c === "messages-page" } }, createElement: makeNode, querySelector: s => s === ".chat-sidebar .chat-list-panel" ? panel : s === ".call-alerts-prompt" ? inserted.find(n => n.className === "call-alerts-prompt") || null : s === ".call-alerts-note" ? inserted.find(n => n.className === "call-alerts-note") || null : null },
      fetch: async (url, options) => { requests.push({ url, body: JSON.parse(options.body || "{}") }); return { ok: true, json: async () => ({ kind: "call", sent: 1, thisDeviceRings: true }) }; },
      addEventListener() {}, setTimeout: () => 0, clearTimeout() {}, Date, JSON, Promise, Error
    };
    sandbox.window = sandbox; sandbox.globalThis = sandbox;
    Object.assign(sandbox, {
      danzstakSyncSettings: { add: row => rows.push(row) }, danzstakSyncDeviceRegistered: () => true,
      danzstakPushState: async () => pushState, danzstakEnablePush: async () => { enabled++; pushState = "enabled"; },
      danzstakCallRinger: { test: ms => { tests++; assert.equal(ms, 3000); } }, danzstakCallingDeviceHeaders: async () => ({ "x-danzstak-device-id": "d1" })
    });
    vm.createContext(sandbox); vm.runInContext(alertsSource, sandbox);
    const row = rows.find(r => r.id === "test-ringer");
    assert.ok(row && row.order === 31 && row.label === "Test ringer", "Test ringer sits right under Call alerts in SYNC ⋮");
    await sandbox.danzstakCallAlerts.prompt();
    const bar = inserted.find(n => n.className === "call-alerts-prompt");
    assert.ok(bar, "a registered phone without push gets the one-line prompt");
    assert.equal(bar.children[0].textContent, "Turn on call alerts so calls ring when SYNC is closed");
    await bar.children[1].handlers.click();
    assert.equal(enabled, 1, "Turn on enables push"); assert.ok(!inserted.includes(bar));
    await row.run();
    assert.equal(tests, 1, "Test ringer plays the ringtone");
    assert.deepEqual(requests.at(-1).body, { kind: "call" }, "and sends a test call push to this phone");
    assert.match(inserted.find(n => n.className === "call-alerts-note").textContent, /test call notification is on its way/);
    // Dismissed once: never again.
    pushState = "prompt"; inserted.length = 0; store.set("danzstak_call_alerts_prompt", "x");
    await sandbox.danzstakCallAlerts.prompt(); assert.equal(inserted.length, 0, "a dismissed prompt stays dismissed");
  }

  // ---------- 11. Wiring and translations ----------
  for (const page of ["messages.html", "feed.html", "profile.html"]) { assert.match(read(page), /<script src="assets\/call-ringer\.js\?v=\d+" defer><\/script>/, `${page} loads the ringer`); assert.match(read(page), /assets\/call-ringer\.css\?v=\d+/); }
  assert.match(worker, /"\/assets\/call-ringer\.js", "\/assets\/call-ringer\.css", "\/assets\/call-alerts\.js"/, "cached offline");
  // Kept from PR #578: louder rings, a louder default, and a Call alerts button that always answers.
  const setup = read("assets/call-setup.js");
  assert.match(tonesSource, /tone\.kind === "ring" && out\.createDynamicsCompressor/, "rings are compressed and lifted (owner: ring tones too quiet)");
  assert.match(tonesSource, /const RING_MAKEUP_GAIN = 3\.2;/);
  assert.match(setup, /const DEFAULT_RING = 0\.8;/, "louder default ring volume");
  assert.match(chat, /finally\{delete els\.enable\.dataset\.busy;els\.enable\.disabled=false;\}/, "Call alerts can be tapped again (owner: it did nothing)");
  assert.match(chat, /window\.danzstakShowFeedback\?\.\(message,\{urgent\}\)/, "Call alerts shows its result on screen");
  assert.match(read("messages.html"), /<script src="assets\/call-alerts\.js\?v=\d+" defer><\/script>/);
  for (const lang of ["it", "fr", "es", "de", "pt"]) {
    const start = i18n.indexOf(`"${lang}": {`), block = i18n.slice(start, i18n.indexOf("\n}", start));
    for (const key of ["Tap to hear the ringer", "Call ended.", "Test ringer", "Turn on call alerts so calls ring when SYNC is closed", "Turn on", "Not now", "Ringing here now, and a test call notification is on its way to this phone."]) assert.ok(block.includes(JSON.stringify(key) + ":"), `${lang}: ${key}`);
  }
  console.log("Call ringer checks passed: <audio> → Web Audio → tap prompt, touch-safe unlock + visibilitychange, vibration, every stop, quiet hours, SW re-ring 8 s/45 s with every stop, caller-cancel push, test call push, push re-link, Test ringer + prompt, it/fr/es/de/pt.");
})().catch(error => { console.error(error); process.exitCode = 1; });
