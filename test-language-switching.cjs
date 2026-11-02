const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const handlers = {},
  store = new Map([["danzstak_language", "ja"]]);
const ui = { nodeValue: "Settings", parentElement: { closest: () => false } },
  post = { nodeValue: "Settings", parentElement: { closest: () => true } },
  status = {
    nodeValue: "Save Settings",
    parentElement: { closest: () => false },
  };
const input = {
  attrs: { placeholder: "Write a message" },
  value: "User typed Settings",
  closest: () => false,
  hasAttribute(k) {
    return k in this.attrs;
  },
  getAttribute(k) {
    return this.attrs[k];
  },
  setAttribute(k, v) {
    this.attrs[k] = v;
  },
};
const textarea = {
  attrs: { placeholder: "What's on your mind?" },
  value: "User typed Settings",
  closest: (selector) => selector.includes("textarea"),
  hasAttribute(k) {
    return k in this.attrs;
  },
  getAttribute(k) {
    return this.attrs[k];
  },
  setAttribute(k, v) {
    this.attrs[k] = v;
  },
};
const document = {
  readyState: "complete",
  documentElement: { lang: "en" },
  body: { querySelectorAll: () => [input, textarea] },
  querySelectorAll: () => [],
  createTreeWalker() {
    let index = 0;
    const nodes = [ui, post, status];
    return { nextNode: () => nodes[index++] || null };
  },
};
const window = { parent: null };
const context = vm.createContext({
  window,
  document,
  NodeFilter: { SHOW_TEXT: 4 },
  MutationObserver: class {
    observe() {}
  },
  localStorage: {
    getItem: (k) => store.get(k),
    setItem: (k, v) => store.set(k, v),
  },
  addEventListener: (n, fn) => (handlers[n] = fn),
  queueMicrotask: (fn) => fn(),
  URL,
  location: {
    origin: "https://danzstak.com",
    href: "https://danzstak.com/feed.html",
  },
});
vm.runInContext(fs.readFileSync("assets/languages.js", "utf8"), context);
vm.runInContext(
  fs.readFileSync("assets/brand-language-aliases.js", "utf8"),
  context,
);
vm.runInContext(fs.readFileSync("assets/i18n.js", "utf8"), context);
assert.equal(window.danzstakLanguages.length, 15);
assert.equal(ui.nodeValue, "設定");
assert.equal(post.nodeValue, "Settings", "user posts must never be translated");
assert.equal(input.value, "User typed Settings");
assert.equal(
  textarea.value,
  "User typed Settings",
  "user-entered textarea content must never be translated",
);
assert.equal(
  textarea.attrs.placeholder,
  "今何を考えていますか？",
  "textarea guidance should be translated without changing its value",
);
assert.equal(window.danzstakTranslate("Your Mix"), "あなたのミックス");
assert.equal(window.danzstakTranslate("Flashes"), "フラッシュ");
assert.equal(window.danzstakTranslate("The Roll"), "ザ・ロール");
assert.equal(window.danzstakTranslate("Tribes"), "トライブ");
window.danzstakSetLanguage("ko");
assert.equal(ui.nodeValue, "설정");
assert.equal(
  window.danzstakTranslate("⚙ Settings and privacy"),
  "⚙ 설정 및 개인정보",
);
assert.equal(window.danzstakTranslate("Your Mix"), "나의 믹스");
assert.equal(window.danzstakTranslate("Flashes"), "플래시");
assert.equal(window.danzstakTranslate("The Roll"), "더 롤");
assert.equal(window.danzstakTranslate("Tribes"), "트라이브");
assert.equal(input.attrs.placeholder, "메시지 입력");
window.danzstakSetLanguage("it");
assert.equal(window.danzstakTranslate("Your Mix"), "Il tuo Mix");
assert.equal(window.danzstakTranslate("Flashes"), "Flash");
assert.equal(window.danzstakTranslate("The Roll"), "The Roll");
assert.equal(window.danzstakTranslate("Tribes"), "Tribù");
assert.equal(window.danzstakTranslate("Back to Your Mix"), "Torna al tuo Mix");
window.danzstakSetLanguage("fil");
assert.equal(ui.nodeValue, "Mga setting");
window.danzstakSetLanguage("en");
assert.equal(ui.nodeValue, "Settings");
assert.equal(window.danzstakTranslate("Your Mix"), "Your Mix");
assert.equal(window.danzstakTranslate("Flashes"), "Flashes");
assert.equal(window.danzstakTranslate("The Roll"), "The Roll");
assert.equal(window.danzstakTranslate("Tribes"), "Tribes");
assert.equal(input.attrs.placeholder, "Write a message");
assert.equal(textarea.attrs.placeholder, "What's on your mind?");
status.nodeValue = "Cancel";
window.danzstakSetLanguage("ja");
assert.equal(
  status.nodeValue,
  "キャンセル",
  "new UI state uses the new source text",
);
assert.equal(window.danzstakSetLanguage("unsupported"), "en");
for (const [language] of window.danzstakLanguages) {
  window.danzstakSetLanguage(language);
  for (const source of [
    "Type their name. They do not need to be online.",
    "Finding users online…",
    "No other users are online right now. Your accepted friends remain listed below.",
    "Find friends and see who is online",
  ]) {
    const translated = window.danzstakTranslate(source);
    if (language !== "en")
      assert.notEqual(
        translated,
        source,
        `${language} needs localized friend guidance for: ${source}`,
      );
  }
  for (const source of [
    "Enable call alerts",
    "Call alerts enabled — tap to enable sound in this session",
    "Start a new chat",
    "Search DanzStak messages",
    "Chat filters",
    "Saved chats",
    "Loading saved chats…",
    "Loading contacts…",
  ]) {
    const translated = window.danzstakTranslate(source);
    if (language !== "en")
      assert.notEqual(
        translated,
        source,
        `${language} needs localized message guidance for: ${source}`,
      );
  }
  for (const source of [
    "Ready to start a secure call.",
    "Select a saved chat or an available friend to begin messaging.",
    "Attach photo or video",
    "Open camera to take a photo or video",
    "Take a photo or video",
    "Send message",
    "Conversation",
  ]) {
    const translated = window.danzstakTranslate(source);
    if (language !== "en")
      assert.notEqual(
        translated,
        source,
        `${language} needs localized empty-conversation guidance for: ${source}`,
      );
  }
  for (const source of [
    "Audience",
    "Add location (optional)",
    "City, venue, or place",
    "+ Interest",
    "Choose your news interest",
    "Music",
    "Top News",
    "Entertainment",
    "Technology",
    "Sports",
    "Business",
    "Checking who is online…",
  ]) {
    const translated = window.danzstakTranslate(source);
    if (language !== "en")
      assert.notEqual(
        translated,
        source,
        `${language} needs localized feed controls for: ${source}`,
      );
  }
  for (const source of [
    "Profile posting and tagging",
    "Allow friends to tag me in photos and videos",
    "Manage profile posting and tagging permissions",
    "Manage call and message alerts",
    "Manage app and device settings",
    "View your DanzStak activity",
    "Download my DanzStak data",
    "Log out of DanzStak",
  ]) {
    const translated = window.danzstakTranslate(source);
    if (language !== "en")
      assert.notEqual(
        translated,
        source,
        `${language} needs localized settings guidance for: ${source}`,
      );
  }
  for (const source of [
    "Loading Flashes",
    "Loading saved posts...",
    "Loading news…",
    "Externally hosted videos",
    "Open The Roll fullscreen",
    "External video URL",
    "I own this video or have permission to share its external link.",
    "Videos shared to The Roll will appear here.",
    "© 2026 DanzStak LLC. All rights reserved.",
    "User content belongs to its creators.",
    "Add a photo or video to share this post to Flashes",
    "Add a video before sharing it to The Roll",
  ]) {
    const translated = window.danzstakTranslate(source);
    if (language !== "en")
      assert.notEqual(
        translated,
        source,
        `${language} needs localized feed loading, Roll, and ownership copy for: ${source}`,
      );
  }
  for (const source of [
    "Like comment",
    "Dislike post",
    "Dislike comment",
    "Remove dislike reaction",
    "Save post",
    "Remove post from Saved",
    "Post options",
    "View post",
    "Open on source",
    "You are online. No other connected users are active right now.",
    "No other connected users are active right now.",
    "Show more posts",
  ]) {
    const translated = window.danzstakTranslate(source);
    if (language !== "en")
      assert.notEqual(
        translated,
        source,
        `${language} needs localized social actions for: ${source}`,
      );
  }
  for (const [source, preserved] of [
    ["Open Sigmund profile", "Sigmund"],
    ["Reply to Sigmund", "Sigmund"],
    ["View post from Sigmund", "Sigmund"],
    ["Show more posts. 12 remaining.", "12"],
  ]) {
    const translated = window.danzstakTranslate(source);
    if (language !== "en") assert.notEqual(translated, source, `${language} needs a localized social template for: ${source}`);
    assert.match(translated, new RegExp(preserved), `${language} must preserve member names and counts in: ${source}`);
  }
  if (language !== "en")
    assert.notEqual(
      window.danzstakTranslate("2 matching members."),
      "2 matching members.",
      `${language} needs localized member counts`,
    );
}
window.danzstakSetLanguage("zh-CN");
assert.equal(
  document.documentElement.lang,
  "zh-Hans",
  "regional Simplified Chinese resolves correctly",
);
window.danzstakSetLanguage("zh-TW");
assert.equal(
  document.documentElement.lang,
  "zh-Hant",
  "regional Traditional Chinese resolves correctly",
);
const line = fs
  .readFileSync("infrastructure/call-signaling/template.yaml", "utf8")
  .split("\n")
  .find((x) => x.includes("async function setPresenceSetting("));
const writes = [];
const backend = vm.createContext({
  process: { env: { SETTINGS_TABLE: "settings" } },
  UpdateItemCommand: class {
    constructor(input) {
      this.input = input;
    }
  },
  db: { send: async (c) => writes.push(c.input) },
  json: (status, payload) => ({ statusCode: status, payload }),
});
vm.runInContext(line.trim(), backend);
(async () => {
  for (const [language] of window.danzstakLanguages) {
    const result = await backend.setPresenceSetting(
      {
        body: JSON.stringify({
          onlineVisible: true,
          darkMode: false,
          reduceMotion: false,
          dataSaver: false,
          language,
        }),
      },
      { email: "owner@example.com" },
    );
    assert.equal(result.statusCode, 200, language);
  }
  const before = writes.length;
  assert.equal(
    (
      await backend.setPresenceSetting(
        {
          body: JSON.stringify({
            onlineVisible: true,
            darkMode: false,
            reduceMotion: false,
            dataSaver: false,
            language: "invalid",
          }),
        },
        { email: "owner@example.com" },
      )
    ).statusCode,
    400,
  );
  assert.equal(writes.length, before);
  console.log(
    "Language checks passed: 15 locales, localized name/friend/settings guidance, regional Chinese resolution, branded labels, source restoration, user-content protection, and server validation.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
