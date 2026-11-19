"use strict";
// Directive F15e (owner 2026-11-19: "The ringer on SYNC should be 10 dB louder minimum"). The rings are synthesized
// (assets/sync-tones.js, no audio files), so this renders each one through the real play() chain in an
// OfflineAudioContext at the default ring volume and measures it: integrated loudness (ITU-R BS.1770-4: K-weighting,
// 400 ms blocks, gated) plain and through a phone-speaker model (K-weighting plus a 2nd-order 1 kHz high-pass), and the
// sample peak. Old levels were measured the same way before the change (old chain at the old default volume 0.8).
// Measured first: the old rings already peaked at +3 to +6.4 dBFS (they clipped), but through a phone speaker most were
// quiet (-17 to -33 LUFS) because their energy sat at 45-480 Hz. So "10 dB louder" is measured where the member hears it:
// - the default ring (Classic) is at least 10 dB louder through the phone-speaker model, and so is the average ring;
// - every ring is at least 4 dB louder (Desk bell was already in the phone's band);
// - no ring clips: every sample peak is at or below -1.5 dBFS;
// - the default ring volume is the maximum.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const base = String(process.env.DANZSTAK_BASE_URL || process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8132").replace(/\/$/, ""); // CI call-media job: LOCAL_URL
// Old chain (compressor + x3.2 make-up) at the old default volume 0.8: phone-model LUFS and sample peak dBFS.
const OLD = {
  "classic": { phone: -25.0, peak: 5.8 }, "bell": { phone: -7.1, peak: 4.3 }, "techno-pulse": { phone: -21.0, peak: 6.4 },
  "acid": { phone: -22.5, peak: 4.4 }, "house-stab": { phone: -32.9, peak: 5.7 }, "punk-riff": { phone: -21.8, peak: 6.4 },
  "metal-gallop": { phone: -24.7, peak: 4.7 }, "industrial": { phone: -19.7, peak: 6.5 }, "synth-arp": { phone: -17.4, peak: 3.0 }
};

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage();
    await page.route("https://api.danzstak.com/**", route => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page.goto(`${base}/terms.html`, { waitUntil: "domcontentloaded" });
    await page.addScriptTag({ url: `${base}/assets/call-setup.js` });
    await page.addScriptTag({ url: `${base}/assets/sync-tones.js` });
    await page.waitForFunction(() => window.danzstakSyncTones?.play && window.danzstakCallSetup?.ringVolume, null, { timeout: 10000 });
    const measured = await page.evaluate(async () => {
      const rate = 48000, tones = window.danzstakSyncTones.list("ring"), volume = window.danzstakCallSetup.ringVolume();
      const biquad = (data, b0, b1, b2, a1, a2) => { const y = new Float32Array(data.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < data.length; i++) { const v = b0 * data[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = data[i]; y2 = y1; y1 = v; y[i] = v; } return y; };
      const kWeight = x => biquad(biquad(x, 1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585), 1.0, -2.0, 1.0, -1.99004745483398, 0.99007225036621);
      const phoneModel = x => { const w = 2 * Math.PI * 1000 / rate, alpha = Math.sin(w) / (2 * Math.SQRT1_2), cos = Math.cos(w), a0 = 1 + alpha; return biquad(x, (1 + cos) / 2 / a0, -(1 + cos) / a0, (1 + cos) / 2 / a0, -2 * cos / a0, (1 - alpha) / a0); };
      // The ring loops, so one period is measured as a loop (blocks wrap around), gated as BS.1770-4 specifies.
      const loudness = (weighted, start, length) => {
        const block = 0.4 * rate, hop = 0.1 * rate, power = [], at = i => weighted[start + ((i % length) + length) % length] ** 2;
        for (let s = 0; s < length; s += hop) { let sum = 0; for (let i = 0; i < block; i++) sum += at(s + i); power.push(sum / block); }
        const lufs = z => -0.691 + 10 * Math.log10(z), mean = list => list.reduce((a, b) => a + b, 0) / list.length;
        let gated = power.filter(z => lufs(z) > -70); const relative = lufs(mean(gated)) - 10; gated = gated.filter(z => lufs(z) > relative);
        return Math.round(lufs(mean(gated)) * 10) / 10;
      };
      const out = { volume, rings: {} };
      for (const tone of tones) {
        const audio = new OfflineAudioContext(1, rate * 4, rate);
        window.danzstakSyncTones.play(tone.id, { audio, volume, loop: false });
        const samples = (await audio.startRendering()).getChannelData(0);
        window.danzstakSyncTones.stop();
        const start = Math.round(0.03 * rate), length = Math.round(tone.seconds * rate); // one loop period
        let peak = 0; for (let i = start; i < start + length; i++) peak = Math.max(peak, Math.abs(samples[i]));
        const k = kWeight(samples);
        out.rings[tone.id] = { plain: loudness(k, start, length), phone: loudness(phoneModel(k), start, length), peak: Math.round(20 * Math.log10(peak) * 10) / 10 };
      }
      return out;
    });
    assert.equal(measured.volume, 1, "the default ring volume is the maximum");
    assert.deepEqual(Object.keys(measured.rings).sort(), Object.keys(OLD).sort(), "every ring tone is measured");
    const gains = {};
    for (const [id, ring] of Object.entries(measured.rings)) {
      gains[id] = Math.round((ring.phone - OLD[id].phone) * 10) / 10;
      assert.ok(ring.peak <= -1.5, `${id}: no clipping (sample peak ${ring.peak} dBFS, was ${OLD[id].peak})`);
      assert.ok(gains[id] >= 4, `${id}: at least 4 dB louder through a phone speaker (${gains[id]} dB)`);
    }
    const average = Object.values(gains).reduce((a, b) => a + b, 0) / Object.keys(gains).length;
    assert.ok(gains.classic >= 10, `the default ring (Classic) is at least 10 dB louder through a phone speaker (${gains.classic} dB)`);
    assert.ok(average >= 10, `the rings are at least 10 dB louder on average through a phone speaker (${average.toFixed(1)} dB)`);
    const table = Object.entries(measured.rings).map(([id, ring]) => `${id} ${ring.plain} LUFS, phone ${ring.phone} LUFS (+${gains[id]} dB), peak ${ring.peak} dBFS`).join("; ");
    console.log(`Ringer loudness checks passed at volume ${measured.volume}: Classic +${gains.classic} dB, average +${average.toFixed(1)} dB through a phone speaker, no clipping. ${table}`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
