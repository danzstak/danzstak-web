// Venue freshness (task 07, part A.2–A.3). One shared, privacy-safe record per venue:
// dates of real events (delivered pitch, reply, booked show, hard bounce) and closed reports.
// It never stores who pitched, who booked or which address bounced.
// The browser copy of freshness() lives in assets/booking-freshness.js; test-booking-venue-freshness.cjs keeps them equal.

export const VENUE_SIGNAL_OWNER = "BOOKING#VENUE_SIGNAL";
export const VENUE_REPORT_OWNER = "BOOKING#VENUE_REPORT";
export const ACTIVE_DAYS = 180;
export const RECENT_DAYS = 365;
export const CLOSED_REPORTS_TO_HIDE = 2;
const DAY_MS = 86400000;

export const SIGNAL_FIELDS = Object.freeze({ delivered: "lastDeliveredAt", reply: "lastReplyAt", booked: "lastBookedAt", bounce: "lastBounceAt" });
const POSITIVE = [["lastBookedAt", "booked or played"], ["lastReplyAt", "replied to a pitch"], ["lastDeliveredAt", "accepted a pitch email"]];

export function validSignalVenueKey(value) { return typeof value === "string" && value.length >= 6 && value.length <= 240 && /^[a-zA-Z0-9_.:-]+$/.test(value); }
export function venueSignalKey(venueKey) { return { userId: { S: VENUE_SIGNAL_OWNER }, tourId: { S: venueKey } }; }

// Only moves a date forward; a stale or duplicate event changes nothing.
export function signalUpdate(tableName, venueKey, kind, at) {
  const field = SIGNAL_FIELDS[kind];
  if (!field || !validSignalVenueKey(venueKey) || !at) return null;
  return { TableName: tableName, Key: venueSignalKey(venueKey), UpdateExpression: "SET #field = :at", ConditionExpression: "attribute_not_exists(#field) OR #field < :at", ExpressionAttributeNames: { "#field": field }, ExpressionAttributeValues: { ":at": { S: at } } };
}

// Plain object from a DynamoDB item (or {} when the venue has no history).
export function signalFromItem(item) {
  if (!item) return {};
  const out = {};
  for (const field of [...Object.values(SIGNAL_FIELDS), "closedReportedAt", "ownerStatus", "ownerReviewedAt"]) if (item[field]?.S) out[field] = item[field].S;
  if (item.closedReports?.N) out.closedReports = Number(item.closedReports.N) || 0;
  return out;
}

const within = (iso, days, nowMs) => { const at = Date.parse(iso || ""); return Number.isFinite(at) && nowMs - at < days * DAY_MS; };

// level: active | recent | unverified | bounced | reported_closed | closed. `hidden` = hide by default.
export function freshness(signal = {}, nowMs = Date.now()) {
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

function monthYear(iso) {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? "" : `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][at.getUTCMonth()]} ${at.getUTCFullYear()}`;
}

export const FRESHNESS_RANK = { active: 0, recent: 1, unverified: 2, bounced: 3, reported_closed: 3, closed: 4 };

// Proven rooms rise, doubtful rooms sink; otherwise keep the incoming (suitability) order.
export function sortByFreshness(venues) {
  return venues.map((venue, index) => ({ venue, index })).sort((a, b) => (FRESHNESS_RANK[a.venue.freshness?.level] ?? 2) - (FRESHNESS_RANK[b.venue.freshness?.level] ?? 2) || a.index - b.index).map(entry => entry.venue);
}

// Member report: "This club closed" or "Changed booker" with the new public contact. Owner-reviewable.
export const REPORT_KINDS = ["closed", "new_contact"];
export function cleanReport(data) {
  const kind = REPORT_KINDS.includes(String(data?.kind)) ? String(data.kind) : "";
  const venueKey = String(data?.venueKey || "").trim();
  const email = String(data?.contactEmail || "").trim().toLowerCase().slice(0, 254);
  const url = String(data?.contactUrl || "").trim().slice(0, 600);
  const note = String(data?.note || "").replace(/\s+/g, " ").trim().slice(0, 500);
  if (!kind || !validSignalVenueKey(venueKey)) return { error: "Choose a saved venue and what changed." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter the new public booking email, or leave it blank." };
  if (url && !/^https:\/\/[^\s]+$/i.test(url)) return { error: "The new booking page must be an https:// link." };
  if (kind === "new_contact" && !email && !url) return { error: "Add the new public booking email or booking page." };
  return { kind, venueKey, email, url, note };
}
