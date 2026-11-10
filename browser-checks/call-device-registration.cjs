const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const widths = [320, 360, 375, 390, 414, 430, 768, 1024, 1366];
const baseUrl = String(process.env.DANZSTAK_BASE_URL || process.env.DANZSTAK_LOCAL_URL || 'http://127.0.0.1:8016').replace(/\/$/, '');
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : '';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [];
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, serviceWorkers: 'block' });
      const page = await context.newPage();
      page.setDefaultTimeout(8000);
      page.on('pageerror', error => console.error(`Page error at ${width}px: ${error.message}`));
      let registered = false;
      let callHeaders = {};
      let conversationHeaders = {};
      let directoryHeaders = {};
      let presenceHeaders = {};
      let unregisteredMessageRequests = 0;
      let unregisteredSyncRequests = 0;
      await page.route('https://api.danzstak.com/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname;
        if (path === '/auth/session') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: true, user: { email: 'browser-test@danzstak.test', sub: '33333333-3333-4333-8333-333333333333' } }) });
        if (path === '/conversations') {
          if (!registered) { unregisteredMessageRequests += 1; return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Register this device before using SYNC.', code: 'SYNC_DEVICE_REGISTRATION_REQUIRED' }) }); }
          conversationHeaders = request.headers();
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ conversations: [{ contactEmail: 'friend@danzstak.test', memberId: '44444444-4444-4444-8444-444444444444', name: 'Tour Friend', preview: 'Ready for soundcheck', updatedAt: '2026-11-09T12:00:00.000Z', canContact: true }] }) });
        }
        if (path === '/friends') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ friends: [{ email: 'friend@danzstak.test', memberId: '44444444-4444-4444-8444-444444444444', name: 'Tour Friend' }] }) });
        if (path === '/calls/directory') {
          if (!registered) { unregisteredSyncRequests += 1; return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Register this device before using SYNC.', code: 'SYNC_DEVICE_REGISTRATION_REQUIRED' }) }); }
          directoryHeaders = request.headers();
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ users: [{ email: 'friend@danzstak.test', memberId: '44444444-4444-4444-8444-444444444444', name: 'Tour Friend', friendStatus: 'friends', online: true }] }) });
        }
        if (path === '/calls/presence') {
          if (!registered) { unregisteredSyncRequests += 1; return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Register this device before using SYNC.', code: 'SYNC_DEVICE_REGISTRATION_REQUIRED' }) }); }
          presenceHeaders = request.headers();
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ online: true }) });
        }
        if (path === '/messages') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ messages: [], canContact: true }) });
        if (path === '/calls/devices' && request.method() === 'GET') {
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ devices: registered ? [{ deviceId: '11111111-1111-4111-8111-111111111111', name: 'My test phone', allowCalls: true, registeredAt: new Date().toISOString(), lastUsedAt: new Date().toISOString(), revokedAt: '', thisDevice: true }] : [] }) });
        }
        if (path === '/calls/devices/challenge') return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ challengeId: '22222222-2222-4222-8222-222222222222', challenge: 'a'.repeat(43) }) });
        if (path === '/calls/devices/register') {
          registered = true;
          return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ deviceId: '11111111-1111-4111-8111-111111111111', deviceToken: 'b'.repeat(43), name: 'My test phone', allowCalls: true, registeredAt: new Date().toISOString() }) });
        }
        if (path === '/calls/inbox' && !registered) return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Register this device before using calls.', code: 'CALL_DEVICE_REGISTRATION_REQUIRED' }) });
        if (path === '/calls/inbox') callHeaders = request.headers();
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(path === '/calls/inbox' ? { events: [] } : {}) });
      });
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: 'commit' });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForFunction(() => typeof window.danzstakOpenCallingDevices === 'function');
      const dialog = page.locator('#callingDevicesDialog');
      await dialog.waitFor({ state: 'visible' }).catch(async error => {
        console.error(`Mandatory gate state at ${width}px:`, await page.evaluate(() => ({ open: document.querySelector('#callingDevicesDialog')?.open, required: document.body.hasAttribute('data-sync-device-required'), status: document.querySelector('#deviceStatus')?.textContent, setupRequired: document.querySelector('#callingDevices')?.hasAttribute('data-setup-required') })));
        throw error;
      });
      assert.equal(await page.locator('#closeCallingDevices').isHidden(), true, `registration gate can be dismissed at ${width}px`);
      assert.equal(await page.locator('.sync-number-setup').isHidden(), true, `optional number setup precedes mandatory registration at ${width}px`);
      if (captureDir && (width === 390 || width === 1366)) {
        fs.mkdirSync(captureDir, { recursive: true });
        await page.screenshot({ path: path.join(captureDir, `call-registration-required-${width}.png`) });
      }
      await page.locator('#deviceName').fill('My test phone');
      await page.locator('#registerThisDevice').click();
      await dialog.waitFor({ state: 'hidden' });
      await page.locator('.conversation-user').first().waitFor();
      assert.ok(unregisteredMessageRequests >= 1, `unregistered message access was not rejected at ${width}px`);
      assert.ok(unregisteredSyncRequests >= 1, `unregistered directory or presence access was not rejected at ${width}px`);
      await page.locator('#callingDevices').click();
      await assert.doesNotReject(() => dialog.waitFor({ state: 'visible' }));
      await page.locator('#deviceStatus').filter({ hasText: 'registered for SYNC' }).waitFor();
      await page.locator('.registered-devices li').filter({ hasText: 'Last active' }).waitFor();
      await page.waitForTimeout(150);
      if (captureDir && (width === 390 || width === 1366)) await page.screenshot({ path: path.join(captureDir, `calling-devices-${width}.png`) });
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
      assert.equal(callHeaders['x-danzstak-device-id'], '11111111-1111-4111-8111-111111111111');
      assert.equal(callHeaders['x-danzstak-device-token'], 'b'.repeat(43));
      assert.equal(conversationHeaders['x-danzstak-device-id'], '11111111-1111-4111-8111-111111111111');
      assert.equal(conversationHeaders['x-danzstak-device-token'], 'b'.repeat(43));
      assert.equal(directoryHeaders['x-danzstak-device-id'], '11111111-1111-4111-8111-111111111111');
      assert.equal(directoryHeaders['x-danzstak-device-token'], 'b'.repeat(43));
      assert.equal(presenceHeaders['x-danzstak-device-id'], '11111111-1111-4111-8111-111111111111');
      assert.equal(presenceHeaders['x-danzstak-device-token'], 'b'.repeat(43));
      await page.locator('#closeCallingDevices').click();
      await page.locator('.conversation-user').first().click();
      await page.locator('body.is-conversation-open').waitFor();
      await page.locator('.conversation-back').click();
      await page.waitForFunction(() => !document.body.classList.contains('is-conversation-open'));
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
