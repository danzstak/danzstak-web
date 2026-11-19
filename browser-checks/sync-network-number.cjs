const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const widths = [320, 360, 375, 390, 414, 430, 768, 1024, 1366];
const baseUrl = String(process.env.DANZSTAK_BASE_URL || process.env.DANZSTAK_LOCAL_URL || 'http://127.0.0.1:8016').replace(/\/$/, '');
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : '';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, serviceWorkers: 'block' });
      const page = await context.newPage();
      page.setDefaultTimeout(8000);
      page.on('pageerror', error => console.error(`Page error at ${width}px: ${error.message}`));
      let checkoutRequested = false;
      await page.route('https://checkout.stripe.com/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Stripe Test Checkout</title><h1>Test checkout</h1>' }));
      await page.route('https://api.danzstak.com/**', async route => {
        const request = route.request(), url = new URL(request.url()), apiPath = url.pathname;
        const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        if (apiPath === '/auth/session') return json({ authenticated: true, user: { email: 'ds-owner@danzstak.test', sub: '33333333-3333-4333-8333-333333333333' } });
        if (apiPath === '/profiles') return json({ profile: { name: 'Night Shift', handle: 'nightshift', isOwner: true } });
        if (apiPath === '/phone-verification') return json({ configured: true, state: 'verified', verified: true, maskedNumber: '•••• 1613', providerAvailable: true, deviceOtpRequired: true });
        if (apiPath === '/calls/devices') return json({ currentDeviceRegistered: true, devices: [{ deviceId: '11111111-1111-4111-8111-111111111111', name: 'Test phone', allowCalls: true, registeredAt: '2026-11-11T12:00:00.000Z', lastUsedAt: '2026-11-11T12:00:00.000Z', thisDevice: true }] });
        if (apiPath === '/sync-network-number/entitlement') return json({ entitled: false, status: 'not_purchased', alias: '', network: 'sync_only', carrierNumber: false, receivesSms: false, emergencyCalling: false, deviceOtpRequired: true, checkoutAvailable: true, unitAmountCents: 300, currency: 'usd', testMode: true });
        if (apiPath === '/sync-network-number/checkout') {
          checkoutRequested = true;
          return json({ checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_dsvisual', unitAmountCents: 300, currency: 'usd', testMode: true });
        }
        if (apiPath === '/conversations') return json({ conversations: [] });
        if (apiPath === '/friends') return json({ friends: [] });
        if (apiPath === '/calls/directory') return json({ users: [] });
        if (apiPath === '/calls/inbox') return json({ events: [] });
        return json({});
      });

      await page.goto(`${baseUrl}/messages.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => typeof window.danzstakOpenCallingDevices === 'function');
      await page.evaluate(() => window.danzstakOpenCallingDevices());
      const dialog = page.locator('#callingDevicesDialog');
      await dialog.waitFor({ state: 'visible' });
      // DS numbers are paused (CLAUDE.md: "must not be sold") and stay out of the device panel until they launch
      // (fix-it 18 "Registration panel is wordy", PR #438, owner SYNC call test 2026-11-17). The panel must not offer,
      // price or start a DS-number checkout; the device rows and SMS registration stay usable.
      await page.waitForTimeout(250);
      const offer = await page.evaluate(() => {
        const section = document.querySelector('.sync-network-number');
        const buy = document.querySelector('#buySyncNetworkNumber');
        const panelText = document.querySelector('#callingDevicesDialog').innerText;
        return { sectionVisible: Boolean(section?.checkVisibility()), buyVisible: Boolean(buy?.checkVisibility()), panelText };
      });
      assert.equal(offer.sectionVisible, false, `DS number offer is visible in the device panel at ${width}px`);
      assert.equal(offer.buyVisible, false, `DS number purchase button is visible at ${width}px`);
      assert.doesNotMatch(offer.panelText, /DS number|DanzStak Network number|Test Mode/i, `device panel still advertises DS numbers at ${width}px`);
      const geometry = await page.evaluate(() => {
        const dialog = document.querySelector('#callingDevicesDialog').getBoundingClientRect();
        return { left: dialog.left, right: dialog.right, bottom: dialog.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight, scrollWidth: document.documentElement.scrollWidth };
      });
      assert.ok(geometry.left >= 0 && geometry.right <= geometry.viewportWidth, `device dialog overflows horizontally at ${width}px: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.bottom <= geometry.viewportHeight, `device dialog overflows vertically at ${width}px: ${JSON.stringify(geometry)}`);
      assert.equal(geometry.scrollWidth, width, `device dialog causes page overflow at ${width}px`);
      if (captureDir && [390, 1366].includes(width)) {
        fs.mkdirSync(captureDir, { recursive: true });
        await page.screenshot({ path: path.join(captureDir, `sync-network-number-${width}.png`) });
      }
      assert.equal(checkoutRequested, false, `a DS number checkout was requested at ${width}px`);
      await context.close();
    }
    console.log(`SYNC Network number browser checks passed at ${widths.join(', ')}px: the paused DS number is not offered, priced or sold in the device panel.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
