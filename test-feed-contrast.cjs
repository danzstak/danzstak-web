const fs = require("node:fs");
const assert = require("node:assert/strict");

const feed = fs.readFileSync("feed.html", "utf8");

function luminance(hex) {
  const rgb = hex.match(/[\da-f]{2}/gi).map(value => Number.parseInt(value, 16) / 255);
  const linear = rgb.map(value => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

for (const selector of [".post-time", ".muted"]) {
  const escaped = selector.replace(".", "\\.");
  const match = feed.match(new RegExp(`${escaped}\\s*\\{[^}]*color:\\s*(#[\\da-f]{6})`, "i"));
  assert.ok(match, `${selector} must define an explicit readable color`);
  assert.ok(contrast(match[1], "#ffffff") >= 4.5,
    `${selector} must meet WCAG AA contrast for small text on white`);
}

console.log("Feed contrast checks passed: timestamps and muted guidance meet WCAG AA on light cards.");
