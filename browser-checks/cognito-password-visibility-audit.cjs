"use strict";

const { chromium } = require("playwright-core");

const LOGIN_URL = process.env.DANZSTAK_LOGIN_URL || "https://api.danzstak.com/auth/login";
const WIDTHS = [320, 360, 390, 414, 430, 1366];
const STRICT = process.argv.includes("--strict");

function roundedRect(rect) {
  if (!rect) return null;
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  };
}

async function auditSignup(page, width) {
  await page.goto(LOGIN_URL, { waitUntil: "networkidle" });
  const signupUrl = await page.getByRole("link", { name: /create an account/i }).getAttribute("href");
  if (!signupUrl) throw new Error("Managed Login did not expose its signup route");
  await page.goto(new URL(signupUrl, page.url()).toString(), { waitUntil: "networkidle" });

  const passwordInputs = page.locator('input[autocomplete="new-password"]');
  const fieldCount = await passwordInputs.count();
  const controls = page.getByLabel(/show password/i);
  const visibilityControlCount = await controls.count();
  const beforeTypes = await passwordInputs.evaluateAll(inputs => inputs.map(input => input.type));
  const inputRects = [];
  for (let index = 0; index < fieldCount; index += 1) {
    inputRects.push(roundedRect(await passwordInputs.nth(index).boundingBox()));
  }

  let controlRect = null;
  if (visibilityControlCount === 1) {
    controlRect = roundedRect(await controls.boundingBox());
    await controls.check();
  }
  const afterTypes = await passwordInputs.evaluateAll(inputs => inputs.map(input => input.type));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

  return {
    width,
    route: new URL(page.url()).pathname,
    fieldCount,
    visibilityControlCount,
    independentControls: visibilityControlCount === fieldCount,
    hiddenByDefault: beforeTypes.every(type => type === "password"),
    sharedToggleRevealsAll: fieldCount > 1 && afterTypes.every(type => type === "text"),
    controlRect,
    controlMeets44pxTarget: Boolean(controlRect && controlRect.width >= 44 && controlRect.height >= 44),
    inputRects,
    overflow
  };
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const results = [];
  try {
    for (const width of WIDTHS) {
      const page = await browser.newPage({ viewport: { width, height: width < 600 ? 844 : 900 } });
      results.push(await auditSignup(page, width));
      await page.close();
    }
  } finally {
    await browser.close();
  }

  const acceptanceSatisfied = results.every(result =>
    result.fieldCount === 2 &&
    result.independentControls &&
    result.hiddenByDefault &&
    result.controlMeets44pxTarget &&
    !result.overflow
  );
  console.log(JSON.stringify({ loginUrl: LOGIN_URL, acceptanceSatisfied, results }, null, 2));

  if (STRICT && !acceptanceSatisfied) {
    console.error("Cognito Managed Login does not satisfy the independent password-eye acceptance criteria.");
    process.exitCode = 1;
  }
})().catch(error => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
