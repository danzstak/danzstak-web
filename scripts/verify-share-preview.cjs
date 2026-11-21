"use strict";
// SHARE (owner 2026-11-21: shared profile links showed a grey box on Facebook). Reads the live site the way link-preview
// crawlers do, from GitHub Actions (the cloud session can't reach danzstak.com):
// - robots.txt lets Facebook's crawler read /profile.html;
// - /profile.html, fetched as facebookexternalhit, carries og:title and an og:image that loads as an image under 300 KB;
// - /@<username> (Amplify rewrite → call-signaling's share route) answers with the share page's tags and its image loads.
//   Until the owner's call-signaling and Amplify deploys are done, Amplify answers /@… with the app page; that is reported
//   as a notice. Once the route answers, anything wrong with it fails.
// Run: DANZSTAK_LIVE_URL=https://danzstak.com node scripts/verify-share-preview.cjs
const base = String(process.env.DANZSTAK_LIVE_URL || "https://danzstak.com").replace(/\/$/, "");
const CRAWLER = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
const failures = [];
const get = (url, accept = "text/html") => fetch(url, { headers: { "user-agent": CRAWLER, accept }, redirect: "follow" });
const tag = (html, attribute, key) => new RegExp(`<meta[^>]+${attribute}=["']${key.replace(/[.:]/g, "\\$&")}["'][^>]*content=["']([^"']*)["']`, "i").exec(html)?.[1] ?? null;

function robotsAllows(text, agent, path) {
  // The group whose User-agent lines name this crawler (or *), longest matching rule wins, Allow wins a tie.
  const groups = []; let current = null, inAgents = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim(); if (!line) continue;
    const [field, ...rest] = line.split(":"), value = rest.join(":").trim(), name = field.trim().toLowerCase();
    if (name === "user-agent") { if (!inAgents) { current = { agents: [], rules: [] }; groups.push(current); } current.agents.push(value.toLowerCase()); inAgents = true; }
    else if (current && (name === "allow" || name === "disallow")) { current.rules.push({ allow: name === "allow", path: value }); inAgents = false; }
    else inAgents = false;
  }
  const group = groups.find(g => g.agents.some(a => a !== "*" && agent.toLowerCase().includes(a))) || groups.find(g => g.agents.includes("*"));
  if (!group) return true;
  const matches = group.rules.filter(rule => rule.path && path.startsWith(rule.path)).sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow));
  return matches.length ? matches[0].allow : true;
}

async function checkImage(label, url) {
  if (!url) { failures.push(`${label}: no og:image`); return; }
  try {
    const response = await get(url, "image/*");
    const type = response.headers.get("content-type") || "", bytes = Buffer.from(await response.arrayBuffer());
    if (!response.ok || !/^image\/(jpeg|png|webp)/.test(type)) failures.push(`${label}: og:image ${url} answered ${response.status} ${type}`);
    else if (bytes.length >= 300 * 1024) failures.push(`${label}: og:image is ${bytes.length} bytes (WhatsApp skips previews over 300 KB)`);
    else console.log(`${label}: og:image ${response.status} ${type} ${bytes.length} bytes`);
  } catch (error) { failures.push(`${label}: og:image ${url} failed: ${error.message}`); }
}

async function run() {
  const robots = await (await get(`${base}/robots.txt`, "text/plain")).text();
  if (!robotsAllows(robots, CRAWLER, "/profile.html")) failures.push("robots.txt keeps Facebook's crawler out of /profile.html");
  if (!robotsAllows(robots, CRAWLER, "/@someone")) failures.push("robots.txt keeps Facebook's crawler out of /@ links");

  const profile = await get(`${base}/profile.html?member=00000000-0000-4000-8000-000000000000`);
  const html = await profile.text();
  if (!profile.ok) failures.push(`/profile.html answered ${profile.status}`);
  const title = tag(html, "property", "og:title");
  if (!title) failures.push("/profile.html has no og:title");
  console.log(`/profile.html: ${profile.status}, og:title "${title}"`);
  await checkImage("/profile.html", tag(html, "property", "og:image"));

  // An unknown username gets the share route's general card (og:type profile from the route, not the app page).
  const share = await get(`${base}/@danzstak-share-check`);
  const page = await share.text();
  if (tag(page, "property", "og:type") === "profile" && /location\.replace\(/.test(page)) {
    if (!share.ok) failures.push(`/@ answered ${share.status}`);
    if (tag(page, "property", "og:title") !== "A profile on DanzStak") failures.push(`/@ unknown username: og:title "${tag(page, "property", "og:title")}"`);
    console.log(`/@ share route: ${share.status}, og:title "${tag(page, "property", "og:title")}"`);
    await checkImage("/@ share route", tag(page, "property", "og:image"));
  } else {
    console.log("::notice::/@ links are not served by the share route yet (waiting for the call-signaling and Amplify deploys).");
  }

  if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
  console.log("Share previews read like a crawler: robots.txt allows profiles, /profile.html has its card, and its picture loads under 300 KB.");
}
if (require.main === module) run().catch(error => { console.error(error); process.exit(1); });
module.exports = { robotsAllows };
