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

// Tap the centre of the control (owner: tap icon centres, not the button box); fails if something else is on top.
async function tapCentre(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const ok = await locator.evaluate((node, [px, py]) => { const top = document.elementFromPoint(px, py); return node === top || node.contains(top); }, [x, y]);
  assert.ok(ok, `nothing covers the centre of ${await locator.evaluate(node => node.getAttribute("aria-label") || node.textContent.trim())}`);
  await page.mouse.click(x, y);
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
      assert.equal(await page.locator(".profile-facepile .ds-facepile__face").count(), 4, "up to 4 small friend photos, an initial when a photo is missing");
      assert.equal(await page.locator('.profile-actions [data-icon="users"]').count(), 0, "no separate people button in the action row");
      assert.ok((await row.boundingBox()).height >= 44);
      await page.screenshot({ path: path.join(output, `profile-visitor-${width}.png`) });
      await page.locator('[data-profile-tab="Friends"]').click();
      await page.waitForURL(`**/friends.html?member=${MARA}`);

      // The Friends screen for Mara (UI kit screen 4a): her name on top, mutual friends first, kit rows, Message behind ⋯.
      await page.locator("#friendsTitle", { hasText: "Mara Voss" }).waitFor();
      await page.locator("#friendsList .ds-row").first().waitFor();
      const names = await page.locator("#friendsList .ds-row__name").allInnerTexts();
      assert.deepEqual(names.slice(0, 3), ["Danny Cole", "Kemal Arslan", "Ines Ruiz"], "mutual friends first");
      assert.equal(await page.locator("#friendsList a.button, #friendsList .friends-message").count(), 0, "no message buttons on the rows (F9: Message sits behind ⋯)");
      assert.match(await page.locator("#friendsStatus").innerText(), /5 friends · 3 mutual/);
      assert.equal(await page.locator("#friendsRequests").isHidden(), true, "requests are for the owner only");
      assert.equal(await page.locator("#friendsInvite").isHidden(), true, "Invite is for the owner only");
      // ⋯ on a friend of mine: Message + View profile; on someone who isn't: View profile only.
      await tapCentre(page, page.getByRole("button", { name: "More options for Danny Cole" }));
      const sheet = page.locator(".ds-sheet.is-open");
      await sheet.waitFor();
      assert.equal(await sheet.getByRole("link", { name: "Message Danny Cole" }).getAttribute("href"), `feed.html?messageMember=${id(3)}`);
      await page.keyboard.press("Escape"); await sheet.waitFor({ state: "detached" });
      await tapCentre(page, page.getByRole("button", { name: "More options for Theo Park" }));
      await sheet.waitFor();
      assert.equal(await sheet.getByRole("link", { name: /^Message/ }).count(), 0, "no Message for people who are not my friends");
      await page.keyboard.press("Escape"); await sheet.waitFor({ state: "detached" });
      await tapCentre(page, page.locator("#friendsSearchToggle"));
      await page.locator("#friendsSearch").fill("kem");
      assert.deepEqual(await page.locator("#friendsList .ds-row__name").allInnerTexts(), ["Kemal Arslan"]);
      await tapCentre(page, page.locator("#friendsSearchToggle"));
      await tapCentre(page, page.getByRole("tab", { name: "Things in common" }));
      await page.locator(".friends-common-item").first().waitFor();
      assert.deepEqual(await page.locator(".friends-common-item .ds-row__name").allInnerTexts(), ["Lives in Tacoma, WA", "Bands Tribe"]);
      assert.match(await page.locator(".friends-common-item .ds-row__sub").first().innerText(), /Danny, Kemal and 47 others also have this/);
      assert.equal(await page.locator(".friends-common-item").first().locator(".ds-facepile__face").count(), 2, "a facepile of the friends who share it");
      await page.screenshot({ path: path.join(output, `common-${width}.png`) });
      await tapCentre(page, page.getByRole("tab", { name: "Following" }));
      assert.match(await page.locator("#panelFollowing").innerText(), /once Follow opens/);
      await page.keyboard.press("ArrowLeft");
      assert.equal(await page.getByRole("tab", { name: "Friends", exact: true }).getAttribute("aria-selected"), "true");
      // A tap anywhere on a row (its centre, not the ⋯) opens that friend's profile.
      await tapCentre(page, page.locator("#friendsList .ds-row").first());
      await page.waitForURL(`**/profile.html?member=${id(3)}`);

      // My own screen: requests on top as rows (Accept / Delete / Cancel), Find friends row, Invite in the bar.
      await page.goto(`${origin}/friends.html`, { waitUntil: "domcontentloaded" });
      await page.locator("#friendsTitle", { hasText: "Sam Ortiz" }).waitFor();
      await page.locator("#friendsRequests .ds-section__title", { hasText: "Friend requests" }).waitFor();
      assert.equal(await page.getByRole("tab", { name: "Things in common" }).isHidden(), true);
      assert.equal(await page.locator("#friendsRequests .ds-row").count(), 3, "2 requests and 1 sent");
      assert.match(await page.locator("#friendsList .ds-row").first().innerText(), /Danny Cole[\s\S]*Online now/, "online friends first");
      assert.equal(await page.locator("#friendsInvite").isVisible(), true);
      await page.screenshot({ path: path.join(output, `own-${width}.png`), fullPage: true });
      for (const target of await page.locator(".ds-appbar .ds-icon-btn:visible, .ds-pill:visible, #friendsRequests .ds-btn, .ds-row__more, #friendsFind").all()) {
        const box = await target.boundingBox();
        assert.ok(box.height >= 44 && box.width >= 44, `${width}px: target ${(await target.innerText()) || await target.getAttribute("aria-label")} is ${box.width}x${box.height}px`);
      }
      // Nothing painted over a row's ⋯ (the row's own tap target sits under it).
      for (const more of await page.locator(".ds-row__more").all()) {
        const hit = await more.evaluate(node => { const r = node.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return node.contains(top); });
        if (await more.isVisible() && (await more.boundingBox()).y < (width < 700 ? 780 : 840)) assert.ok(hit, `${width}px: the ⋯ is on top where it is tapped`);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 0, `${width}px: no horizontal overflow (${overflow})`);
      await tapCentre(page, page.locator("#friendsFind"));
      const finder = page.locator(".ds-sheet.is-open .ds-search input");
      await finder.waitFor();
      await finder.fill("jo");
      for (let i = 0; i < 40 && !calls.some(call => call.startsWith("GET /people?query=jo")); i += 1) await page.waitForTimeout(100);
      assert.ok(calls.some(call => call.startsWith("GET /people?query=jo")), "Find friends searches every member");
      await page.keyboard.press("Escape"); await page.locator(".ds-sheet").waitFor({ state: "detached" });
      await tapCentre(page, page.getByRole("button", { name: "Cancel friend request to Rita Hale" }));
      await page.waitForFunction(() => document.body.textContent.includes("Friend request cancelled."));
      await page.locator("#friendsList[aria-busy]").waitFor({ state: "detached" }); // the list reloads after a cancel
      await tapCentre(page, page.locator("#friendsRequests").getByRole("button", { name: "Accept" }).first());
      await page.waitForFunction(() => document.body.textContent.includes("You and Jo Reyes are friends."));
      assert.ok(calls.includes("POST /friends/cancel") && calls.includes("POST /friends/respond"));
      assert.deepEqual(errors, [], `${width}px: no page errors`);
      await context.close();
      console.log(`ok ${width}px`);
    }
    // Night (follows the phone): kit surfaces turn dark, names stay readable.
    const night = await browser.newContext({ colorScheme: "dark", viewport: { width: 390, height: 844 }, serviceWorkers: "block", reducedMotion: "reduce", deviceScaleFactor: 1 });
    { const page = await night.newPage(), calls = [];
      await page.route("https://api.danzstak.com/**", route => api(route, calls));
      await page.goto(`${origin}/friends.html`, { waitUntil: "domcontentloaded" });
      await page.locator("#friendsList .ds-row").first().waitFor();
      const [bg, ink] = await page.locator(".ds-page").evaluate(node => [getComputedStyle(node).backgroundColor, getComputedStyle(node.querySelector(".ds-row__name")).color]);
      assert.equal(bg, "rgb(21, 21, 23)", "Night surface");
      assert.equal(ink, "rgb(237, 237, 234)", "Night ink");
      await page.screenshot({ path: path.join(output, "own-night-390.png"), fullPage: true });
    }
    await night.close();
    console.log("ok night 390px");
    // Every word in the visitor's language (owner 2026-11-16): the same screen on an Italian phone at 360px.
    const italian = await browser.newContext({ locale: "it-IT", viewport: { width: 360, height: 800 }, serviceWorkers: "block", deviceScaleFactor: 1 });
    const page = await italian.newPage(), calls = [];
    await page.route("https://api.danzstak.com/**", route => api(route, calls));
    await page.goto(`${origin}/friends.html`, { waitUntil: "domcontentloaded" });
    await page.locator("#friendsRequests .ds-section__title", { hasText: "Richieste di amicizia" }).waitFor();
    const text = await page.locator("body").innerText();
    for (const word of ["Trova persone", "Cerca chiunque su DanzStak", "Richieste inviate", "Accetta", "Elimina", "Seguiti", "4 amici"]) assert.ok(text.toLowerCase().includes(word.toLowerCase()), `Italian: "${word}" is shown`);
    for (const english of ["Invite", "Requests sent", "Following", "friends", "Delete"]) assert.ok(!new RegExp(`\\b${english}\\b`).test(text), `Italian: no English "${english}" left`);
    assert.equal(await page.locator("#friendsInvite").getAttribute("aria-label"), "Invita");
    assert.equal(await page.getByRole("button", { name: "Altre opzioni per Danny Cole" }).count(), 1, "Italian: the ⋯ names the friend in Italian");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 0, "Italian: no horizontal overflow");
    await page.screenshot({ path: path.join(output, "own-it-360.png"), fullPage: true });
    await italian.close();
    console.log("ok it-IT 360px");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
