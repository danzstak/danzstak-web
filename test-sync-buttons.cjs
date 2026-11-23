"use strict";
// Task 16-C (owner 2026-11-17): one button system (icon / primary pill / tonal / text) in design tokens, mapped onto
// SYNC first. Static guard; the real-browser audit is browser-checks/sync-buttons.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");

const css = fs.readFileSync("assets/buttons.css", "utf8");
const html = fs.readFileSync("messages.html", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const icons = fs.readFileSync("assets/icon-buttons.js", "utf8");

// Tokens and the four kinds.
for (const token of ["--ds-btn-accent", "--ds-btn-primary", "--ds-btn-tonal", "--ds-btn-press", "--ds-btn-size:44px", "--ds-btn-glyph:24px", "--ds-btn-radius:999px"]) assert.ok(css.includes(token), `missing token ${token}`);
for (const kind of [".ds-btn-icon{", ".ds-btn-primary{", ".ds-btn-tonal{", ".ds-btn-text{"]) assert.ok(css.includes(kind), `missing button kind ${kind}`);
assert.match(css, /\.ds-btn-icon,\.ds-btn-primary,\.ds-btn-tonal,\.ds-btn-text\{[^}]*-webkit-tap-highlight-color:transparent[^}]*border:0[^}]*text-transform:none/, "every kind drops the tap highlight, borders and uppercase");
assert.match(css, /\.ds-btn-icon:active\{[^}]*transform:scale\(\.9\d\)/, "icon buttons get a subtle press scale");
assert.match(css, /prefers-reduced-motion:reduce/, "press motion respects reduced motion");
// Primary (go) fill is green and keeps white text readable (#15803d on white is about 5.0:1).
assert.match(css, /--ds-btn-go:#15803d;[\s\S]*--ds-btn-primary:var\(--ds-btn-go\);/, "owner 2026-11-19: go buttons are green (white text about 5.0:1)");

// SYNC mapping: icon buttons have no border or resting fill; send is a round primary that rests grey when empty.
assert.match(css, /body\.messages-page \.chat-heading-actions>button,[\s\S]*?border:0!important;border-radius:50%!important;background:transparent!important/, "SYNC icon buttons: no border, no resting fill");
assert.match(css, /\.message-form:has\(#messageInput:placeholder-shown\):not\(:has\(#messageMediaPreview:not\(\[hidden\]\)\)\) \.message-send\{background:var\(--ds-btn-disabled\)/, "empty composer shows a calm grey send");
assert.match(css, /body\.messages-page \.sync-sections button\.active[^{]*\{background:var\(--ds-btn-tonal\)/, "active section tab is tonal, not a white card");
assert.match(css, /body\.messages-page \.sync-new-chat\{border-radius:50%!important;background:var\(--ds-btn-primary\)/, "floating new chat is a round primary");
assert.match(css, /\.contact-details-block\{[\s\S]*?background:var\(--ds-btn-danger-tonal\)/, "Block member is a quiet tonal danger button");

// Loaded on SYNC after the older button styles, and cached for offline.
assert.match(html, /<link rel="stylesheet" href="assets\/buttons\.css\?v=\d+">/, "SYNC loads the button system");
assert.ok(html.indexOf("assets/buttons.css") > html.indexOf("assets/mobile-design-system.css"), "button system loads after the older styles");
assert.ok(worker.includes('"/assets/buttons.css"'), "the PWA shell caches the button system");

// An icon button whose text a script resets (the alert bell went back to an emoji) gets its icon back.
assert.match(icons, /record\.target\.matches\("button\[data-icon\], a\.button\[data-icon\], label\[data-icon\]"\) && \[\.\.\.record\.addedNodes\]\.some\(node => node\.nodeType === Node\.TEXT_NODE\)\) upgrade\(record\.target\)/, "icon buttons re-upgrade after a text reset");

console.log("SYNC button system checks passed: tokens, four kinds, SYNC mapping, grey empty send, offline cache, bell icon restore.");
