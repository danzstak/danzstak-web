// Booking pipeline rules (task 02). Pure functions shared by the workspace save,
// the workspace read and the follow-up checks. The browser copy lives in
// assets/booking-pipeline.js; test-booking-pipeline-stages.cjs keeps them identical.

export const BOOKING_STATUSES = ["Not contacted", "Email prepared", "Email sent", "Reply received", "Interested", "Negotiating", "Date proposed", "Confirmed", "Played", "Declined", "No response"];
export const PIPELINE_STAGES = ["found", "pitched", "replied", "offer", "confirmed", "played", "passed", "no_reply"];
export const STAGE_BY_STATUS = {
  "Not contacted": "found", "Email prepared": "found",
  "Email sent": "pitched",
  "Reply received": "replied", "Interested": "replied", "Negotiating": "replied",
  "Date proposed": "offer",
  "Confirmed": "confirmed",
  "Played": "played",
  "Declined": "passed",
  "No response": "no_reply"
};
// One step at a time. Passed and played are final; offer can fall back to talking.
export const NEXT_STAGES = {
  found: ["found", "pitched"],
  pitched: ["pitched", "replied", "no_reply", "passed"],
  replied: ["replied", "offer", "passed"],
  offer: ["offer", "replied", "confirmed", "passed"],
  confirmed: ["confirmed", "played", "passed"],
  played: ["played"],
  passed: ["passed"],
  no_reply: ["no_reply", "replied", "passed"]
};
export const FOLLOW_UP_DAYS = 5;
const DAY_MS = 86400000;
const PITCH_STATUSES = new Set(["provider_accepted", "sent", "delivered", "replied"]);

export function stageOf(status) { return STAGE_BY_STATUS[status] || "found"; }

// Stages reachable from `from` by allowed single steps (a save may batch several steps).
export function reachableStages(from) {
  const seen = new Set([from]), queue = [from];
  while (queue.length) for (const next of NEXT_STAGES[queue.shift()] || []) if (!seen.has(next)) { seen.add(next); queue.push(next); }
  return seen;
}

// `from` is the saved status ("" for a venue new to the workspace).
export function canMove(from, to, { showDate = "", today = "" } = {}) {
  if (!Object.hasOwn(STAGE_BY_STATUS, to)) return false;
  const target = stageOf(to);
  if (target === "played" && (!showDate || !today || showDate > today)) return false;
  return reachableStages(from ? stageOf(from) : "found").has(target);
}

function addDays(isoDate, days) { return new Date(Date.parse(`${isoDate.slice(0, 10)}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10); }

// Real events per venue, from TOUR_MANAGER#EMAIL_SEND# DynamoDB items.
export function venueEvents(sendItems = []) {
  const events = new Map();
  for (const item of sendItems) {
    const venueKey = item?.venueKey?.S || "", status = item?.status?.S || "";
    if (!venueKey || !PITCH_STATUSES.has(status)) continue;
    const entry = events.get(venueKey) || { pitchedAt: "", threadId: "", repliedAt: "" };
    const sentAt = item.sentAt?.S || item.providerAcceptedAt?.S || item.createdAt?.S || "";
    const id = String(item.tourId?.S || "").replace(/^TOUR_MANAGER#EMAIL_SEND#/, "");
    if (!item.followUpTo?.S && sentAt && (!entry.pitchedAt || sentAt > entry.pitchedAt)) { entry.pitchedAt = sentAt; entry.threadId = id; }
    const repliedAt = item.repliedAt?.S || "";
    if (repliedAt && (!entry.repliedAt || repliedAt < entry.repliedAt)) entry.repliedAt = repliedAt;
    events.set(venueKey, entry);
  }
  for (const [key, entry] of events) if (!entry.pitchedAt) events.delete(key);
  return events;
}

// A card never sits below what really happened: a sent pitch is at least pitched, a reply at least replied.
export function floorStatus(status, events) {
  const stage = stageOf(status);
  if (events?.repliedAt && ["found", "pitched", "no_reply"].includes(stage)) return "Reply received";
  if (events?.pitchedAt && stage === "found") return "Email sent";
  return status;
}

// The follow-up date is never earlier than 5 days after the pitch.
export function followUpDate(saved, pitchedAt) {
  if (!pitchedAt) return saved || "";
  const earliest = addDays(pitchedAt, FOLLOW_UP_DAYS);
  return saved && saved > earliest ? saved : earliest;
}

export function followUpEligible(sentAt, nowMs) {
  const sent = Date.parse(sentAt || "");
  return Number.isFinite(sent) && nowMs - sent >= FOLLOW_UP_DAYS * DAY_MS;
}

// Apply events to a sanitized venue list (mutates booking). Returns the venues.
export function withPipeline(venues, events) {
  for (const venue of venues) {
    const booking = venue.booking || (venue.booking = {}), found = events.get(venue.venueKey) || null;
    booking.status = floorStatus(booking.status, found);
    booking.followUp = followUpDate(booking.followUp, found?.pitchedAt || "");
    booking.pipeline = { stage: stageOf(booking.status), pitchedAt: found?.pitchedAt || "", repliedAt: found?.repliedAt || "", threadId: found?.threadId || "" };
  }
  return venues;
}

// EPK gate (task 02, owner 2026-11-16): sending any pitch needs a published EPK with this minimum.
// Browsing venues stays open. Checked on the server before a credit is reserved.
export const EPK_WORKSPACE_KEY = "epk-workspace-v1";
export const EPK_REQUIREMENTS = [
  ["name", "Act name"],
  ["photo", "A photo"],
  ["bio", "A bio"],
  ["music", "A music link"],
  ["live", "A live video or photo"],
  ["contact", "A booking email or phone"]
];

// `item` is the stored EPK workspace record ({ plan: { S: kitJson }, published: { BOOL } }) or undefined.
export function epkGate(item) {
  let kit = {};
  try { kit = JSON.parse(item?.plan?.S || "{}") || {}; } catch { kit = {}; }
  const list = value => Array.isArray(value) ? value : [];
  const https = value => /^https:\/\//i.test(String(value || ""));
  const photos = (https(kit.heroImage) ? 1 : 0) + list(kit.media).filter(media => media?.role === "press-photo").length;
  const checks = {
    name: Boolean(String(kit.artistName || "").trim()),
    photo: photos >= 1,
    bio: Boolean(String(kit.shortBio || kit.bio || "").trim()),
    music: list(kit.musicLinks).some(link => https(link?.url)),
    live: list(kit.videoLinks).some(link => https(link?.url)) || photos >= 2,
    contact: Boolean(String(kit.bookingEmail || "").trim() || String(kit.bookingPhone || "").trim())
  };
  const missing = EPK_REQUIREMENTS.filter(([key]) => !checks[key]).map(([, label]) => label);
  const published = item?.published?.BOOL === true;
  return { ready: published && !missing.length, published, done: EPK_REQUIREMENTS.length - missing.length, total: EPK_REQUIREMENTS.length, missing };
}

export function epkGateMessage(gate) {
  const needs = [...gate.missing, ...(gate.published ? [] : ["Publish your EPK"])];
  return `Finish your EPK to start booking (${gate.done} of ${gate.total} done). Still needed: ${needs.join(", ")}.`;
}

// Artist stats (task 07-C): pitches sent, delivered, EPK opened, replied, booked.
// First pitches only (a follow-up is not a new pitch). `opened` counts pitches whose
// private EPK link was opened (EPK#OUTREACH# records); email opens are not tracked.
const PITCH_SENT = new Set(["provider_accepted", "sent", "delivered", "bounced", "complained", "replied", "opted_out"]);
const PITCH_DELIVERED = new Set(["delivered", "replied", "opted_out"]);
export function pitchStats(sendItems = [], openedIds = new Set(), venues = []) {
  const pitches = sendItems.filter(item => !item?.followUpTo?.S && PITCH_SENT.has(item?.status?.S || ""));
  const pitchedVenues = new Set(pitches.map(item => item.venueKey?.S || "").filter(Boolean));
  const id = item => String(item.tourId?.S || "").replace(/^TOUR_MANAGER#EMAIL_SEND#/, "");
  const sent = pitches.length;
  const delivered = pitches.filter(item => PITCH_DELIVERED.has(item.status.S) || item.repliedAt?.S).length;
  const bounced = pitches.filter(item => item.status.S === "bounced").length;
  const opened = pitches.filter(item => openedIds.has(id(item))).length;
  const replied = pitches.filter(item => item.repliedAt?.S).length;
  const booked = venues.filter(venue => pitchedVenues.has(venue?.venueKey) && ["confirmed", "played"].includes(stageOf(venue?.booking?.status))).length;
  const rate = count => sent ? Math.round(count / sent * 100) : null;
  return { sent, delivered, bounced, opened, replied, booked, replyRate: rate(replied), bookedRate: rate(booked) };
}
