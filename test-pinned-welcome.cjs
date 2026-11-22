"use strict";
// Directive F15b (owner 2026-11-19): the DanzStak welcome post stays first in Mix until 20 January 2027, then falls
// back into its chronological place; it says "Tribe", never "group"; it is one tight paragraph; members can't pin.
const assert = require("node:assert/strict");
const fs = require("node:fs");

(async () => {
  const { activePinUntil, orderMixPosts } = await import("./infrastructure/auth-api/index.mjs");
  const { WELCOME_TEXT, PINNED_UNTIL, isWelcomePost } = await import("./infrastructure/auth-api/set-welcome-post.mjs");
  const item = (postId, createdAt, pinnedUntil) => ({ postId: { S: postId }, createdAt: { S: createdAt }, ...(pinnedUntil ? { pinnedUntil: { S: pinnedUntil } } : {}) });
  const items = [item("welcome", "2026-11-01T10:00:00.000Z", PINNED_UNTIL), item("newer", "2026-12-24T10:00:00.000Z"), item("older", "2026-10-01T10:00:00.000Z")];
  const mix = now => orderMixPosts(items.map(entry => ({ postId: entry.postId.S, createdAt: entry.createdAt.S, pinnedUntil: activePinUntil(entry, now) }))).map(post => post.postId);
  // The clock is injected: before the date the welcome post is first; on and after it, plain chronological order.
  assert.deepEqual(mix(Date.parse("2026-12-24T12:00:00Z")), ["welcome", "newer", "older"], "pinned first until the date");
  assert.deepEqual(mix(Date.parse(PINNED_UNTIL)), ["newer", "welcome", "older"], "chronological from the date on");
  assert.deepEqual(mix(Date.parse("2027-02-01T00:00:00Z")), ["newer", "welcome", "older"], "chronological after the date");
  assert.equal(PINNED_UNTIL, "2027-01-20T00:00:00.000Z", "pinned until about four weeks after doors open");
  assert.equal(activePinUntil(item("x", "2026-11-01T00:00:00Z", "not a date"), Date.now()), "", "a bad date never pins");

  // The text: Tribe, never group; one tight paragraph ending with the question.
  assert.match(WELCOME_TEXT, /\bTribe\b/, "the welcome says Tribe");
  assert.doesNotMatch(WELCOME_TEXT, /\bgroups?\b/i, "no 'group' in the welcome");
  assert.doesNotMatch(WELCOME_TEXT, /\n/, "no line breaks or blank lines");
  assert.match(WELCOME_TEXT, /^Welcome to DanzStak! .+ What are you creating today\?$/);
  assert.equal(isWelcomePost({ content: { S: "Welcome to DanzStak! Old text about groups" } }), true);
  assert.equal(isWelcomePost({ content: { S: "Welcome to DanzStak!" }, groupId: { S: "g1" } }), false, "a Tribe post is never the welcome post");

  // Members can't pin: no API route writes pinnedUntil; only the owner's script does.
  const api = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
  const writes = api.split("\n").filter(line => /pinnedUntil/.test(line) && /UpdateExpression|PutItem|Item:\s*\{|data\.pinnedUntil|body\.pinnedUntil/.test(line));
  assert.deepEqual(writes, [], "no API route writes pinnedUntil");
  assert.match(api, /pinnedUntil: activePinUntil\(item\),/, "the posts list sends pinnedUntil only while it is in the future");
  assert.match(api, /body: JSON\.stringify\(\{ posts: orderMixPosts\(posts\) \}\)/, "the posts list puts the pin first");

  // Mix shows the pin label and the translated official text; the translations exist.
  const feed = fs.readFileSync("feed.html", "utf8"), people = fs.readFileSync("assets/i18n-people.js", "utf8");
  assert.match(feed, /if \(Date\.parse\(post\.pinnedUntil \|\| ""\) > Date\.now\(\)\) \{/, "Mix labels an active pin");
  assert.match(feed, /pin\.textContent = feedTranslate\("Pinned"\);/);
  assert.equal(people.split(JSON.stringify(WELCOME_TEXT) + ":").length - 1, 3, "the welcome text is translated (it, fr, es)");
  console.log("Pinned welcome checks passed: first until 20 Jan 2027 then chronological (clock injected), says Tribe, one tight paragraph, only the owner's script can pin, Mix labels it and translates it.");
})().catch(error => { console.error(error); process.exitCode = 1; });
