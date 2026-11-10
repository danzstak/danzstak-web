"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const feed = fs.readFileSync("feed.html", "utf8");

const css = fs.readFileSync("assets/feed-enhancements.css", "utf8");

assert.match(source, /canonicalName === "Notifications" && !usesMobileNotificationHistory\(\)/, "desktop alone may use the notification drawer");
assert.match(source, /activateMobileScreen\(canonicalName\)/, "mobile Notifications and Friends share the exclusive workspace controller");
assert.match(source, /document\.body\.dataset\.mobileScreen = nextScreen/, "one mobile screen value is the source of truth");
assert.match(source, /nextScreen !== "notifications"[\s\S]*?closeNotificationDrawer\(false, \{ fromHistory: true \}\)/, "leaving Notifications deactivates any legacy notification drawer");
assert.match(source, /nextScreen !== "chat"\) closeMessageDrawerForMobileNavigation\(\)/, "opening another primary screen closes the desktop-style Chat drawer");
assert.match(feed, /matchMedia\("\(max-width: 700px\)"\)\.matches[\s\S]*?location\.assign\(target\.href\)/, "mobile Chat navigates to the dedicated Messages page instead of opening a popup");
assert.match(feed, /target\.searchParams\.set\("return", location\.pathname \+ location\.search \+ location\.hash\)/, "the dedicated Chat screen retains its previous DanzStak route");
assert.match(css, /body\[data-mobile-screen="notifications"\] #newsFeedView,[\s\S]*?display:none!important/, "Notifications hides the underlying feed on mobile");
assert.match(css, /\.notification-drawer\{inset:0;width:100vw;height:100dvh/, "a retained notification drawer can never be a floating phone popup");
assert.match(feed, /assets\/feed-enhancements\.js\?v=547/, "the feed loads the exclusive navigation build");

console.log("Mobile notification checks passed: Notifications is a dedicated workspace, Chat is a real screen, and primary panels cannot stack.");
