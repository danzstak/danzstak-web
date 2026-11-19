"use strict";
// Venue freshness (task 07). Same rules as infrastructure/auth-api/booking-venue-signals.mjs;
// test-booking-venue-freshness.cjs keeps them equal. The server attaches venue.freshness; this file renders it
// and recomputes it only for checks.
(() => {
  const ACTIVE_DAYS = 180, RECENT_DAYS = 365, CLOSED_REPORTS_TO_HIDE = 2, DAY_MS = 86400000;
  const POSITIVE = [["lastBookedAt", "booked or played"], ["lastReplyAt", "replied to a pitch"], ["lastDeliveredAt", "accepted a pitch email"]];
  const within = (iso, days, nowMs) => { const at = Date.parse(iso || ""); return Number.isFinite(at) && nowMs - at < days * DAY_MS; };
  function monthYear(iso) {
    const at = new Date(iso);
    return Number.isNaN(at.getTime()) ? "" : `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][at.getUTCMonth()]} ${at.getUTCFullYear()}`;
  }
  function freshness(signal = {}, nowMs = Date.now()) {
    const positive = POSITIVE.filter(([field]) => signal[field]).sort((a, b) => signal[b[0]].localeCompare(signal[a[0]]))[0];
    const lastActivityAt = positive ? signal[positive[0]] : "";
    const after = iso => !lastActivityAt || String(iso || "") > lastActivityAt;
    if (signal.ownerStatus === "closed") return { level: "closed", label: "Closed (confirmed by DanzStak)", lastActivityAt, hidden: true };
    const reports = Number(signal.closedReports || 0);
    if (reports > 0 && signal.ownerStatus !== "open" && within(signal.closedReportedAt, RECENT_DAYS, nowMs) && after(signal.closedReportedAt)) {
      return reports >= CLOSED_REPORTS_TO_HIDE
        ? { level: "closed", label: `Reported closed by ${reports} members`, lastActivityAt, hidden: true }
        : { level: "reported_closed", label: "A member reported this club closed — check before pitching", lastActivityAt, hidden: false };
    }
    if (signal.lastBounceAt && within(signal.lastBounceAt, RECENT_DAYS, nowMs) && after(signal.lastBounceAt)) return { level: "bounced", label: "Booking address bounced — find a newer contact", lastActivityAt, hidden: false };
    if (positive && within(lastActivityAt, ACTIVE_DAYS, nowMs)) return { level: "active", label: `Active: ${positive[1]} ${monthYear(lastActivityAt)}`, lastActivityAt, hidden: false };
    if (positive && within(lastActivityAt, RECENT_DAYS, nowMs)) return { level: "recent", label: `Last activity: ${positive[1]} ${monthYear(lastActivityAt)}`, lastActivityAt, hidden: false };
    return { level: "unverified", label: "Unverified — no recent activity on DanzStak", lastActivityAt, hidden: false };
  }
  const LEVELS = new Set(["active", "recent", "unverified", "bounced", "reported_closed", "closed"]);
  // A small text chip; never trusts server text as HTML.
  function chip(venue) {
    const value = venue?.freshness;
    if (!value || !LEVELS.has(value.level) || typeof document === "undefined") return null;
    const element = document.createElement("span");
    element.className = `venue-freshness venue-freshness-${value.level.replace("_", "-")}`;
    element.textContent = String(value.label || "").slice(0, 140);
    return element;
  }
  const hidden = venue => venue?.freshness?.hidden === true;
  const api = { freshness, chip, hidden };
  if (typeof window !== "undefined") window.danzstakVenueFreshness = api;
  if (typeof module !== "undefined") module.exports = api;
})();
