"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const feed = fs.readFileSync("feed.html", "utf8");
const behavior = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const styles = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const i18n = fs.readFileSync("assets/i18n.js", "utf8");

assert.match(feed, /data-feature="News"[\s\S]*data-menu-icon="globe"/, "News must be a real menu destination with a shared icon");
assert.match(behavior, /if \(name === "News"\)/, "News must render as a dedicated workspace");
assert.match(behavior, /\["Friends", "Groups", "News",/, "News must participate in browser history and deep links");
assert.match(behavior, /role", "tablist"/, "News topics must use an accessible tab list");
assert.match(behavior, /\["ArrowLeft", "ArrowRight", "Home", "End"\]/, "News topics must support keyboard navigation");
assert.match(feed, /const newsLoadVersions = new WeakMap\(\)/, "each News surface must have independent request-race protection");
assert.match(feed, /window\.danzstakLoadNews/, "the existing provider-backed loader must be reusable by the workspace");
assert.match(feed, /\["http:", "https:"\]\.includes\(newsUrl\.protocol\)/, "News links must reject unsafe schemes");
assert.match(feed, /newsUrl\.username \|\| newsUrl\.password/, "News links must reject URLs containing credentials");
assert.match(feed, /referrerPolicy = "no-referrer"/, "external News links must not leak the current page as a referrer");
assert.match(styles, /\.news-workspace-list\{[^}]*grid-template-columns:repeat\(auto-fit,minmax\(260px,1fr\)\)/, "desktop News cards must use a responsive grid");
assert.match(styles, /@media\(max-width:700px\)[^}]*\.news-workspace/s, "News must have explicit phone layout rules");
assert.match(styles, /\.news-category-tab\{[^}]*min-height:44px/, "topic controls must preserve phone touch geometry");
assert.match(feed, /feed-enhancements\.css\?v=501/);
assert.match(feed, /feed-enhancements\.js\?v=530/);
assert.match(feed, /i18n\.js\?v=395/);
assert.match(worker, /danzstak-shell-v699/);

const keysMatch = i18n.match(/const newsWorkspaceKeys=(\[[^;]+\]);/);
const translationsMatch = i18n.match(/const newsWorkspace=(\{[\s\S]*?\r?\n \});\r?\n for\(const \[language,values\] of Object\.entries\(newsWorkspace\)\)/);
assert.ok(keysMatch && translationsMatch, "News workspace translations must remain inspectable");
const context = vm.createContext({ result:null });
vm.runInContext(`result={keys:${keysMatch[1]},translations:${translationsMatch[1]}}`, context);
const languages = ["es","fr","de","pt","it","ko","ja","zh-Hans","zh-Hant","fil","hi","vi","th","id"];
assert.equal(context.result.keys.length, 5);
assert.deepEqual(Object.keys(context.result.translations).sort(), [...languages].sort());
for (const language of languages) assert.equal(context.result.translations[language].length, context.result.keys.length, `${language} must translate the complete News workspace`);

console.log("News workspace checks passed: mobile route, real provider loader, safe links, keyboard tabs, responsive cards, localization, and PWA refresh.");
