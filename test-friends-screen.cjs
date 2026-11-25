"use strict";
// Queue 5a3 (owner 2026-11-18): friends row under the profile name and the one Friends screen
// (Friends · Following · Things in common). Runs the real server functions from the call-signaling template
// against fakes, then checks the wiring of the front end.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const lines = template.split("\n").map(line => line.trim());
const pick = start => { const line = lines.find(value => value.startsWith(start)); assert.ok(line, `template has ${start}`); return line; };
const server = [
  pick("const tribeNames="), pick("const placeKey="), pick("async function accountByEmail("), pick("async function linkStates("),
  pick("async function friendsOf("), pick("async function friendCancel(")
].join("\n");

// ---------- fakes ----------
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const people = { me: 1, mara: 2, danny: 3, kemal: 4, ines: 5, theo: 6, troll: 7, stranger: 8 };
const emailOf = Object.fromEntries(Object.keys(people).map(name => [id(people[name]), `${name}@example.com`]));
const links = new Map(); // "a|b" -> status
const link = (a, b, status = "friends", back = status === "friends" ? "friends" : status === "outgoing" ? "incoming" : status) => { links.set(`${a}@example.com|${b}@example.com`, status); links.set(`${b}@example.com|${a}@example.com`, back); };
link("me", "mara"); link("me", "danny"); link("me", "kemal"); link("me", "troll", "blocked", "blocked_by");
link("mara", "danny"); link("mara", "kemal"); link("mara", "theo"); link("mara", "troll"); link("mara", "ines");
link("me", "ines", "outgoing");
const settings = { "me@example.com": "Tacoma, WA", "mara@example.com": "tacoma,  wa", "danny@example.com": "Tacoma WA", "kemal@example.com": "Seattle" };
const groups = { "me@example.com": ["default-6", "tribe-x", "gone"], "mara@example.com": ["default-6", "tribe-x", "gone"], "danny@example.com": ["default-6"], "kemal@example.com": ["tribe-x"] };
const writes = [];
const command = name => class { constructor(input) { this.input = input; this.name = name; } };
const context = {
  console, Promise, JSON, String, Number, Object, Math, Set, Map, Boolean, Array, Error,
  process: { env: { FRIENDS_TABLE: "Friends", SETTINGS_TABLE: "Settings", GROUPS_TABLE: "Groups", USER_POOL_ID: "pool" } },
  ListUsersCommand: command("ListUsers"), GetItemCommand: command("GetItem"), TransactWriteItemsCommand: command("Transact"),
  json: (statusCode, body) => ({ statusCode, body }),
  attr: (account, name) => account?.Attributes?.find(entry => entry.Name === name)?.Value || "",
  blockedStatus: status => /^blocked/.test(status || ""),
  mapLimit: async (items, limit, work) => Promise.all(items.map(work)),
  queryAll: async input => [...links].filter(([key]) => key.startsWith(`${input.ExpressionAttributeValues[":u"].S}|`)).map(([key, status]) => ({ friendEmail: { S: key.split("|")[1] }, status: { S: status } })),
  accountByMemberId: async memberId => emailOf[memberId] ? { Attributes: [{ Name: "email", Value: emailOf[memberId] }, { Name: "sub", Value: memberId }] } : null,
  cognito: { send: async request => { const email = /email = "([^"]+)"/.exec(request.input.Filter)?.[1]; const sub = Object.entries(emailOf).find(([, value]) => value === email)?.[0]; return { Users: sub ? [{ Attributes: [{ Name: "email", Value: email }, { Name: "sub", Value: sub }] }] : [] }; } },
  publicProfile: async (email, account) => ({ memberId: context.attr(account, "sub"), name: email.split("@")[0].replace(/^./, char => char.toUpperCase()), picture: email.startsWith("ines") ? "" : `https://media.example/${email.split("@")[0]}.jpg` }),
  canContact: async (a, b) => links.get(`${a}|${b}`) === "friends" || (groups[a] || []).some(group => (groups[b] || []).includes(group)),
  groupIds: async email => new Set(groups[email] || []),
  groupExists: async groupId => groupId !== "gone",
  db: { send: async request => {
    if (request.name === "Transact") { for (const item of request.input.TransactItems) { const key = `${item.Delete.Key.userEmail.S}|${item.Delete.Key.friendEmail.S}`, expected = item.Delete.ExpressionAttributeValues[Object.keys(item.Delete.ExpressionAttributeValues)[0]].S; if (links.get(key) !== expected) throw Object.assign(new Error("cancelled"), { name: "TransactionCanceledException" }); } for (const item of request.input.TransactItems) links.delete(`${item.Delete.Key.userEmail.S}|${item.Delete.Key.friendEmail.S}`); writes.push("transact"); return {}; }
    const key = request.input.Key;
    if (request.input.TableName === "Settings") return { Item: settings[key.userEmail.S] ? { profileLocation: { S: settings[key.userEmail.S] } } : undefined };
    if (request.input.TableName === "Groups") return { Item: key.userEmail.S === "GROUP#tribe-x" ? { name: { S: "Tacoma Doom" } } : undefined };
    return {};
  } }
};
vm.createContext(context);
vm.runInContext(server, context);
// Results come back as plain JSON, as API Gateway would send them (and so arrays compare across the sandbox).
const call = async (fn, user, query = {}, body) => JSON.parse(JSON.stringify(await context[fn]({ queryStringParameters: query, body: body ? JSON.stringify(body) : undefined }, { email: `${user}@example.com` })));

(async () => {
  // Owner: the whole list and count; blocked people never appear; no things in common with yourself.
  let result = await call("friendsOf", "me");
  assert.equal(result.statusCode, 200);
  assert.deepEqual([result.body.isOwner, result.body.count, result.body.common.length], [true, 3, 0]);
  assert.deepEqual(result.body.friends.map(friend => friend.name).sort(), ["Danny", "Kemal", "Mara"]);
  assert.ok(!JSON.stringify(result.body).includes("troll") && !JSON.stringify(result.body).includes("@example.com"), "no blocked people and no email addresses");

  // A friend visiting Mara: her whole list, mutual friends first, blocked people hidden.
  result = await call("friendsOf", "me", { member: id(people.mara) });
  assert.deepEqual([result.body.isFriend, result.body.listVisible, result.body.mutualCount], [true, true, 2]);
  assert.deepEqual(result.body.friends.map(friend => [friend.name, friend.mutual]), [["Danny", true], ["Kemal", true], ["Theo", false], ["Ines", false]], "mutual first, real photos before initials");
  assert.equal(result.body.count, 5, "Mara's friends include me (counted, not listed); Troll, blocked by the viewer, never shows or counts");
  // Things in common: the same city however it is typed, shared Tribes by name, and which of my friends share them.
  assert.deepEqual(result.body.common.map(item => [item.kind, item.label]), [["place", "tacoma,  wa"], ["tribe", "Bands"], ["tribe", "Tacoma Doom"]]);
  assert.deepEqual(result.body.common[0].friends.map(friend => friend.name), ["Danny"], "Danny also lives in Tacoma");
  assert.deepEqual(result.body.common[1].friends.map(friend => friend.name), ["Danny"]);
  assert.deepEqual(result.body.common[2].friends.map(friend => friend.name), ["Kemal"]);
  assert.ok(!result.body.common.some(item => item.groupId === "gone"), "deleted Tribes never count");

  // Tribe-only visitor: mutual friends only, no total.
  groups["stranger@example.com"] = ["default-6"]; link("stranger", "danny");
  result = await call("friendsOf", "stranger", { member: id(people.mara) });
  assert.deepEqual([result.body.isFriend, result.body.listVisible, result.body.count], [false, false, null]);
  assert.deepEqual(result.body.friends.map(friend => friend.name), ["Danny"]);
  // No relationship at all: 403.
  groups["stranger@example.com"] = [];
  links.delete("stranger@example.com|danny@example.com");
  assert.equal((await call("friendsOf", "theo", { member: id(people.me) })).statusCode, 403);
  assert.equal((await call("friendsOf", "me", { member: "not-an-id" })).statusCode, 400);

  // Cancel: only a pending request I sent, both rows go.
  result = await call("friendCancel", "me", {}, { memberId: id(people.ines) });
  assert.deepEqual(result, { statusCode: 200, body: { cancelled: true, memberId: id(people.ines) } });
  assert.equal(links.has("me@example.com|ines@example.com") || links.has("ines@example.com|me@example.com"), false);
  assert.equal((await call("friendCancel", "me", {}, { memberId: id(people.mara) })).statusCode, 404, "an accepted friend is not a pending request");

  // ---------- wiring ----------
  assert.match(template, /RouteKey: GET \/friends\/of,/);
  assert.match(template, /RouteKey: POST \/friends\/cancel,/);
  assert.match(template, /key==='GET \/friends\/of'\)return await friendsOf\(event,user\);if\(key==='POST \/friends\/cancel'\)return await friendCancel\(event,user\)/);
  const profile = fs.readFileSync("profile.html", "utf8"), screen = fs.readFileSync("friends.html", "utf8"), feed = fs.readFileSync("feed.html", "utf8"), sw = fs.readFileSync("service-worker.js", "utf8");
  assert.doesNotMatch(profile, /friends-row\.js/, "the facepile beside the buttons is the one friends row (owner 2026-11-19)");
  const editor = fs.readFileSync("assets/profile-editor.js", "utf8");
  assert.match(editor, /\/friends\/of\?member=\$\{encodeURIComponent\(profile\.memberId\)\}/, "a visitor's facepile reads /friends/of");
  assert.match(editor, /`friends\.html\?member=\$\{encodeURIComponent\(profile\.memberId\)\}`/, "the facepile and Friends tab open the member's Friends screen");
  assert.match(screen, /assets\/profile-sharing\.js\?v=\d+[\s\S]*assets\/friends-screen\.js\?v=\d+/, "Invite uses the shared, translated invite dialog");
  assert.match(feed, /<a href="friends\.html"><span class="menu-icon" data-menu-icon="users"/, "Menu → Friends opens the same screen");
  for (const file of ["/friends.html", "/assets/friends-screen.js", "/assets/friends-screen.css"]) assert.ok(sw.includes(`"${file}"`), `${file} is cached offline`);
  const sharing = fs.readFileSync("assets/profile-sharing.js", "utf8");
  assert.doesNotMatch(sharing, /dataset\.icon = 'users'/, "no separate people button in the profile action row");
  assert.match(sharing, /window\.danzstakInvitePeople = opener => show\('Invite People'/);
  const friendButton = fs.readFileSync("assets/profile-friend.js", "utf8");
  assert.match(friendButton, /has\(data\.outgoing\) \? "requested" : has\(data\.incoming\) \? "incoming"/, "Requested survives a reload");
  assert.match(friendButton, /API \+ "\/friends\/cancel"/, "tap Requested again to cancel");
  assert.match(friendButton, /location\.href = "friends\.html"/, "an incoming request opens Friends to answer it");

  // ---------- part 2: accepted notice (bell + push) and Accept/Delete on the lock screen ----------
  const words = vm.runInNewContext(`(${template.match(/const friendPushWords=(\{[^\n]*\});/)[1]})`);
  const languages = ["en", "es", "fr", "de", "pt", "it", "ko", "ja", "zh-Hans", "zh-Hant", "fil", "hi", "vi", "th", "id"];
  assert.deepEqual(Object.keys(words).sort(), [...languages].sort(), "friend push words in every account language");
  for (const language of languages) { assert.equal(words[language].length, 3); assert.match(words[language][1], /\{name\}/); words[language].forEach(value => assert.ok(value.trim())); }
  const push = {};
  vm.runInNewContext([template.match(/const pushTranslations=\{[\s\S]*?\};/)[0], pick("const pushFormat="), pick("const callButtonWords="), pick("const friendPushWords="), pick("function localizedPush(")].join("\n") + "\nresult.accepted=localizedPush('es','friend_accepted','Mara');result.request=localizedPush('de','friend','Mara');", { result: push });
  assert.deepEqual(JSON.parse(JSON.stringify(push.accepted)), { title: "Nuevo amigo en DanzStak", body: "Mara aceptó tu solicitud de amistad." });
  assert.equal(push.request.deleteTitle, "Löschen"); assert.ok(push.request.acceptTitle && push.request.body.includes("Mara"), "the request push carries Accept/Delete labels in the member's language");
  assert.match(template, /\{type:'friend_request',\.\.\.copy,memberId:profile\.memberId,/, "the request push names who asked, so Accept works from the lock screen");

  // friendRespond accepts a memberId (lock screen), stamps acceptedAt on the sender's row and notifies them once.
  const notified = [];
  const respondContext = { ...context, notifyFriendAccepted: async (requester, accepter) => { notified.push([requester, accepter]); }, PutItemCommand: command("Put"), DeleteItemCommand: command("Delete"), rows: new Map() };
  respondContext.db = { send: async request => {
    const key = request.input.Key || request.input.Item, id2 = `${key.userEmail.S}|${key.friendEmail.S}`;
    if (request.name === "GetItem") return { Item: respondContext.rows.get(id2) };
    if (request.name === "Put") { respondContext.rows.set(id2, request.input.Item); return {}; }
    if (request.name === "Delete") { respondContext.rows.delete(id2); return {}; }
    return {};
  } };
  vm.createContext(respondContext);
  vm.runInContext(pick("async function friendRespond("), respondContext);
  const pending = (from, to) => { respondContext.rows.set(`${to}@example.com|${from}@example.com`, { status: { S: "incoming" } }); respondContext.rows.set(`${from}@example.com|${to}@example.com`, { status: { S: "outgoing" } }); };
  pending("theo", "me");
  let answer = JSON.parse(JSON.stringify(await respondContext.friendRespond({ body: JSON.stringify({ memberId: id(people.theo), accept: true }) }, { email: "me@example.com" })));
  assert.deepEqual(answer, { statusCode: 200, body: { accepted: true } });
  assert.ok(respondContext.rows.get("theo@example.com|me@example.com").acceptedAt?.S, "the sender's row remembers when it was accepted");
  assert.equal(respondContext.rows.get("me@example.com|theo@example.com").acceptedAt, undefined, "only the sender gets the notice");
  assert.deepEqual(notified, [["theo@example.com", "me@example.com"]]);
  pending("ana", "me"); emailOf[id(9)] = "ana@example.com";
  await respondContext.friendRespond({ body: JSON.stringify({ email: "ana@example.com", accept: false }) }, { email: "me@example.com" });
  assert.equal(notified.length, 1, "nothing for declines");

  // Bell: "X accepted your friend request" for a week, then gone.
  const bell = { ...context, QueryCommand: command("Query"), queryAll: async input => input.TableName === "Friends" ? [
    { friendEmail: { S: "theo@example.com" }, status: { S: "friends" }, acceptedAt: { S: new Date().toISOString() } },
    { friendEmail: { S: "ana@example.com" }, status: { S: "friends" }, acceptedAt: { S: new Date(Date.now() - 8 * 86400000).toISOString() } },
    { friendEmail: { S: "lee@example.com" }, status: { S: "incoming" }, createdAt: { S: new Date().toISOString() } }
  ] : [] };
  bell.db = { send: async () => ({ Items: [] }) };
  vm.createContext(bell);
  vm.runInContext(pick("async function notifications("), bell);
  const notices = JSON.parse(JSON.stringify(await bell.notifications({ email: "sam@example.com" }))).body.notifications;
  assert.deepEqual(notices.map(notice => [notice.type, notice.email]).sort(), [["friend_accepted", "theo@example.com"], ["friend_request", "lee@example.com"]]);
  const feedScript = fs.readFileSync("assets/feed-enhancements.js", "utf8");
  assert.match(feedScript, /notices\.filter\(notice => notice\.type !== "friend_accepted"\)\.length/, "the accepted notice never keeps the badge lit");
  assert.match(feedScript, /kind === "friend_accepted" \? say\("\{name\} accepted your friend request\."\)/);

  // Service worker: Accept / Delete on the friend-request notification answer without opening the app.
  const worker = fs.readFileSync("service-worker.js", "utf8");
  assert.match(worker, /\{ action: "friend-accept", title: String\(payload\.acceptTitle \|\| "Accept"\)/);
  assert.match(worker, /\{ action: "friend-delete", title: String\(payload\.deleteTitle \|\| "Delete"\)/);
  assert.match(worker, /fetch\("https:\/\/api\.danzstak\.com\/friends\/respond", \{ method: "POST", credentials: "include"[^]*?body: JSON\.stringify\(\{ memberId, accept \}\)/);
  console.log("friends row + Friends screen: ok");
})().catch(error => { console.error(error); process.exitCode = 1; });
