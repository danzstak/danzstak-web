const { chromium } = require("playwright-core");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const localWorker = readFileSync(resolve(__dirname, "..", "service-worker.js"), "utf8");
const expectedCache = process.env.DANZSTAK_EXPECTED_CACHE
  || localWorker.match(/danzstak-shell-v\d+/)?.[0];
const baseUrl = process.env.DANZSTAK_LIVE_URL || "https://danzstak.com";

if (!expectedCache) throw new Error("Could not resolve the expected PWA cache from service-worker.js");

(async () => {
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: process.env.DANZSTAK_EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      headless: true,
    });
    const context = await browser.newContext({ serviceWorkers: "allow" });
    const page = await context.newPage();
    const verificationUrl = new URL("/login.html?pwa-check=1", baseUrl).toString();
    await page.goto(verificationUrl, { waitUntil: "networkidle" });

    const state = await page.evaluate(async ({ expectedCache }) => {
      if (!("serviceWorker" in navigator)) throw new Error("Service workers are unavailable");
      await navigator.serviceWorker.register("/service-worker.js");
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Service worker ready timeout")), 30000)),
      ]);
      const worker = registration.active || registration.installing || registration.waiting;
      if (worker && worker.state !== "activated") {
        await Promise.race([
          new Promise((resolve) => worker.addEventListener("statechange", () => {
            if (worker.state === "activated") resolve();
          })),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Service worker activation timeout")), 30000)),
        ]);
      }
      const cacheNames = await caches.keys();
      return {
        activeScript: (registration.active || worker)?.scriptURL || null,
        activeState: (registration.active || worker)?.state || null,
        controlled: Boolean(navigator.serviceWorker.controller),
        cacheNames,
        expectedCachePresent: cacheNames.includes(expectedCache),
        displayModeStandaloneSupported: matchMedia("(display-mode: standalone)").media !== "not all",
      };
    }, { expectedCache });

    if (!state.activeScript?.endsWith("/service-worker.js")) throw new Error("Unexpected active service worker");
    if (state.activeState !== "activated") throw new Error(`Service worker state: ${state.activeState}`);
    if (!state.expectedCachePresent) throw new Error(`Missing cache ${expectedCache}`);
    console.log(JSON.stringify({ baseUrl, expectedCache, ...state }, null, 2));
  } finally {
    await browser?.close();
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
