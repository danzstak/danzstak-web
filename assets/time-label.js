"use strict";
// One time label for posts and comments everywhere (audit 36 B4). Before: Mix posts said "2d", profile posts said
// "11/17/2026, 4:34:35 PM" and comments a third way ("2 days ago"), from three formatters. Now: short and in the
// member's language ("now", "5m", "3h", "2d", then "Nov 18", with the year when it isn't this year); the full date and
// time is the title.
(() => {
  if (window.danzstakTimeLabel) return;
  const STEPS = [[3600, 60, "minute"], [86400, 3600, "hour"], [604800, 86400, "day"]];

  function label(value, now = Date.now()) {
    const date = value instanceof Date ? value : new Date(value || "");
    if (Number.isNaN(date.getTime())) return { text: "", title: "", iso: "" };
    const locale = document.documentElement.lang || undefined;
    const title = date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }), iso = date.toISOString();
    const seconds = Math.max(0, (now - date.getTime()) / 1000);
    if (seconds < 60) return { text: window.danzstakTranslate?.("now") || "now", title, iso };
    for (const [limit, size, unit] of STEPS)
      if (seconds < limit) return { text: new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "narrow" }).format(Math.floor(seconds / size)), title, iso };
    const sameYear = date.getFullYear() === new Date(now).getFullYear();
    return { text: date.toLocaleDateString(locale, sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" }), title, iso };
  }

  // Writes the label into a <time> (or any element); returns false when the date is not valid.
  function paint(element, value) {
    const { text, title, iso } = label(value);
    if (!text) return false;
    element.textContent = text;
    element.title = title;
    if (element.tagName === "TIME") element.dateTime = iso;
    return true;
  }

  window.danzstakTimeLabel = Object.freeze({ label, paint });
})();
