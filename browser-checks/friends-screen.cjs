"use strict";
// Queue 5a3: friends row under the profile name, and the one Friends screen (Friends · Following · Things in common).
//   node scripts/static-server.cjs 8132   (repo root), then: node browser-checks/friends-screen.cjs
//   (DANZSTAK_BROWSER_CHANNEL=bundled uses Playwright's own Chromium instead of Edge)
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const widths = (process.env.DANZSTAK_WIDTHS || "320,360,390,430,768,1024").split(",").map(Number);
const output = path.resolve("docs/screenshots/friends-screen");
fs.mkdirSync(output, { recursive: true });
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const pic = color => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="${color}"/></svg>`)}`;
const ME = id(1), MARA = id(2);
const friend = (n, name, extra = {}) => ({ memberId: id(n), name, picture: extra.picture === undefined ? pic(["#c0392b", "#16794a", "#1f4e99", "#8a3a0c"][n % 4]) : extra.picture, mutual: Boolean(extra.mutual) });

function api(route, calls) {
  const request = route.request(), url = new URL(request.url()), method = request.method(), body = request.postData() ? request.postDataJSON() : null;
  calls.push(`${method} ${url.pathname}${url.search}`);
  const reply = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
  const visitor = url.searchParams.get("member") === MARA;
  switch (url.pathname) {
    case "/auth/session": return reply({ authenticated: true, user: { sub: ME } });
    case "/profiles": return reply(visitor ? { memberId: MARA, isOwner: false, name: "Mara Voss", handle: "maravoss", bio: "Doom and drums.", location: "Tacoma, WA" } : { memberId: ME, isOwner: true, name: "Sam Ortiz", handle: "samortiz", bio: "Punk from Tacoma." });
    case "/friends/of": return reply(visitor
      ? { isOwner: false, isFriend: true, listVisible: true, count: 5, mutualCount: 3, friends: [friend(3, "Danny Cole", { mutual: true }), friend(4, "Kemal Arslan", { mutual: true }), friend(5, "Ines Ruiz", { mutual: true, picture: "" }), friend(6, "Theo Park"), friend(7, "Ana Lima")], common: [{ kind: "place", label: "Tacoma, WA", friends: [friend(3, "Danny Cole"), friend(4, "Kemal Arslan")], others: 47 }, { kind: "tribe", label: "Bands", groupId: "default-6", friends: [friend(5, "Ines Ruiz", { picture: "" })], others: 0 }] }
      : { isOwner: true, isFriend: false, listVisible: true, count: 4, mutualCount: 0, friends: [friend(2, "Mara Voss"), friend(3, "Danny Cole"), friend(4, "Kemal Arslan"), friend(5, "Ines Ruiz", { picture: "" })], common: [] });
    case "/friends": return reply({ friends: [friend(2, "Mara Voss"), friend(3, "Danny Cole"), friend(4, "Kemal Arslan"), friend(5, "Ines Ruiz", { picture: "" })].map(f => ({ ...f, email: `${f.name.split(" ")[0].toLowerCase()}@example.com` })), incoming: [{ ...friend(8, "Jo Reyes"), email: "jo@example.com" }, { ...friend(9, "Lee Wu"), email: "lee@example.com" }], outgoing: [{ ...friend(10, "Rita Hale"), email: "rita@example.com" }] });
    case "/calls/directory": return reply({ users: [{ memberId: id(3), online: true }] });
    case "/friends/respond": assert.deepEqual(body, { email: "jo@example.com", accept: true }); return reply({ accepted: true });
    case "/friends/cancel": assert.deepEqual(body, { memberId: id(10) }); return reply({ cancelled: true, memberId: id(10) });
    default: return reply({});
  }
}

(async () => {
  const browser = await chromium.launch(process.env.DANZSTAK_BROWSER_CHANNEL === "bundled" ? { headless: true } : { channel: process.env.DANZSTAK_BROWSER_CHANNEL || "msedge", headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, serviceWorkers: "block", reducedMotion: "reduce", deviceScaleFactor: 1 });
      const page = await context.newPage(), errors = [], calls = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => api(route, calls));

      // Someone else's profile: "3 mutual friends" as the facepile at the end of the action row; it opens the Friends screen.
      await page.goto(`${origin}/profile.html?member=${MARA}`, { waitUntil: "domcontentloaded" });
      const row = page.locator(".profile-actions .profile-facepile:not([hidden])");
      await row.waitFor();
      assert.equal(await row.getAttribute("aria-label"), "3 mutual friends");
      assert.equal(await page.locator(".profile-facepile-face").count(), 4, "up to 4 small friend photos, an initial when a photo is missing");
      assert.equal(await page.locator('.profile-actions [data-icon="users"]').count(), 0, "no separate people button in the action row");
      assert.ok((await row.boundingBox()).height >= 44);
      await page.screenshot({ path: path.join(output, `profile-visitor-${width}.png`) });
      await page.locator('[data-profile-tab="Friends"]').click();
      await page.waitForURL(`**/friends.html?member=${MARA}`);

      // The Friends screen for Mara: her name on top, mutual friends first, Message only for my friends.
      await page.locator("#friendsTitle", { hasText: "Mara Voss" }).waitFor();
      await page.locator("#friendsList .friends-row").first().waitFor();
      const names = await page.locator("#friendsList .friends-copy strong").allInnerTexts();
      assert.deepEqual(names.slice(0, 3), ["Danny Cole", "Kemal Arslan", "Ines Ruiz"], "mutual friends first");
      assert.equal(await page.getByRole("link", { name: "Message Danny Cole" }).count(), 1);
      assert.equal(await page.getByRole("link", { name: "Message Theo Park" }).count(), 0, "no Message for people who are not my friends");
      assert.match(await page.locator("#friendsStatus").innerText(), /5 friends · 3 mutual/);
      assert.equal(await page.locator("#friendsOwnerRow").isHidden(), true, "requests row is for the owner only");
      await page.locator("#friendsSearchToggle").click();
      await page.locator("#friendsSearch").fill("kem");
      assert.deepEqual(await page.locator("#friendsList .friends-copy strong").allInnerTexts(), ["Kemal Arslan"]);
      await page.locator("#friendsSearchToggle").click();
      await page.getByRole("tab", { name: "Things in common" }).click();
      await page.locator(".friends-common-item").first().waitFor();
      assert.deepEqual(await page.locator(".friends-common-item strong").allInnerTexts(), ["Lives in Tacoma, WA", "Bands Tribe"]);
      assert.match(await page.locator(".friends-common-item small").first().innerText(), /Danny, Kemal and 47 others also have this/);
      await page.screenshot({ path: path.join(output, `common-${width}.png`) });
      await page.getByRole("tab", { name: "Following" }).click();
      assert.match(await page.locator("#panelFollowing").innerText(), /once Follow opens/);
      await page.keyboard.press("ArrowLeft");
      assert.equal(await page.getByRole("tab", { name: "Friends", exact: true }).getAttribute("aria-selected"), "true");

      // My own screen: requests on top (Accept / Delete / Cancel), Find friends and Invite, no things-in-common tab.
      await page.goto(`${origin}/friends.html`, { waitUntil: "domcontentloaded" });
      await page.locator("#friendsTitle", { hasText: "Sam Ortiz" }).waitFor();
      await page.locator("#friendsRequestsToggle", { hasText: "2 friend requests" }).waitFor();
      assert.equal(await page.getByRole("tab", { name: "Things in common" }).isHidden(), true);
      assert.equal(await page.locator("#friendsRequests").isVisible(), true, "incoming requests open by default");
      assert.match(await page.locator("#friendsList .friends-row").first().innerText(), /Danny Cole[\s\S]*Online now/, "online friends first");
      await page.screenshot({ path: path.join(output, `own-${width}.png`) });
      for (const target of await page.locator(".friends-topbar-button, .friends-chip:visible, .friends-tabs [role=tab]:visible, .friends-actions button, .friends-message").all()) {
        const box = await target.boundingBox();
        assert.ok(box.height >= 40, `${width}px: target ${(await target.innerText()) || await target.getAttribute("aria-label")} is ${box.height}px`);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 0, `${width}px: no horizontal overflow (${overflow})`);
      await page.getByRole("button", { name: "Cancel friend request to Rita Hale" }).click();
      await page.waitForFunction(() => document.body.textContent.includes("Friend request cancelled."));
      await page.locator("#friendsRequests").getByRole("button", { name: "Accept" }).first().click();
      await page.waitForFunction(() => document.body.textContent.includes("You and Jo Reyes are friends."));
      assert.ok(calls.includes("POST /friends/cancel") && calls.includes("POST /friends/respond"));
      assert.deepEqual(errors, [], `${width}px: no page errors`);
      await context.close();
      console.log(`ok ${width}px`);
    }
    // Every word in the visitor's language (owner 2026-11-16): the same screen on an Italian phone at 360px.
    const italian = await browser.newContext({ locale: "it-IT", viewport: { width: 360, height: 800 }, serviceWorkers: "block", deviceScaleFactor: 1 });
    const page = await italian.newPage(), calls = [];
    await page.route("https://api.danzstak.com/**", route => api(route, calls));
    await page.goto(`${origin}/friends.html`, { waitUntil: "domcontentloaded" });
    await page.locator("#friendsRequestsToggle", { hasText: "2 richieste di amicizia" }).waitFor();
    const text = await page.locator("body").innerText();
    for (const word of ["Trova persone", "Invita", "Richieste inviate", "Accetta", "Elimina", "Seguiti", "4 amici"]) assert.ok(text.toLowerCase().includes(word.toLowerCase()), `Italian: "${word}" is shown`);
    for (const english of ["Invite", "Requests sent", "Following", "friends", "Delete"]) assert.ok(!new RegExp(`\\b${english}\\b`).test(text), `Italian: no English "${english}" left`);
    const owner = await page.locator("#friendsOwnerRow").boundingBox(), chips = await page.locator("#friendsOwnerRow .friends-chip:visible").evaluateAll(list => list.map(chip => chip.getBoundingClientRect().right));
    assert.ok(chips.every(right => right <= owner.x + owner.width + 0.5), "Italian: every chip fits on screen (they wrap, never cut off)");
    await italian.close();
    console.log("ok it-IT 360px");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
