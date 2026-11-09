"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const feed = fs.readFileSync("feed.html", "utf8");
const source = fs.readFileSync("assets/profile-onboarding.js", "utf8");
const serviceWorker = fs.readFileSync("service-worker.js", "utf8");

assert.doesNotMatch(feed, /id="profileOnboarding"/, "Mix must not block an established member with a naming prompt");
assert.doesNotMatch(feed, /What should people call you\?|Use this name/, "retired first-login naming copy must not appear in Mix");
assert.doesNotMatch(feed, /assets\/profile-onboarding\.css/, "the retired naming card stylesheet must not load on Mix");
assert.match(feed, /assets\/profile-onboarding\.js\?v=12/, "Mix must load the current non-blocking menu identity hydrator");
assert.match(serviceWorker, /"\/assets\/profile-onboarding\.js"/, "the installed app must keep menu identity hydration available offline");

assert.match(source, /function updateMenuProfile\(profile = \{\}\)/, "the account profile must populate the navigation header");
assert.match(source, /menuProfileName\.textContent = name/, "the drawer must show the member display name instead of a generic account label");
assert.match(source, /window\.danzstakIdentityMedia\?\.install\(menuProfileImage, profile\)/, "the drawer avatar must use the resilient identity-media loader");
assert.match(source, /fetch\("https:\/\/api\.danzstak\.com\/profiles", \{[\s\S]*credentials: "include"[\s\S]*cache: "no-store"/, "menu identity must come from the authenticated profile without a stale browser cache");
assert.doesNotMatch(source, /method:\s*"POST"/, "opening Mix must never submit or rename an established account");
assert.doesNotMatch(source, /profileOnboarding|needsIdentityOnboarding|danzstak_name_prompt_dismissed_/, "the retired blocking onboarding state must not survive in the menu hydrator");
assert.doesNotMatch(source, /profile\.email|profile\.username|email address/i, "menu identity hydration must not expose account email or login identity");
assert.match(feed, /aria-label="Find friends and see who is online"/, "the top people icon must clearly identify friend discovery");

console.log("Profile identity checks passed: Mix opens directly, does not rename the account, and hydrates the menu from the signed profile.");
