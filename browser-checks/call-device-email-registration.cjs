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
  const browser = await chromium.launch({ channel: process.env.DANZSTAK_BROWSER_CHANNEL || 'msedge', headless: true });
  const results = [];
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, serviceWorkers: 'block' });
      const page = await context.newPage();
      page.on('pageerror', error => { throw new Error(`Page error at ${width}px: ${error.message}`); });
      page.setDefaultTimeout(8000);
      let registered = false, phoneSends = 0, emailSendBody = null, emailConfirmBody = null, registerBody = null;
      await page.route('https://api.danzstak.com/**', async route => {
        const request = route.request(), p = new URL(request.url()).pathname, ok = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
        if (p === '/auth/session') return ok(200, { authenticated: true, user: { email: 'browser-test@danzstak.test', sub: '33333333-3333-4333-8333-333333333333' } });
        if (p === '/profiles') return ok(200, { profile: { name: 'Browser Test Account', isOwner: true } });
        // Carrier SMS not approved (sandbox) but email codes are on: the worldwide fallback.
        if (p === '/phone-verification' && request.method() === 'GET') return ok(200, { configured: true, state: 'none', verified: false, maskedNumber: '', providerAvailable: false, emailCodeAvailable: true, deviceOtpRequired: true });
        if (p === '/phone-verification/send') { phoneSends += 1; return ok(503, { error: 'blocked' }); }
        if (p === '/device-verification/email/send') { emailSendBody = request.postDataJSON(); return ok(202, { state: 'pending', channel: 'email', maskedEmail: 'b•••@danzstak.test', resendAfter: new Date(Date.now() + 60000).toISOString(), expiresAt: new Date(Date.now() + 600000).toISOString() }); }
        if (p === '/device-verification/email/confirm') { emailConfirmBody = request.postDataJSON(); return ok(200, { state: 'verified', channel: 'email', deviceGrantId: '55555555-5555-4555-8555-555555555555', deviceGrantToken: 'c'.repeat(43) }); }
        if (p === '/conversations') return ok(200, { conversations: [{ contactEmail: 'friend@danzstak.test', memberId: '44444444-4444-4444-8444-444444444444', name: 'Tour Friend', preview: 'Ready for soundcheck', updatedAt: '2026-11-09T12:00:00.000Z', canContact: true }] });
        if (p === '/friends') return ok(200, { friends: [] });
        if (p === '/calls/directory') return ok(200, { users: [] });
        if (p === '/messages') return ok(200, { messages: [], canContact: true });
        if (p === '/calls/devices' && request.method() === 'GET') return ok(200, { currentDeviceRegistered: registered, devices: registered ? [{ deviceId: '11111111-1111-4111-8111-111111111111', name: 'My test phone', allowCalls: true, registeredAt: new Date().toISOString(), lastUsedAt: new Date().toISOString(), revokedAt: '', thisDevice: true }] : [] });
        if (p === '/calls/devices/challenge') return ok(201, { challengeId: '22222222-2222-4222-8222-222222222222', challenge: 'a'.repeat(43) });
        if (p === '/calls/devices/register') { registerBody = request.postDataJSON(); registered = true; return ok(201, { deviceId: '11111111-1111-4111-8111-111111111111', deviceToken: 'b'.repeat(43), name: 'My test phone', allowCalls: true, registeredAt: new Date().toISOString() }); }
        if (p === '/calls/inbox' && !registered) return ok(403, { error: 'Register this device before using calls.', code: 'CALL_DEVICE_REGISTRATION_REQUIRED' });
        return ok(200, p === '/calls/inbox' ? { events: [] } : {});
      });
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: 'commit' });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForFunction(() => typeof window.danzstakOpenCallingDevices === 'function');
      await page.locator('.conversation-user').first().waitFor();
      await page.locator('.conversation-user').first().evaluate(node => node.click());
      await page.locator('body.is-conversation-open').waitFor();
      await page.locator('#headerVideo:not([disabled])').waitFor();
      await page.locator('#headerVideo').click();
      const dialog = page.locator('#callingDevicesDialog');
      await dialog.waitFor({ state: 'visible' });
      const emailButton = page.locator('#syncEmailSend');
      await emailButton.waitFor({ state: 'visible' });
      assert.equal(await page.locator('#syncPhoneSend').isDisabled(), true, `SMS send should be disabled while carrier SMS is unavailable at ${width}px`);
      assert.match(await page.locator('#syncPhoneStatus').textContent(), /Tap Email/);
      assert.equal(await emailButton.getAttribute('aria-label'), 'Email me a code instead');
      assert.equal(await emailButton.locator('svg[data-ds-icon="case-mail"]').count(), 1, 'music icon missing');
      assert.equal((await page.locator('#syncPhoneTitle').textContent()).trim(), 'Verify this device', `title still promises SMS at ${width}px`);
      const box = await emailButton.boundingBox();
      assert.ok(box.height >= 44 && box.x >= 0 && box.x + box.width <= width, `email button size/overflow at ${width}px: ${JSON.stringify(box)}`);
      if (captureDir) { fs.mkdirSync(captureDir, { recursive: true }); await emailButton.scrollIntoViewIfNeeded(); await capture(page, path.join(captureDir, `email-code-offer-${width}.png`)); }
      await emailButton.click();
      await page.locator('#syncPhoneCode').waitFor({ state: 'visible' });
      assert.match(await page.locator('#syncPhoneStatus').textContent(), /b•••@danzstak\.test/);
      if (captureDir) { await page.locator('#syncPhoneCode').scrollIntoViewIfNeeded(); await capture(page, path.join(captureDir, `email-code-entry-${width}.png`)); }
      await page.locator('#syncPhoneCode').fill('123456');
      await page.locator('#syncPhoneConfirm').click();
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(phoneSends, 0, 'no SMS request when using email');
      assert.equal(emailSendBody.deviceChallengeId, '22222222-2222-4222-8222-222222222222');
      assert.equal(emailSendBody.deviceChallenge, 'a'.repeat(43));
      assert.equal(emailConfirmBody.code, '123456');
      assert.equal(emailConfirmBody.deviceChallengeId, '22222222-2222-4222-8222-222222222222');
      assert.equal(registerBody.deviceGrantId, '55555555-5555-4555-8555-555555555555');
      assert.equal(registerBody.deviceGrantToken, 'c'.repeat(43));
      await page.locator('body.sync-device-registered').waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, `page overflows at ${width}px`);
      results.push(`${width}px`);
      await context.close();
    }
    console.log(`Email device registration browser checks passed: ${results.join(', ')}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
