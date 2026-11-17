// Promoters and party crews (owner 2026-11-16): "music promoters Bologna Italy" or "techno party organizers
// Mannheim Germany" on a web search finds a lot of bookers fast. DanzStak searches the same way, worldwide:
// in English and in the city's own language, with the scene words of the band's genre.
// Only public business pages are kept; the result is a lead to verify, never a confirmed contact.
import { createHash } from "node:crypto";

const GENRE_WORDS = {
  en: { punk: "punk", metal: "metal", techno: "techno", house: "house", electronic: "electronic", rock: "rock", hiphop: "hip hop", tekno: "free tekno", any: "live music" },
  it: { punk: "punk", metal: "metal", techno: "techno", house: "house", electronic: "musica elettronica", tekno: "free tekno", rock: "rock", hiphop: "hip hop", any: "musica live" },
  de: { punk: "Punk", metal: "Metal", techno: "Techno", house: "House", electronic: "elektronische Musik", tekno: "free tekno", rock: "Rock", hiphop: "Hip Hop", any: "Livemusik" },
  fr: { punk: "punk", metal: "metal", techno: "techno", house: "house", electronic: "musique électronique", tekno: "free tekno", rock: "rock", hiphop: "hip hop", any: "musique live" },
  es: { punk: "punk", metal: "metal", techno: "techno", house: "house", electronic: "música electrónica", tekno: "free tekno", rock: "rock", hiphop: "hip hop", any: "música en vivo" },
  pt: { punk: "punk", metal: "metal", techno: "techno", house: "house", electronic: "música eletrônica", tekno: "free tekno", rock: "rock", hiphop: "hip hop", any: "música ao vivo" },
  nl: { punk: "punk", metal: "metal", techno: "techno", house: "house", electronic: "elektronische muziek", tekno: "free tekno", rock: "rock", hiphop: "hiphop", any: "livemuziek" }
};
// {g} = genre words, {c} = city. Two local searches per city, chosen for how scenes book there.
const LOCAL_TERMS = {
  en: ["{g} promoters {c}", "{g} party organizers {c}", "{g} show bookers {c}", "DIY {g} collective {c}"],
  it: ["promoter {g} {c}", "organizzatori eventi {g} {c}", "collettivo {g} {c}", "centro sociale concerti {c}"],
  de: ["{g} Veranstalter {c}", "{g} Party Kollektiv {c}", "Konzertveranstalter {c}", "Booking Agentur {g} {c}"],
  fr: ["organisateur soirée {g} {c}", "collectif {g} {c}", "programmateur concert {c}", "association concerts {g} {c}"],
  es: ["promotores {g} {c}", "colectivo {g} {c}", "organizadores fiestas {g} {c}", "promotora conciertos {c}"],
  pt: ["promotores {g} {c}", "coletivo {g} {c}", "produtora de eventos {g} {c}", "festas {g} organizadores {c}"],
  nl: ["{g} organisatie {c}", "{g} collectief {c}", "concertorganisatie {c}", "{g} feest organisator {c}"]
};
// Free tekno crews and sound systems (owner 2026-11-17): Europe, and sprouting up in the US. They don't call
// themselves promoters, so they get their own words. Searched for electronic, techno and tekno acts.
const CREW_TERMS = {
  en: ["free tekno sound system {c}", "free party crew {c}"],
  us: ["free tekno sound system {c}", "underground rave crew {c}"],
  it: ["free tekno sound system {c}", "teknival collettivo {c}"],
  de: ["Free Tekno Soundsystem {c}", "Soundsystem Kollektiv Free Party {c}"],
  fr: ["sound system free party {c}", "son tekno free party {c}"],
  es: ["free tekno sound system {c}", "colectivo free party {c}"],
  pt: ["free tekno sound system {c}", "coletivo free party {c}"],
  nl: ["free tekno soundsystem {c}", "free party collectief {c}"]
};
const LANGUAGE_BY_COUNTRY = { IT: "it", SM: "it", DE: "de", AT: "de", CH: "de", LI: "de", FR: "fr", BE: "fr", LU: "fr", MC: "fr", ES: "es", MX: "es", AR: "es", CL: "es", CO: "es", PE: "es", UY: "es", PT: "pt", BR: "pt", NL: "nl" };

export function genreKey(genre = "") {
  const value = String(genre).toLowerCase();
  if (/punk|hardcore|garage/.test(value)) return "punk";
  if (/metal|doom|thrash|grind/.test(value)) return "metal";
  if (/tekno|teknival|free party|sound ?system/.test(value)) return "tekno";
  if (/techno|industrial|ebm/.test(value)) return "techno";
  if (/house|edm|disco/.test(value)) return "house";
  if (/electro|dj|drum|bass|breaks|dubstep/.test(value)) return "electronic";
  if (/hip.?hop|rap/.test(value)) return "hiphop";
  if (/rock|indie|grunge/.test(value)) return "rock";
  return "any";
}

export function cityName(point = {}) {
  return String(point.label || "").split(",")[0].trim().slice(0, 80);
}

// English first (finds the bigger promoters), then the local language (finds the small crews and collectives).
export function promoterQueries(point = {}, genre = "") {
  const city = cityName(point), country = String(point.label || "").split(",").at(-1).trim(), key = genreKey(genre);
  if (!city) return [];
  const local = LANGUAGE_BY_COUNTRY[String(point.countryCode || "").toUpperCase()] || (/^[a-z]{2}$/.test(point.languageCode || "") && LOCAL_TERMS[point.languageCode] ? point.languageCode : "en");
  const fill = (template, language) => template.replace("{g}", GENRE_WORDS[language][key]).replace("{c}", city).replace(/\s+/g, " ").trim();
  const english = [`${GENRE_WORDS.en[key]} promoters ${city}${country && country !== city ? ` ${country}` : ""}`, fill(LOCAL_TERMS.en[1], "en")];
  const localTerms = local === "en" ? [fill(LOCAL_TERMS.en[2], "en"), fill(LOCAL_TERMS.en[3], "en")] : LOCAL_TERMS[local].slice(0, 2).map(term => fill(term, local));
  const crews = ["tekno", "techno", "electronic"].includes(key)
    ? CREW_TERMS[local === "en" && /united states|usa/i.test(country) ? "us" : local].map(term => ({ query: term.replace("{c}", city), language: local, kind: "crew" }))
    : [];
  return [...new Map([...english, ...localTerms].map(query => [query, { query, language: local === "en" || english.includes(query) ? "en" : local }])).values(), ...crews];
}

// Lists, news, directories and ticket marketplaces are not promoters.
const NOT_A_PROMOTER = /(?:^|\.)(?:comune\.[a-z.]+|gov\.[a-z.]+|gouv\.fr|shazam\.com|concerts50\.com|zero\.eu|songkick\.|allevents\.|eventim\.|dice\.fm|feverup\.com|wikipedia\.org|tripadvisor\.|yelp\.|timeout\.com|eventbrite\.|ticketmaster\.|songkick\.com|bandsintown\.com|reddit\.com|quora\.com|linkedin\.com|indeed\.|glassdoor\.|youtube\.com|tiktok\.com|x\.com|twitter\.com|amazon\.|pinterest\.|yellowpages|paginegialle\.it|gelbeseiten\.de|pagesjaunes\.fr|paginasamarillas\.es)$/i;
const LISTICLE = /\b(?:top|best|\d+\s+(?:best|top))\b.*\b(?:promoters|organizers|organizzatori|veranstalter)\b|\bjobs?\b|\bstellen/i;

export function promoterLead(result = {}, point = {}, query = "", seenAt = new Date().toISOString(), kind = "promoter") {
  let url;
  try { url = new URL(String(result.url || "")); } catch { return null; }
  if (url.protocol !== "https:" || NOT_A_PROMOTER.test(url.hostname)) return null;
  const title = String(result.title || "").replace(/\s+[|–—-]\s+.*$/, "").replace(/\s+/g, " ").trim().slice(0, 160);
  const description = String(result.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
  if (!title || LISTICLE.test(`${title} ${description}`)) return null;
  // Owner live test 2026-11-17: plain results were mostly event pages and news. Keep pages that look like a
  // promoter, crew, collective or booking agency; drop single events, news and date listings.
  const haystack = `${title} ${url.hostname} ${url.pathname}`.toLowerCase();
  const promoterSignal = /tekno|teknival|sound ?system|free ?party|rave|promot|booking|collettiv|collectif|colectiv|coletiv|kollektiv|collective|crew|agenc|agentur|agenzia|veranstalt|organizz|organisat|organizad|associazion|association|asociaci|soundsystem|sound system|label|records|\/promoters\//.test(haystack);
  const eventOrNews = /\/(?:news|notizie|articoli?|blog|events?|eventi|evenements?|eventos|veranstaltungen|concerti|konzerte|concerts?|tickets?|biglietti)\/[^/]+|\d{4}[-/]\d{2}[-/]\d{2}/.test(url.pathname) || /\b(?:festival|fest)\b.*@|\btickets?\b/i.test(title);
  if (!promoterSignal || (eventOrNews && !/\/promoters\//.test(url.pathname))) return null;
  const position = Array.isArray(point.position) && point.position.length === 2 && point.position.every(Number.isFinite) ? point.position.slice(0, 2) : null;
  if (!position) return null;
  const email = (description.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [""])[0].toLowerCase();
  const phone = ((description.match(/(?:tel\.?|phone|telefono|téléphone|teléfono|☎|📞)?\s*(\+\d{1,3}[\d ()./-]{6,16}\d|\(?0\d{1,4}\)?[ ./-]?\d{2,4}[ ./-]?\d{2,4}(?:[ ./-]?\d{2,4})?)/i) || [])[1] || "").trim();
  const path = url.pathname.replace(/\/+$/, "");
  const venueKey = `promoter-${createHash("sha256").update(`${url.hostname.replace(/^www\./, "")}${path}`.toLowerCase()).digest("hex").slice(0, 20)}`;
  return {
    venueKey, kind: "promoter", crew: kind === "crew", name: title, address: "", locality: cityName(point), position, approximatePosition: true,
    websites: [url.href.slice(0, 600)], emails: email ? [email] : [], phones: phone ? [phone] : [],
    categories: [kind === "crew" ? "Free tekno crew / sound system" : "Promoter / party crew"], sourceName: "Web search (promoters)", sourceUrl: url.href.slice(0, 600),
    sources: [{ name: "Web search (promoters)", url: url.href.slice(0, 600) }], discoveredAt: seenAt, query,
    contactVerificationRequired: true,
    activityEvidence: description || "Public promoter page found on the web. Check that they book this kind of show before pitching."
  };
}

export function promoterLeads(results = [], point = {}, seenAt) {
  const leads = [];
  for (const { result, query, kind } of results) {
    const lead = promoterLead(result, point, query, seenAt, kind);
    if (lead && !leads.some(existing => existing.venueKey === lead.venueKey || new URL(existing.sourceUrl).hostname === new URL(lead.sourceUrl).hostname)) leads.push(lead);
  }
  return leads.slice(0, 12);
}
