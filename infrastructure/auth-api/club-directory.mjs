// DanzStak club database (owner 2026-11-16: "a database that is real").
// Every club a search finds is kept with its public business contact, where it came from and when.
// Its standing comes only from what really happened with DanzStak bands:
//   verified = it booked or played a DanzStak band; replied = it answered a pitch; found = no answer yet.
// Clubs whose booking address bounced or asked to stop are "removed": they are kept out of searches and pitches.
// Counts are per club only. Nothing here says which band pitched, what was written or what was paid.

export const CLUB_TIERS = ["verified", "replied", "found", "removed"];
export const TIER_RANK = { verified: 0, replied: 1, found: 2, removed: 3 };
export const PAY_TO_PLAY_KINDS = ["tickets", "fee"];

const FIRST_PITCH = new Set(["provider_accepted", "sent", "delivered", "bounced", "complained", "replied", "opted_out"]);
const SEND_PREFIX = "TOUR_MANAGER#EMAIL_SEND#";
export const BOOKING_WORKSPACE_ID = "booking-workspace-v1";

const text = (value, max) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const https = value => /^https:\/\/[^\s]+$/i.test(String(value || "")) ? String(value).slice(0, 600) : "";
const email = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim()) ? String(value).trim().toLowerCase().slice(0, 254) : "";
export const validClubKey = value => typeof value === "string" && value.length >= 6 && value.length <= 240 && /^[a-zA-Z0-9_.:-]+$/.test(value);

// Only public business places from a public source become database entries.
export function clubFromPlace(place) {
  if (!place || !validClubKey(place.venueKey)) return null;
  const position = Array.isArray(place.position) ? place.position.map(Number) : [];
  if (position.length !== 2 || !position.every(Number.isFinite)) return null;
  const name = text(place.name, 160);
  if (!name) return null;
  return {
    venueKey: place.venueKey,
    kind: place.kind === "promoter" ? "promoter" : "club",
    name,
    address: text(place.address, 300),
    locality: text(place.locality || place.city, 120),
    lon: position[0], lat: position[1],
    website: https(place.website || (Array.isArray(place.websites) ? place.websites[0] : "")),
    email: email(place.email || place.bookingEmail || (Array.isArray(place.emails) ? place.emails[0] : "")),
    phone: text(place.phone || (Array.isArray(place.phones) ? place.phones[0] : ""), 40),
    categories: (Array.isArray(place.categories) ? place.categories : []).map(value => text(value, 60)).filter(Boolean).slice(0, 8),
    sourceName: text(place.sourceName, 120),
    sourceUrl: https(place.sourceUrl || place.website)
  };
}

// UpdateItem that adds or refreshes a club without touching its owner review or its counts.
export function clubUpsert(tableName, club, at) {
  const values = {
    ":found": { S: "found" }, ":at": { S: at }, ":name": { S: club.name }, ":lon": { N: String(club.lon) }, ":lat": { N: String(club.lat) },
    ":address": { S: club.address }, ":locality": { S: club.locality }, ":source": { S: club.sourceName }, ":one": { N: "1" }, ":kind": { S: club.kind || "club" }
  };
  const sets = ["#status = if_not_exists(#status, :found)", "firstSeenAt = if_not_exists(firstSeenAt, :at)", "lastSeenAt = :at", "#kind = if_not_exists(#kind, :kind)", "#name = :name", "lon = :lon", "lat = :lat", "address = :address", "locality = :locality", "sourceName = :source"];
  for (const [field, value] of [["website", club.website], ["email", club.email], ["phone", club.phone], ["sourceUrl", club.sourceUrl]]) {
    if (!value) continue;
    values[`:${field}`] = { S: value };
    sets.push(`${field} = :${field}`);
  }
  if (club.categories.length) { values[":categories"] = { S: club.categories.join(" · ") }; sets.push("categories = :categories"); }
  return {
    TableName: tableName,
    Key: { venueKey: { S: club.venueKey } },
    UpdateExpression: `SET ${sets.join(", ")} ADD timesFound :one`,
    // An owner-reviewed listing keeps the owner's wording; searches never overwrite it.
    ConditionExpression: "attribute_not_exists(#status) OR #status <> :approved",
    ExpressionAttributeNames: { "#status": "status", "#name": "name", "#kind": "kind" },
    ExpressionAttributeValues: { ...values, ":approved": { S: "approved" } }
  };
}

// Real outcomes per club, from the stored sends (one record per pitch) and the bands' booking lists.
export function clubStats(tourItems = []) {
  const stats = new Map();
  const entry = key => {
    if (!stats.has(key)) stats.set(key, { pitches: 0, replies: 0, bookings: 0, bounces: 0, optOuts: 0, replyHours: [], lastReplyAt: "", lastBookedAt: "", lastBounceAt: "", lastOptOutAt: "", bookedBy: new Set(), payToPlay: { tickets: 0, fee: 0 } });
    return stats.get(key);
  };
  for (const item of tourItems) {
    const tourId = item?.tourId?.S || "";
    if (tourId.startsWith(SEND_PREFIX)) {
      const key = item.venueKey?.S || "", status = item.status?.S || "";
      if (!validClubKey(key) || item.followUpTo?.S || !FIRST_PITCH.has(status)) continue;
      const club = entry(key), sentAt = item.sentAt?.S || item.providerAcceptedAt?.S || item.createdAt?.S || "", at = item.updatedAt?.S || sentAt;
      club.pitches += 1;
      if (item.repliedAt?.S) {
        club.replies += 1;
        if (item.repliedAt.S > club.lastReplyAt) club.lastReplyAt = item.repliedAt.S;
        const hours = (Date.parse(item.repliedAt.S) - Date.parse(sentAt)) / 3600000;
        if (Number.isFinite(hours) && hours >= 0) club.replyHours.push(hours);
      }
      if (status === "bounced" || status === "complained") { club.bounces += 1; if (at > club.lastBounceAt) club.lastBounceAt = at; }
      if (status === "opted_out") { club.optOuts += 1; if (at > club.lastOptOutAt) club.lastOptOutAt = at; }
    } else if (tourId === BOOKING_WORKSPACE_ID) {
      let saved = {};
      try { saved = JSON.parse(item.plan?.S || "{}") || {}; } catch { saved = {}; }
      for (const venue of Array.isArray(saved.venues) ? saved.venues : []) {
        const key = venue?.venueKey, status = String(venue?.booking?.status || "");
        if (!validClubKey(key)) continue;
        const known = entry(key);
        if (!known.name && venue.name) Object.assign(known, { name: text(venue.name, 160), address: text(venue.address, 300), website: https(Array.isArray(venue.websites) ? venue.websites[0] : ""), email: email(Array.isArray(venue.emails) ? venue.emails[0] : "") });
        if (status === "Confirmed" || status === "Played") {
          const club = entry(key), at = String(venue.booking?.confirmedAt || venue.booking?.date || venue.booking?.showDate || item.updatedAt?.S || "");
          if (!club.bookedBy.has(item.userId?.S)) { club.bookedBy.add(item.userId?.S); club.bookings += 1; }
          if (at > club.lastBookedAt) club.lastBookedAt = at;
        }
        const payToPlay = String(venue?.booking?.payToPlay || "");
        if (PAY_TO_PLAY_KINDS.includes(payToPlay)) entry(key).payToPlay[payToPlay] += 1;
      }
    }
  }
  for (const club of stats.values()) {
    const sorted = club.replyHours.sort((a, b) => a - b);
    club.medianReplyHours = sorted.length ? Math.round(sorted[Math.floor(sorted.length / 2)]) : null;
    delete club.replyHours;
    club.tier = clubTier(club);
    delete club.bookedBy;
  }
  return stats;
}

// Owner rule: replies move a club up, bookings make it verified, silence keeps it unverified,
// and a bounce or a stop request takes it out until a newer reply or booking proves the contact works.
export function clubTier(club = {}) {
  const lastPositive = [club.lastBookedAt, club.lastReplyAt].filter(Boolean).sort().at(-1) || "";
  const lastNegative = [club.lastBounceAt, club.lastOptOutAt].filter(Boolean).sort().at(-1) || "";
  if (lastNegative && lastNegative > lastPositive) return "removed";
  if (Number(club.bookings) > 0) return "verified";
  if (Number(club.replies) > 0) return "replied";
  return "found";
}

export function clubStatsUpdate(tableName, venueKey, club, at) {
  const number = value => ({ N: String(Number(value) || 0) });
  return {
    TableName: tableName,
    Key: { venueKey: { S: venueKey } },
    UpdateExpression: "SET tier = :tier, pitches = :pitches, replies = :replies, bookings = :bookings, bounces = :bounces, optOuts = :optOuts, medianReplyHours = :median, lastReplyAt = :reply, lastBookedAt = :booked, payToPlayTickets = :tickets, payToPlayFee = :fee, statsAt = :at, #status = if_not_exists(#status, :found), #name = if_not_exists(#name, :name), address = if_not_exists(address, :address), website = if_not_exists(website, :website), email = if_not_exists(email, :email)",
    ExpressionAttributeNames: { "#status": "status", "#name": "name" },
    ExpressionAttributeValues: {
      ":tier": { S: club.tier }, ":pitches": number(club.pitches), ":replies": number(club.replies), ":bookings": number(club.bookings), ":bounces": number(club.bounces), ":optOuts": number(club.optOuts),
      ":median": club.medianReplyHours === null ? { NULL: true } : number(club.medianReplyHours), ":reply": { S: club.lastReplyAt || "" }, ":booked": { S: club.lastBookedAt || "" },
      ":tickets": number(club.payToPlay?.tickets), ":fee": number(club.payToPlay?.fee), ":at": { S: at }, ":found": { S: "found" },
      ":name": { S: club.name || "" }, ":address": { S: club.address || "" }, ":website": { S: club.website || "" }, ":email": { S: club.email || "" }
    }
  };
}

// What a band sees on a club card. Plain counts, no score.
export function clubRecordFromItem(item) {
  if (!item?.venueKey?.S) return null;
  const n = field => Number(item[field]?.N || 0);
  return {
    venueKey: item.venueKey.S,
    tier: CLUB_TIERS.includes(item.tier?.S) ? item.tier.S : "found",
    pitches: n("pitches"), replies: n("replies"), bookings: n("bookings"),
    medianReplyHours: item.medianReplyHours?.N ? Number(item.medianReplyHours.N) : null,
    payToPlay: { tickets: n("payToPlayTickets"), fee: n("payToPlayFee") }
  };
}

export function clubLabel(record) {
  if (!record) return "";
  const parts = [];
  if (record.tier === "verified") parts.push(`Verified: booked ${record.bookings} DanzStak ${record.bookings === 1 ? "band" : "bands"}`);
  else if (record.tier === "replied") parts.push(`Replies to DanzStak bands (${record.replies} of ${record.pitches})`);
  else if (record.tier === "removed") parts.push("Booking contact bounced or asked to stop — find a newer contact");
  else parts.push("Not verified yet");
  if (record.tier !== "removed" && record.medianReplyHours !== null && record.replies) parts.push(record.medianReplyHours < 48 ? `usually answers within ${Math.max(1, record.medianReplyHours)} hours` : `usually answers within ${Math.round(record.medianReplyHours / 24)} days`);
  const pay = (record.payToPlay?.tickets || 0) + (record.payToPlay?.fee || 0);
  if (pay) parts.push(`pay to play reported by ${pay} ${pay === 1 ? "band" : "bands"}`);
  return parts.join(" · ");
}

// Proven clubs first, then clubs that answer, then the rest; removed clubs last. Ties keep the incoming order.
export function sortByClubTier(venues) {
  return venues.map((venue, index) => ({ venue, index }))
    .sort((a, b) => (TIER_RANK[a.venue.club?.tier] ?? 2) - (TIER_RANK[b.venue.club?.tier] ?? 2) || (b.venue.club?.bookings || 0) - (a.venue.club?.bookings || 0) || a.index - b.index)
    .map(entry => entry.venue);
}

const csvCell = value => { const cell = String(value ?? ""); return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell; };
export const CLUB_CSV_COLUMNS = ["tier", "kind", "name", "locality", "address", "website", "email", "phone", "categories", "pitches", "replies", "bookings", "medianReplyHours", "payToPlayTickets", "payToPlayFee", "sourceName", "firstSeenAt", "lastSeenAt", "lat", "lon", "venueKey"];
export function clubCsv(items = []) {
  const value = (item, field) => item[field]?.S ?? item[field]?.N ?? "";
  const rows = items.filter(item => item?.venueKey?.S)
    .sort((a, b) => (TIER_RANK[a.tier?.S] ?? 2) - (TIER_RANK[b.tier?.S] ?? 2) || value(a, "locality").localeCompare(value(b, "locality")) || value(a, "name").localeCompare(value(b, "name")));
  return [CLUB_CSV_COLUMNS.join(","), ...rows.map(item => CLUB_CSV_COLUMNS.map(field => csvCell(field === "tier" ? (item.tier?.S || "found") : value(item, field))).join(","))].join("\n") + "\n";
}
