"use strict";
// F15e (owner 2026-11-19: "the ringer is real quiet, turn it up at least 10 dB"). Renders every SYNC ring tone offline in
// the browser through the real play() chain and measures the energy a phone speaker actually reproduces (1–5 kHz band,
// after the device's ±1 clip). The baseline numbers are the 2026-11-19 chain (compressor + 3.2x make-up only).
// 5a00: the call ringer rings through an <audio> element first; its WAV must be just as loud (within 1 dB), never clip.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const base = String(process.env.DANZSTAK_LOCAL_URL || process.env.DANZSTAK_FEED_ORIGIN || "http://127.0.0.1:8017").replace(/\/$/, "");
const BASELINE_BAND_DB = { "classic": -27, "bell": -9.7, "techno-pulse": -38.3, "acid": -25.2, "house-stab": -33.3, "punk-riff": -26.9, "metal-gallop": -28, "industrial": -23.6, "synth-arp": -21.2 };
// The default ring (classic) and every tone that had headroom must gain at least 10 dB; tones that were already near
// full scale in the speaker band (bell, acid, synth-arp) must still gain at least 5 dB. Nothing may clip.
const MIN_GAIN_DB = { "bell": 5, "acid": 5, "synth-arp": 5 };
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
  try {
    // No service worker: its first install reloads the page (controllerchange) in the middle of the measurement.
    const page = await (await browser.newContext({ serviceWorkers: "block" })).newPage();
    // A signed-in SYNC page without the live API, so it never redirects to sign-in in the middle of the measurement.
    const cors = { "access-control-allow-origin": new URL(base).origin, "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type,x-danzstak-device-id,x-danzstak-device-token", "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS" };
    await page.route("https://api.danzstak.com/**", route => {
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      const session = new URL(route.request().url()).pathname === "/auth/session";
      return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(session ? { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "ringer@danzstak.invalid", name: "Ringer Check" } } : {}) });
    });
    await page.goto(`${base}/messages.html`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.danzstakSyncTones, null, { timeout: 15000 });
    await page.waitForFunction(() => window.danzstakCallRinger?.renderLoud, null, { timeout: 15000 });
    const result = await page.evaluate(async ids => {
      // Energy in the phone-speaker band, averaged over a 3 s window (one ring loop plus silence).
      async function band(buf) {
        const d = buf.getChannelData(0); let peak = 0; for (const v of d) peak = Math.max(peak, Math.abs(v));
        const c2 = new OfflineAudioContext(1, 48000 * 3, 48000), src = c2.createBufferSource(); src.buffer = buf;
        const clip = c2.createWaveShaper(), curve = new Float32Array(1025); for (let i = 0; i < 1025; i++) curve[i] = Math.max(-1, Math.min(1, (i - 512) / 512 * 4)); clip.curve = curve;
        const pre = c2.createGain(); pre.gain.value = 0.25;
        const hp = c2.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1000;
        const lp = c2.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 5000;
        src.connect(pre).connect(clip).connect(hp).connect(lp).connect(c2.destination); src.start();
        const e = (await c2.startRendering()).getChannelData(0); let sum = 0; for (const v of e) sum += v * v;
        return { bandDb: 10 * Math.log10(sum / e.length + 1e-12), peak };
      }
      const out = {};
      for (const id of ids) {
        const ctx = new OfflineAudioContext(1, 48000 * 3, 48000);
        window.danzstakSyncTones.play(id, { audio: ctx, volume: 0.8, loop: false, maxMs: 2600, quiet: true });
        out[id] = await band(await ctx.startRendering());
        // The <audio> ringtone: one loop rendered by the call ringer as a 16-bit WAV, decoded like the phone would.
        const wav = await window.danzstakCallRinger.renderLoud(id, { rate: 48000, minSeconds: 0.1, level: 0.8 });
        const decoded = await new OfflineAudioContext(1, 48000, 48000).decodeAudioData(wav.buffer.slice(0));
        const element = await band(decoded);
        out[id].elementDb = element.bandDb; out[id].elementPeak = element.peak;
      }
      return out;
    }, Object.keys(BASELINE_BAND_DB));
    for (const [id, { bandDb, peak, elementDb, elementPeak }] of Object.entries(result)) {
      const gain = bandDb - BASELINE_BAND_DB[id], need = MIN_GAIN_DB[id] ?? 10;
      console.log(`${id}: ${bandDb.toFixed(1)} dB in the phone-speaker band (+${gain.toFixed(1)} dB), peak ${peak.toFixed(2)}; <audio> ringtone ${elementDb.toFixed(1)} dB, peak ${elementPeak.toFixed(2)}`);
      assert.ok(gain >= need, `${id} ring is only ${gain.toFixed(1)} dB louder (needs ${need} dB)`);
      assert.ok(peak <= 0.98, `${id} ring clips (peak ${peak.toFixed(2)})`);
      assert.ok(Math.abs(elementDb - bandDb) <= 1, `${id}: the <audio> ringtone (${elementDb.toFixed(1)} dB) must be as loud as the Web Audio ring (${bandDb.toFixed(1)} dB)`);
      assert.ok(elementPeak <= 0.98, `${id}: the <audio> ringtone clips (peak ${elementPeak.toFixed(2)})`);
    }
    console.log("Ringer loudness check passed.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
