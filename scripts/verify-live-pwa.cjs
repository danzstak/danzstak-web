const { chromium } = require("playwright-core");

const expectedCache = process.env.DANZSTAK_EXPECTED_CACHE || "danzstak-shell-v636";
const baseUrl = process.env.DANZSTAK_LIVE_URL || "https://danzstak.com";

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.DANZSTAK_EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: true,
  });
  const context = await browser.newContext({ serviceWorkers: "allow" });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/?pwa-check=1`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  const state = await page.evaluate(async ({ expectedCache }) => {
    if (!("serviceWorker" in navigator)) throw new Error("Service workers are unavailable");
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Service worker ready timeout")), 15000)),
    ]);
    const worker = registration.active || registration.installing || registration.waiting;
    if (worker && worker.state !== "activated") {
      await Promise.race([
        new Promise((resolve) => worker.addEventListener("statechange", () => {
          if (worker.state === "activated") resolve();
        })),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Service worker activation timeout")), 15000)),
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
  await browser.close();
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
