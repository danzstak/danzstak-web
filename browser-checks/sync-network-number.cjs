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
        if (apiPath === '/profiles') return json({ profile: { name: 'DS Number Tester', isOwner: true } });
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
      await page.evaluate(() => document.querySelector('#syncNetworkNumberStatus')?.scrollIntoView({ block: 'center' }));
      await page.locator('#syncNetworkNumberStatus').waitFor({ state: 'visible' });
      await page.waitForTimeout(250);
      assert.match(await page.locator('#syncNetworkNumberStatus').innerText(), /No DS number/, `DS number status did not load at ${width}px`);
      assert.match(await page.locator('.sync-network-number').innerText(), /SYNC-only|inside SYNC/i);
      assert.match(await page.locator('.sync-network-number').innerText(), /does not support carrier SMS|not a cellular number/i);
      assert.match(await page.locator('.sync-network-number').innerText(), /never replaces this device's private SMS code/i);
      assert.equal(await page.locator('#buySyncNetworkNumber').innerText(), 'Get a DS number · $3 Test Mode');
      const geometry = await page.evaluate(() => {
        const dialog = document.querySelector('#callingDevicesDialog').getBoundingClientRect();
        const button = document.querySelector('#buySyncNetworkNumber').getBoundingClientRect();
        return { left: dialog.left, right: dialog.right, bottom: dialog.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight, buttonWidth: button.width, buttonHeight: button.height, scrollWidth: document.documentElement.scrollWidth };
      });
      assert.ok(geometry.left >= 0 && geometry.right <= geometry.viewportWidth, `DS number dialog overflows horizontally at ${width}px: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.bottom <= geometry.viewportHeight, `DS number dialog overflows vertically at ${width}px: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.buttonWidth >= 44 && geometry.buttonHeight >= 44, `DS number purchase target is too small at ${width}px`);
      assert.equal(geometry.scrollWidth, width, `DS number screen causes page overflow at ${width}px`);
      if (captureDir && [390, 1366].includes(width)) {
        fs.mkdirSync(captureDir, { recursive: true });
        await page.screenshot({ path: path.join(captureDir, `sync-network-number-${width}.png`) });
      }
      if (width === 390) {
        await page.locator('#buySyncNetworkNumber').click();
        await page.waitForURL('https://checkout.stripe.com/**');
        assert.equal(checkoutRequested, true, 'purchase button did not request an authenticated checkout');
      }
      await context.close();
    }
    console.log(`SYNC Network number browser checks passed at ${widths.join(', ')}px, including the secure Stripe Test Checkout handoff.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
