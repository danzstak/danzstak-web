"use strict";
// Audit A6/E2 (2026-11-19): members never see a raw programming error ("Cannot read properties of undefined…").
// danzstakFriendlyError(error, fallback) returns the server's own words when they are meant for people, and the
// plain fallback for anything that came from a bug, a broken connection or a malformed reply.
(() => {
  const programmerError = /Cannot read propert|Cannot set propert|undefined|null is not|is not a function|is not defined|is not iterable|before initialization|Unexpected token|JSON\.parse|Failed to fetch|NetworkError|Load failed|\[object /i;
  window.danzstakFriendlyError = (error, fallback = "Something went wrong on our side. Try again in a moment.") => {
    const message = String(error && typeof error === "object" && "message" in error ? error.message : (error || "")).trim();
    if (!message || error instanceof TypeError || error instanceof ReferenceError || error instanceof SyntaxError || programmerError.test(message)) return fallback;
    return message;
  };
})();
