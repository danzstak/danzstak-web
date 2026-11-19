"use strict";
// Owner 2026-11-19: "ringer is still quiet on the caller's side". The caller hears the ringback (chat.js startRingback).
// It was two thin sines (440 then 480 Hz) at 0.12 gain, which a phone speaker barely plays. This renders one 3-second
// ringback cycle offline through the real chain (window.danzstakRingbackBurst) and the old one, and measures the energy a
// phone speaker reproduces (1–5 kHz band, after the device's ±1 clip). The new ringback must be at least 10 dB louder
// there and must not clip.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const base = String(process.env.DANZSTAK_LOCAL_URL || process.env.DANZSTAK_FEED_ORIGIN || "http://127.0.0.1:8017").replace(/\/$/, "");
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
  try {
    const page = await browser.newPage();
    await page.goto(`${base}/messages.html`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof window.danzstakRingbackBurst === "function", null, { timeout: 15000 });
    const result = await page.evaluate(async () => {
      const rate = 48000, seconds = 3;
      async function measure(render) {
        const ctx = new OfflineAudioContext(1, rate * seconds, rate);
        render(ctx);
        const buf = await ctx.startRendering(), d = buf.getChannelData(0);
        let peak = 0; for (const v of d) peak = Math.max(peak, Math.abs(v));
        const c2 = new OfflineAudioContext(1, buf.length, rate), src = c2.createBufferSource(); src.buffer = buf;
        const clip = c2.createWaveShaper(), curve = new Float32Array(1025); for (let i = 0; i < 1025; i++) curve[i] = Math.max(-1, Math.min(1, (i - 512) / 512 * 4)); clip.curve = curve;
        const pre = c2.createGain(); pre.gain.value = 0.25;
        const hp = c2.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1000;
        const lp = c2.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 5000;
        src.connect(pre).connect(clip).connect(hp).connect(lp).connect(c2.destination); src.start();
        const e = (await c2.startRendering()).getChannelData(0); let sum = 0; for (const v of e) sum += v * v;
        return { bandDb: 10 * Math.log10(sum / e.length + 1e-12), peak };
      }
      // The old ringback, exactly as chat.js played it before (playTone(440,.16,.12), then playTone(480,.28,.12) 190 ms later).
      const oldTone = (ctx, frequency, at, duration) => { const osc = ctx.createOscillator(), gain = ctx.createGain(); osc.frequency.value = frequency; gain.gain.value = 0.12; osc.connect(gain).connect(ctx.destination); osc.start(at); osc.stop(at + duration); };
      const before = await measure(ctx => { oldTone(ctx, 440, 0, 0.16); oldTone(ctx, 480, 0.19, 0.28); });
      const after = await measure(ctx => window.danzstakRingbackBurst(ctx, 0));
      return { before, after };
    });
    const gain = result.after.bandDb - result.before.bandDb;
    console.log(`Ringback: ${result.before.bandDb.toFixed(1)} → ${result.after.bandDb.toFixed(1)} dB in the phone-speaker band (+${gain.toFixed(1)} dB), peak ${result.after.peak.toFixed(2)}`);
    assert.ok(gain >= 10, `caller's ringback is only ${gain.toFixed(1)} dB louder (needs 10 dB)`);
    assert.ok(result.after.peak <= 0.98, `caller's ringback clips (peak ${result.after.peak.toFixed(2)})`);
    console.log("Ringback loudness check passed.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
