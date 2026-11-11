const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const widths = [320, 360, 375, 390, 414, 430, 768, 1024, 1366];
const baseUrl = String(process.env.DANZSTAK_BASE_URL || process.env.DANZSTAK_LOCAL_URL || 'http://127.0.0.1:8016').replace(/\/$/, '');
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : '';

async function capture(page, file) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { await page.screenshot({ path: file }); return; }
    catch (error) { lastError = error; await page.waitForTimeout(250); }
  }
  throw lastError;
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [];
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, serviceWorkers: 'block' });
      const page = await context.newPage();
      page.on('pageerror', error => console.error(`Page error at ${width}px: ${error.message}`));
      page.setDefaultTimeout(8000);
      let registered = false;
      let callHeaders = {};
      let unregisteredInboxRequests = 0;
      let unregisteredConversationRequests = 0;
      let unregisteredCallRequests = 0;
      let otpSendBody = null;
      let otpConfirmBody = null;
      let registerBody = null;
      await page.route('https://api.danzstak.com/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname;
        if (path === '/auth/session') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: true, user: { email: 'browser-test@danzstak.test', sub: '33333333-3333-4333-8333-333333333333' } }) });
        if (path === '/profiles') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ profile: { name: 'Browser Test Account', isOwner: true } }) });
        if (path === '/phone-verification' && request.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ configured: true, state: 'none', verified: false, maskedNumber: '', providerAvailable: true, deviceOtpRequired: true }) });
        if (path === '/phone-verification/send') { otpSendBody = request.postDataJSON(); return route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ configured: true, state: 'pending', verified: false, maskedNumber: '•••• 1613', providerAvailable: true, deviceOtpRequired: true, resendAfter: new Date(Date.now()+60000).toISOString() }) }); }
        if (path === '/phone-verification/confirm') { otpConfirmBody = request.postDataJSON(); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ configured: true, state: 'verified', verified: true, maskedNumber: '•••• 1613', providerAvailable: true, deviceOtpRequired: true, deviceGrantId: '55555555-5555-4555-8555-555555555555', deviceGrantToken: 'c'.repeat(43) }) }); }
        if (path === '/conversations') { if (!registered) unregisteredConversationRequests += 1; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ conversations: [{ contactEmail: 'friend@danzstak.test', memberId: '44444444-4444-4444-8444-444444444444', name: 'Tour Friend', preview: 'Ready for soundcheck', updatedAt: '2026-11-09T12:00:00.000Z', canContact: true }] }) }); }
        if (path === '/friends') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ friends: [] }) });
        if (path === '/calls/directory') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ users: [] }) });
        if (path === '/messages') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ messages: [], canContact: true }) });
        if (path === '/calls/devices' && request.method() === 'GET') {
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ currentDeviceRegistered: registered, devices: registered ? [{ deviceId: '11111111-1111-4111-8111-111111111111', name: 'My test phone', allowCalls: true, registeredAt: new Date().toISOString(), lastUsedAt: new Date().toISOString(), revokedAt: '', thisDevice: true }] : [] }) });
        }
        if (path === '/calls/devices/challenge') return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ challengeId: '22222222-2222-4222-8222-222222222222', challenge: 'a'.repeat(43) }) });
        if (path === '/calls/devices/register') {
          registerBody = request.postDataJSON();
          registered = true;
          return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ deviceId: '11111111-1111-4111-8111-111111111111', deviceToken: 'b'.repeat(43), name: 'My test phone', allowCalls: true, registeredAt: new Date().toISOString() }) });
        }
        if (path === '/calls/inbox' && !registered) {
          unregisteredInboxRequests += 1;
          return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Register this device before using calls.', code: 'CALL_DEVICE_REGISTRATION_REQUIRED' }) });
        }
        if (path === '/calls/inbox') callHeaders = request.headers();
        if (!registered && ['/calls/ice', '/calls/signal'].includes(path)) unregisteredCallRequests += 1;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(path === '/calls/inbox' ? { events: [] } : {}) });
      });
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: 'commit' });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForFunction(() => typeof window.danzstakOpenCallingDevices === 'function');
      const dialog = page.locator('#callingDevicesDialog');
      await page.locator('.conversation-user').first().waitFor();
      await page.waitForTimeout(250);
      assert.equal(await dialog.isVisible(), false, `calling registration blocked text chat at ${width}px`);
      await page.waitForTimeout(2200);
      assert.equal(unregisteredInboxRequests, 1, `unregistered call polling repeated at ${width}px`);
      assert.ok(unregisteredConversationRequests >= 1, `text conversations did not load before calling registration at ${width}px`);
      await page.locator('.conversation-user').first().evaluate(node => node.click());
      await page.locator('body.is-conversation-open').waitFor();
      await page.locator('#headerPhone:not([disabled])').waitFor();
      await page.locator('#headerPhone').click();
      await assert.doesNotReject(() => dialog.waitFor({ state: 'visible' }), `calling registration did not open from Phone at ${width}px`);
      await page.locator('#callingAccountName').filter({ hasText: 'Browser Test Account' }).waitFor();
      assert.equal(await page.locator('#callingAccountName').textContent(), 'Browser Test Account', `account name did not label the device at ${width}px`);
      assert.equal(await page.locator('#registerThisDevice').count(), 0, `redundant registration button remains at ${width}px`);
      assert.equal(await page.locator('#closeCallingDevices').isVisible(), true, `call registration trapped text chat at ${width}px`);
      assert.match(await page.locator('#callingDeviceReason').textContent(), /Text messaging works without registering/);
      await page.evaluate(() => window.danzstakRequireCallingDevice({ incoming: true }));
      assert.equal(await page.locator('#callingDeviceReason').textContent(), 'Register this device to accept the call or to listen to the voice message. Text messaging still works.');
      assert.equal(unregisteredCallRequests, 0, `unregistered Phone action reached call media or signaling at ${width}px`);
      assert.equal(await page.locator('.sync-phone-verification').isVisible(), true, `SMS verification controls are missing at ${width}px`);
      const automaticDialogGeometry = await dialog.evaluate(node => { const box=node.getBoundingClientRect(); return { left:box.left, right:box.right, top:box.top, bottom:box.bottom, viewportWidth:innerWidth, viewportHeight:innerHeight }; });
      assert.ok(automaticDialogGeometry.left >= 0 && automaticDialogGeometry.right <= automaticDialogGeometry.viewportWidth && automaticDialogGeometry.top >= 0 && automaticDialogGeometry.bottom <= automaticDialogGeometry.viewportHeight, `call registration dialog overflows at ${width}px: ${JSON.stringify(automaticDialogGeometry)}`);
      if (captureDir) {
        fs.mkdirSync(captureDir, { recursive: true });
        await capture(page, path.join(captureDir, `call-registration-from-phone-${width}.png`));
      }
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(await page.locator('body.is-conversation-open').isVisible(), true, `closing registration did not return to text chat at ${width}px`);
      await page.locator('#headerVideo').click();
      await dialog.waitFor({ state: 'visible' });
      await page.locator('#syncPhoneNumber').waitFor({ state: 'visible' });
      assert.match(await page.locator('#syncPhoneTitle').textContent(), /Verify this device by SMS/);
      await page.locator('#syncPhoneNumber').fill('415 374 1613');
      await page.locator('#syncPhoneSend').click();
      await page.locator('#syncPhoneCode').waitFor({ state: 'visible' });
      await page.locator('#syncPhoneCode').scrollIntoViewIfNeeded();
      if (captureDir) await capture(page, path.join(captureDir, `call-registration-otp-${width}.png`));
      await page.locator('#syncPhoneCode').fill('123456');
      await page.locator('#syncPhoneConfirm').click();
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(otpSendBody.purpose, 'sync_device');
      assert.equal(otpSendBody.deviceChallengeId, '22222222-2222-4222-8222-222222222222');
      assert.equal(otpConfirmBody.code, '123456');
      assert.equal(registerBody.deviceGrantId, '55555555-5555-4555-8555-555555555555');
      assert.equal(registerBody.deviceGrantToken, 'c'.repeat(43));
      const storedText = await page.evaluate(async () => { const db = await new Promise((resolve,reject) => { const request=indexedDB.open('danzstak-call-device',1); request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error); }); return await new Promise((resolve,reject) => { const request=db.transaction('credentials').objectStore('credentials').get('current'); request.onsuccess=()=>resolve(JSON.stringify(request.result||{})); request.onerror=()=>reject(request.error); }); });
      assert.doesNotMatch(storedText, /123456|4153741613|deviceGrant/i, `OTP material leaked into browser storage at ${width}px`);
      await page.locator('body.sync-device-registered').waitFor();
      assert.equal(await page.locator('.ds-mobile-nav').isHidden(), true, `registered SYNC still shows the bottom navigation at ${width}px`);
      assert.equal(await page.locator('.site-ownership').isHidden(), true, `registered SYNC still shows the ownership footer at ${width}px`);
      await page.evaluate(() => window.danzstakOpenCallingDevices());
      await page.locator('#deviceStatus').filter({ hasText: 'registered for calls and voice messages' }).waitFor();
      await page.locator('.registered-devices li').filter({ hasText: 'Last active' }).waitFor();
      await page.waitForTimeout(150);
      if (captureDir) await capture(page, path.join(captureDir, `calling-devices-${width}.png`));
      await page.locator('#closeCallingDevices').click();
      await page.locator('.conversation-back').click();
      await page.waitForFunction(() => !document.body.classList.contains('is-conversation-open'));
      if (captureDir) await capture(page, path.join(captureDir, `sync-registered-no-footer-${width}.png`));
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
      assert.equal(await page.locator('#syncPhoneNumberForm').isHidden(), true, `completed registration form remains visible at ${width}px`);
      assert.equal(callHeaders['x-danzstak-device-id'], '11111111-1111-4111-8111-111111111111');
      assert.equal(callHeaders['x-danzstak-device-token'], 'b'.repeat(43));
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
