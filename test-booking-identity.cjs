const fs = require("node:fs");
const assert = require("node:assert/strict");

const html = fs.readFileSync("booking.html", "utf8");
const client = fs.readFileSync("assets/booking-identity.js", "utf8");
const agent = fs.readFileSync("assets/booking-agent.js", "utf8");
const css = fs.readFileSync("assets/booking-agent-driver.css", "utf8");
const api = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const deploy = fs.readFileSync("aws-deploy-auth-api.ps1", "utf8");
const serviceWorker = fs.readFileSync("service-worker.js", "utf8");

const identityAt = html.indexOf('class="booking-identity"');
const briefAt = html.indexOf('class="booking-brief"');
const toolsAt = html.indexOf('class="booking-tools"');
assert.ok(identityAt > 0 && identityAt < briefAt && identityAt < toolsAt, "Act and Home city must be visible above search and advanced tools");
assert.equal((html.match(/id="bandName"/g) || []).length, 1);
assert.equal((html.match(/id="startCity"/g) || []).length, 1);
assert.doesNotMatch(html, /Prefer boxes\? Enter your home town/, "the redundant nested identity disclosure must be removed");
assert.match(html, /id="saveBookingIdentity"/);
assert.match(html, /assets\/booking-identity\.js\?v=1/);
assert.match(css, /\.booking-identity-fields\{display:grid;grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
assert.match(css, /@media\(max-width:600px\)[\s\S]*\.booking-identity-fields\{grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
assert.match(client, /request\("\/booking-pipeline"\)/);
assert.match(client, /request\("\/epk"\)/);
assert.match(client, /request\("\/profiles"\)/);
assert.match(client, /savedAct \|\| String\(epk\.artistName \|\| profile\.name/);
assert.match(client, /savedCity \|\| String\(epk\.hometown \|\| profile\.location/);
assert.match(client, /request\("\/booking-pipeline\/identity"/);
assert.match(client, /JSON\.stringify\(\{ name, hometown, revision \}\)/, "the client must send only identity fields and its optimistic revision");
assert.doesNotMatch(agent, /\$\("startCity"\)\.value = ""/, "startup must not erase a saved Home city after identity loading");
assert.match(api, /async function bookingIdentity\(event\)/);
assert.match(api, /currentRevision !== data\.revision/);
assert.match(api, /venues: Array\.isArray\(saved\.venues\) \? saved\.venues : \[\]/, "identity saves must preserve selected venues");
assert.match(api, /method === "PATCH" && path === "\/booking-pipeline\/identity"/);
assert.match(deploy, /PATCH \/booking-pipeline\/identity/);
assert.match(serviceWorker, /danzstak-shell-v775/);
assert.match(serviceWorker, /"\/assets\/booking-identity\.js"/);

console.log("Booking identity checks passed: top placement, canonical fallbacks, scoped persistence, conflict safety, responsive layout, and PWA caching.");
