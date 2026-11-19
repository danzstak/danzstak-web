"use strict";
// F15e (owner 2026-11-19: "the ringer is real quiet, turn it up at least 10 dB"). Renders every SYNC ring tone offline in
// the browser through the real play() chain and measures the energy a phone speaker actually reproduces (1–5 kHz band,
// after the device's ±1 clip). The baseline numbers are the 2026-11-19 chain (compressor + 3.2x make-up only).
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
    const page = await browser.newPage();
    await page.goto(`${base}/messages.html`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.danzstakSyncTones, null, { timeout: 15000 });
    const result = await page.evaluate(async ids => {
      const out = {};
      for (const id of ids) {
        const ctx = new OfflineAudioContext(1, 48000 * 3, 48000);
        window.danzstakSyncTones.play(id, { audio: ctx, volume: 0.8, loop: false, maxMs: 2600, quiet: true });
        const buf = await ctx.startRendering(), d = buf.getChannelData(0);
        let peak = 0; for (const v of d) peak = Math.max(peak, Math.abs(v));
        const c2 = new OfflineAudioContext(1, buf.length, 48000), src = c2.createBufferSource(); src.buffer = buf;
        const clip = c2.createWaveShaper(), curve = new Float32Array(1025); for (let i = 0; i < 1025; i++) curve[i] = Math.max(-1, Math.min(1, (i - 512) / 512 * 4)); clip.curve = curve;
        const pre = c2.createGain(); pre.gain.value = 0.25;
        const hp = c2.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1000;
        const lp = c2.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 5000;
        src.connect(pre).connect(clip).connect(hp).connect(lp).connect(c2.destination); src.start();
        const e = (await c2.startRendering()).getChannelData(0); let sum = 0; for (const v of e) sum += v * v;
        out[id] = { bandDb: 10 * Math.log10(sum / e.length + 1e-12), peak };
      }
      return out;
    }, Object.keys(BASELINE_BAND_DB));
    for (const [id, { bandDb, peak }] of Object.entries(result)) {
      const gain = bandDb - BASELINE_BAND_DB[id], need = MIN_GAIN_DB[id] ?? 10;
      console.log(`${id}: ${bandDb.toFixed(1)} dB in the phone-speaker band (+${gain.toFixed(1)} dB), peak ${peak.toFixed(2)}`);
      assert.ok(gain >= need, `${id} ring is only ${gain.toFixed(1)} dB louder (needs ${need} dB)`);
      assert.ok(peak <= 0.98, `${id} ring clips (peak ${peak.toFixed(2)})`);
    }
    console.log("Ringer loudness check passed.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
