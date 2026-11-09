"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.2:8022").replace(/\/$/, "");
const captureDir = path.resolve(process.env.DANZSTAK_CAPTURE_DIR || "docs/screenshots/epk-reviews");
const widths = [320, 360, 390, 414, 430, 1366];

const kit = {
  artistName: "The Night Circuit",
  hometown: "Berlin, Germany",
  genres: ["Techno"],
  look: "techno",
  shortPitch: "A focused live set built for independent rooms.",
  shortBio: "The Night Circuit combines live electronics, drums and sharp visual production.",
  releases: ["Signal Path — 12-inch — 2026"],
  musicLinks: [{ label: "Listen on Bandcamp", url: "https://example.bandcamp.com/album/signal-path" }],
  notableShows: ["Independent Hall, Berlin — 2026"],
  bookingName: "Tour Contact",
  bookingEmail: "booking@example.com",
  media: []
};

const targets = {
  artistPublicId: "night-circuit",
  artistName: "The Night Circuit",
  canReview: true,
  targets: [
    { targetType: "show", targetId: "show-1", title: "Independent Hall, Berlin — 2026" },
    { targetType: "release", targetId: "release-1", title: "Signal Path — 12-inch — 2026" }
  ]
};

const reviews = {
  reviews: [{
    reviewId: "review-1",
    targetType: "show",
    targetId: "show-1",
    targetTitle: "Independent Hall, Berlin — 2026",
    body: "The live set was tight, physical and built for the room without losing the detail in the production.",
    authorName: "Scene Reviewer",
    authorAvatar: "",
    createdAt: "2026-11-07T18:00:00.000Z",
    ownedByViewer: true
  }]
};

(async () => {
  fs.mkdirSync(captureDir, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
      const page = await context.newPage();
      page.setDefaultTimeout(12000);
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/epk/public/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ kit }) }));
      await page.route("https://api.danzstak.com/review-targets**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(targets) }));
      await page.route("https://api.danzstak.com/reviews**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(reviews) }));
      await page.route("https://api.danzstak.com/auth/session", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ signedIn: true }) }));

      await page.goto(`${baseUrl}/epk.html?id=night-circuit`, { waitUntil: "domcontentloaded" });
      try {
        await page.locator("#epkReviewList .epk-review-card").waitFor({ state: "visible" });
      } catch (error) {
        const debug = await page.evaluate(() => ({
          reviewsHidden: document.getElementById("epkReviews")?.hidden,
          status: document.getElementById("epkReviewsStatus")?.textContent,
          notice: document.getElementById("publicEpkNotice")?.textContent,
          cards: document.querySelectorAll("#epkReviewList .epk-review-card").length
        }));
        throw new Error(`${error.message}; state=${JSON.stringify(debug)}; pageErrors=${errors.join(" | ")}`);
      }
      const state = await page.evaluate(() => {
        const section = document.getElementById("epkReviews");
        const card = section.querySelector(".epk-review-card");
        const buttons = [...section.querySelectorAll("button")];
        return {
          documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
          sectionWidth: section.getBoundingClientRect().width,
          cardWidth: card.getBoundingClientRect().width,
          minButtonHeight: Math.min(...buttons.map(button => button.getBoundingClientRect().height)),
          formVisible: !document.getElementById("epkReviewForm").hidden,
          reviewText: card.querySelector(".epk-review-card__body").textContent
        };
      });
      assert.equal(errors.length, 0, `${width}px browser errors: ${errors.join(" | ")}`);
      assert.ok(state.documentWidth <= width, `reviews overflow at ${width}px: ${JSON.stringify(state)}`);
      assert.ok(state.sectionWidth <= width, `reviews section exceeds viewport at ${width}px`);
      assert.ok(state.cardWidth <= state.sectionWidth, `review card exceeds section at ${width}px`);
      assert.ok(state.minButtonHeight >= 44, `review controls are shorter than 44px at ${width}px`);
      assert.equal(state.formVisible, true, `eligible member composer is hidden at ${width}px`);
      assert.match(state.reviewText, /tight, physical/);
      await page.screenshot({ path: path.join(captureDir, `reviews-${width}.png`), fullPage: true });
      await context.close();
    }
    const cases = [
      { name: "session-network-error", reviews: "ok", targets: "ok", session: "fail", visible: true, composer: false },
      { name: "targets-timeout", reviews: "ok", targets: "fail", session: "ok", visible: true, composer: false },
      { name: "reviews-fail", reviews: "fail", targets: "ok", session: "ok", visible: false, composer: false },
      { name: "all-succeed", reviews: "ok", targets: "ok", session: "ok", visible: true, composer: true }
    ];
    for (const width of [390, 1366]) for (const testCase of cases) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
      const page = await context.newPage();
      await page.route("https://api.danzstak.com/epk/public/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ kit }) }));
      await page.route("https://api.danzstak.com/reviews**", route => testCase.reviews === "ok" ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(reviews) }) : route.abort("failed"));
      await page.route("https://api.danzstak.com/review-targets**", route => testCase.targets === "ok" ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(targets) }) : route.abort("timedout"));
      await page.route("https://api.danzstak.com/auth/session", route => testCase.session === "ok" ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ signedIn: true }) }) : route.abort("failed"));
      await page.goto(`${baseUrl}/epk.html?id=night-circuit`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => document.getElementById("epkReviews")?.dataset.reviewsReady === "true");
      const state = await page.evaluate(() => ({ sectionVisible: !document.getElementById("epkReviews").hidden, composerVisible: !document.getElementById("epkReviewForm").hidden, cards: document.querySelectorAll("#epkReviewList .epk-review-card").length, status: document.getElementById("epkReviewsStatus").textContent }));
      assert.equal(state.sectionVisible, testCase.visible, `${width}px ${testCase.name} section visibility: ${JSON.stringify(state)}`);
      assert.equal(state.composerVisible, testCase.composer, `${width}px ${testCase.name} composer visibility: ${JSON.stringify(state)}`);
      assert.equal(state.cards, testCase.visible ? 1 : 0, `${width}px ${testCase.name} published review count: ${JSON.stringify(state)}`);
      assert.doesNotMatch(state.status, /unavailable|error|failed/i, `${width}px ${testCase.name} exposed an optional-service error`);
      await context.close();
    }
    console.log(`EPK review browser checks passed at ${widths.join(", ")}px with no overflow and touch-sized controls.`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
