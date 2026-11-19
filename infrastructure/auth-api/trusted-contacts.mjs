// Trusted contacts (owner 2026-11-17): promoters, crews and clubs the DanzStak team knows personally
// ("Flash, punk and metal promoter, Tacoma, Bremerton and Seattle venues"). They agreed to be contacted
// by artists. Their phone and email are never public: they reach only signed-in artists with an EPK,
// inside the booking agent. Only directory editors (DIRECTORY_EDITOR_EMAILS) can add them.
import { createHash } from "node:crypto";

export const CONTACT_KINDS = { promoter: "Promoter", crew: "Free tekno crew / sound system", club: "Club booker" };
const clean = (value, max) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const list = (value, max, size) => (Array.isArray(value) ? value : String(value || "").split(/[,;\n]/)).map(item => clean(item, size)).filter(Boolean).slice(0, max);

export function isDirectoryEditor(email, configured = "") {
  const editors = String(configured || "").split(",").map(item => item.trim().toLowerCase()).filter(Boolean);
  return Boolean(email) && editors.includes(String(email).trim().toLowerCase());
}

// Validates what an editor typed. Returns { error } or { contact }.
export function parseTrustedContact(data = {}) {
  const kind = Object.hasOwn(CONTACT_KINDS, data.kind) ? data.kind : "promoter";
  const name = clean(data.name, 120), towns = list(data.towns, 10, 80), venues = list(data.venues, 20, 120), genres = list(data.genres, 6, 40).map(item => item.toLowerCase());
  const phone = clean(data.phone, 30), email = clean(data.email, 254).toLowerCase(), notes = clean(data.notes, 400);
  let website = clean(data.website, 600);
  if (!name) return { error: "Add the contact's name." };
  if (!towns.length) return { error: "Add at least one town they book in." };
  if (phone && !/^\+?[0-9 ()./-]{7,24}$/.test(phone)) return { error: "That phone number doesn't look right." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "That email doesn't look right." };
  if (website) { try { const url = new URL(website); website = url.protocol === "https:" ? url.href.slice(0, 600) : ""; } catch { website = ""; } }
  if (!phone && !email && !website) return { error: "Add a phone number, email or website so artists can reach them." };
  if (data.consent !== true) return { error: "Confirm they agreed to be contacted by artists." };
  return { contact: { kind, name, towns, venues, genres, phone, email, website, notes } };
}

export const contactId = contact => createHash("sha256").update(`${contact.name.toLowerCase()}|${contact.phone.replace(/\D/g, "")}|${contact.email}`).digest("hex").slice(0, 16);
const townSlug = town => town.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

// One directory record per town, so the contact shows up wherever a band plans a show near any of them.
// Keys start with "promoter-" so they never mix into the venue list.
export function trustedContactItems(contact, placedTowns, editorHash, at) {
  const id = contactId(contact);
  return placedTowns.filter(town => Array.isArray(town.position) && town.position.length === 2 && town.position.every(Number.isFinite)).map(town => ({
    venueKey: { S: `promoter-trusted-${id}-${townSlug(town.label)}` },
    contactId: { S: id }, trusted: { BOOL: true }, status: { S: "approved" }, kind: { S: contact.kind },
    name: { S: contact.name }, locality: { S: clean(town.label, 120) }, address: { S: "" },
    lon: { N: String(town.position[0]) }, lat: { N: String(town.position[1]) },
    categories: { S: [CONTACT_KINDS[contact.kind], ...contact.genres].join(" · ") },
    ...(contact.venues.length ? { venuesBooked: { S: contact.venues.join(" · ") } } : {}),
    ...(contact.phone ? { phone: { S: contact.phone } } : {}), ...(contact.email ? { email: { S: contact.email } } : {}), ...(contact.website ? { website: { S: contact.website } } : {}),
    ...(contact.notes ? { notes: { S: contact.notes } } : {}),
    towns: { S: contact.towns.join(" · ") }, sourceName: { S: "DanzStak trusted contact" }, addedBy: { S: editorHash }, approvedAt: { S: at }, firstSeenAt: { S: at }
  }));
}

const distanceMiles = (a, b) => {
  const r = Math.PI / 180, h = Math.sin((b[1] - a[1]) * r / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin((b[0] - a[0]) * r / 2) ** 2;
  return 3958.7613 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
};

// Trusted contacts near a tour stop, as promoter leads. One entry per person even when several of their towns are near.
export function trustedPromotersNear(items = [], point = {}, genre = "", miles = 60) {
  if (!Array.isArray(point.position)) return [];
  const wanted = String(genre || "").toLowerCase(), byContact = new Map();
  for (const item of items) {
    if (item?.trusted?.BOOL !== true || item.status?.S !== "approved") continue;
    const position = [Number(item.lon?.N), Number(item.lat?.N)];
    if (!position.every(Number.isFinite)) continue;
    const distance = distanceMiles(point.position, position);
    if (distance > miles) continue;
    const id = item.contactId?.S || item.venueKey?.S, known = byContact.get(id);
    if (known && known.distanceMiles <= distance) continue;
    const kind = item.kind?.S || "promoter", categories = String(item.categories?.S || CONTACT_KINDS.promoter).split(" · ").filter(Boolean);
    const venues = item.venuesBooked?.S ? `Books ${item.venuesBooked.S}. ` : "";
    byContact.set(id, {
      venueKey: item.venueKey.S, kind: "promoter", crew: kind === "crew", trusted: true, name: item.name?.S || "Promoter",
      address: "", locality: item.locality?.S || "", position, approximatePosition: true, distanceMiles: Math.round(distance * 10) / 10,
      websites: item.website?.S ? [item.website.S] : [], emails: item.email?.S ? [item.email.S] : [], phones: item.phone?.S ? [item.phone.S] : [],
      categories, sourceName: "DanzStak trusted contact", sourceUrl: item.website?.S || "", sources: [{ name: "DanzStak trusted contact", url: item.website?.S || "" }],
      discoveredAt: item.approvedAt?.S || "", contactVerificationRequired: false,
      activityEvidence: `${venues}Works ${item.towns?.S || item.locality?.S || "this area"}. Known to DanzStak and happy to hear from artists.`,
      genreMatch: !wanted || categories.some(category => category.toLowerCase().includes(wanted) || wanted.includes(category.toLowerCase()))
    });
  }
  return [...byContact.values()].sort((a, b) => Number(b.genreMatch) - Number(a.genreMatch) || a.distanceMiles - b.distanceMiles);
}

// Contacts reach artists only. Members without an EPK see who books the town, not how to reach them.
export function withoutContacts(places = []) {
  return places.map(place => ({ ...place, emails: [], phones: [], contactsHidden: Boolean(place.emails?.length || place.phones?.length) }));
}

// Saved with UpdateItem (the Lambda's club-database permission), setting every field of the record.
export function trustedContactUpdate(tableName, item) {
  const { venueKey, ...fields } = item, names = {}, values = {}, sets = [];
  Object.entries(fields).forEach(([field, value], index) => { names[`#f${index}`] = field; values[`:v${index}`] = value; sets.push(`#f${index} = :v${index}`); });
  return { TableName: tableName, Key: { venueKey }, UpdateExpression: `SET ${sets.join(", ")}`, ExpressionAttributeNames: names, ExpressionAttributeValues: values };
}
