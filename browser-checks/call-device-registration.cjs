const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const widths = [320, 360, 390, 414, 430, 1024];
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : '';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [];
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
      const page = await context.newPage();
      page.setDefaultTimeout(8000);
      let registered = false;
      let callHeaders = {};
      await page.route('https://api.danzstak.com/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname;
        if (path === '/auth/session') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: true, user: { email: 'browser-test@danzstak.test', sub: '33333333-3333-4333-8333-333333333333' } }) });
        if (path === '/calls/devices' && request.method() === 'GET') {
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ devices: registered ? [{ deviceId: '11111111-1111-4111-8111-111111111111', name: 'My test phone', allowCalls: true, registeredAt: new Date().toISOString(), lastUsedAt: new Date().toISOString(), revokedAt: '', thisDevice: true }] : [] }) });
        }
        if (path === '/calls/devices/challenge') return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ challengeId: '22222222-2222-4222-8222-222222222222', challenge: 'a'.repeat(43) }) });
        if (path === '/calls/devices/register') {
          registered = true;
          return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ deviceId: '11111111-1111-4111-8111-111111111111', deviceToken: 'b'.repeat(43), name: 'My test phone', allowCalls: true, registeredAt: new Date().toISOString() }) });
        }
        if (path === '/calls/inbox') callHeaders = request.headers();
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(path === '/calls/inbox' ? { events: [] } : {}) });
      });
      await page.goto('http://127.0.0.1:8016/messages.html', { waitUntil: 'commit' });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForFunction(() => typeof window.danzstakOpenCallingDevices === 'function');
      await page.locator('#callingDevices').click();
      const dialog = page.locator('#callingDevicesDialog');
      await assert.doesNotReject(() => dialog.waitFor({ state: 'visible' }));
      await page.locator('#deviceName').fill('My test phone');
      await page.locator('#registerThisDevice').click();
      await page.locator('#deviceStatus').filter({ hasText: 'registered for SYNC calls' }).waitFor();
      await page.waitForTimeout(150);
      const geometry = await page.evaluate(() => {
        const dialog = document.querySelector('#callingDevicesDialog').getBoundingClientRect();
        const button = document.querySelector('#callingDevices').getBoundingClientRect();
        const buttonStyle = getComputedStyle(document.querySelector('#callingDevices'));
        return { dialogLeft: dialog.left, dialogRight: dialog.right, viewport: innerWidth, buttonWidth: button.width, buttonHeight: button.height, cssWidth: buttonStyle.width, cssMinWidth: buttonStyle.minWidth, cssMinHeight: buttonStyle.minHeight, scrollWidth: document.documentElement.scrollWidth, rows: document.querySelectorAll('.registered-devices li').length };
      });
      assert.ok(geometry.dialogLeft >= 0 && geometry.dialogRight <= geometry.viewport, `dialog overflows at ${width}px`);
      assert.equal(geometry.scrollWidth, width, `page overflows at ${width}px`);
      assert.ok(geometry.buttonWidth >= 44 && geometry.buttonHeight >= 44, `device control is below 44px at ${width}px: ${JSON.stringify(geometry)}`);
      assert.equal(geometry.rows, 1, `registered device row missing at ${width}px`);
      assert.equal(await page.locator('#deviceName').isHidden(), true, `completed registration form remains visible at ${width}px`);
      await page.locator('.registered-devices li').filter({ hasText: 'Last active' }).waitFor();
      assert.equal(callHeaders['x-danzstak-device-id'], '11111111-1111-4111-8111-111111111111');
      assert.equal(callHeaders['x-danzstak-device-token'], 'b'.repeat(43));
      if (captureDir) {
        fs.mkdirSync(captureDir, { recursive: true });
        await page.screenshot({ path: path.join(captureDir, `calling-devices-${width}.png`), fullPage: true });
      }
      results.push(`${width}px`);
      await context.close();
    }
    console.log(`Call device browser checks passed: ${results.join(', ')}`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
