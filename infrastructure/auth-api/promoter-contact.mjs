// Promoter contact reader (owner 2026-11-17: "get all the info"). Opens a promoter's own public page,
// and its contact or booking page, and reads the booking email, phone and social links it publishes.
// Public pages only (https, no private networks), small reads, short timeouts. Never a home address.
import { lookup } from "node:dns/promises";
import { safePublicUrl } from "./link-preview.mjs";

const MAX_BYTES = 400_000, TIMEOUT_MS = 4000, MAX_REDIRECTS = 3;
const decode = text => String(text || "").replace(/&amp;/g, "&").replace(/&#64;|&commat;/g, "@").replace(/&#46;|&period;/g, ".").replace(/&quot;/g, "\"").replace(/&nbsp;/g, " ");

export async function fetchPublicPage(raw, { fetcher = fetch, resolver = lookup } = {}) {
  let url = await safePublicUrl(raw, resolver);
  if (!url) return null;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetcher(url.href, { redirect: "manual", signal: controller.signal, headers: { "user-agent": "DanzStakBookingAgent/1.0 (+https://danzstak.com)", accept: "text/html,application/xhtml+xml" } });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const next = await safePublicUrl(new URL(response.headers.get("location") || "", url).href, resolver);
        if (!next) return null; url = next; continue;
      }
      if (!response.ok || !String(response.headers.get("content-type") || "").includes("html")) return null;
      const reader = response.body?.getReader?.();
      let html = "", received = 0;
      if (reader) {
        const decoder = new TextDecoder();
        while (received < MAX_BYTES) { const { done, value } = await reader.read(); if (done) break; received += value.length; html += decoder.decode(value, { stream: true }); }
        try { await reader.cancel(); } catch {}
      } else html = (await response.text()).slice(0, MAX_BYTES);
      return { url: url.href, html };
    } catch { return null; } finally { clearTimeout(timer); }
  }
  return null;
}

const JUNK_EMAIL = /\.(?:png|jpe?g|gif|webp|svg)$|@(?:example|sentry|wixpress|domain|email)\.|^(?:noreply|no-reply|donotreply|privacy|gdpr|dpo|datenschutz|webmaster|abuse)@/i;
const SOCIAL = [["instagram", /https:\/\/(?:www\.)?instagram\.com\/(?!p\/|reel\/|explore\/)[A-Za-z0-9_.]{2,30}\/?/], ["facebook", /https:\/\/(?:www\.|m\.)?facebook\.com\/(?!sharer|share|events|dialog|plugins|tr\b)[A-Za-z0-9_.-]{2,60}\/?/], ["residentAdvisor", /https:\/\/(?:[a-z]{2}\.)?ra\.co\/promoters\/\d+/], ["bandcamp", /https:\/\/[a-z0-9-]+\.bandcamp\.com\/?/], ["soundcloud", /https:\/\/(?:www\.)?soundcloud\.com\/[A-Za-z0-9_-]{2,40}\/?/]];

export function extractContacts(html, base) {
  const page = decode(html).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ");
  const emails = new Set(), phones = new Set(), social = {};
  for (const match of page.matchAll(/mailto:([^"'?\s>]+)/gi)) { const value = decodeURIComponent(match[1]).trim().toLowerCase(); if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(value) && !JUNK_EMAIL.test(value)) emails.add(value); }
  const text = page.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  for (const match of text.matchAll(/[A-Z0-9._%+-]+(?:@|\s?\[at\]\s?|\s?\(at\)\s?)[A-Z0-9.-]+\.[A-Z]{2,}/gi)) { const value = match[0].replace(/\s?[[(]at[\])]\s?/i, "@").toLowerCase(); if (!JUNK_EMAIL.test(value)) emails.add(value); }
  for (const match of page.matchAll(/tel:([+\d][\d ()./-]{6,20}\d)/gi)) phones.add(match[1].trim());
  for (const match of text.matchAll(/(?:tel\.?|phone|telefono|telefon|téléphone|teléfono|booking|whatsapp)\s*:?\s*(\+?\d[\d ()./-]{6,18}\d)/gi)) if (!/\d{4}[-/.]\d{2}[-/.]\d{2}/.test(match[1])) phones.add(match[1].trim());
  for (const [name, pattern] of SOCIAL) { const found = page.match(pattern); if (found) social[name] = found[0].replace(/\/$/, ""); }
  // The page that most likely lists the booking contact.
  let contactPage = "";
  for (const match of page.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,80}?)<\/a>/gi)) {
    const label = `${match[1]} ${match[2].replace(/<[^>]+>/g, " ")}`.toLowerCase();
    if (!/contact|kontakt|contatt|booking|impressum|chi siamo|about|info/.test(label)) continue;
    try { const url = new URL(match[1], base); if (url.protocol === "https:" && url.hostname === new URL(base).hostname && url.href !== base) { contactPage = url.href; if (/contact|kontakt|contatt|booking/.test(label)) break; } } catch {}
  }
  const rank = email => /booking|book/.test(email) ? 0 : /promo|events?|eventi|concerti|live/.test(email) ? 1 : /info|contact|kontakt|contatti/.test(email) ? 2 : 3;
  return { emails: [...emails].sort((a, b) => rank(a) - rank(b)).slice(0, 3), phones: [...phones].slice(0, 2), social, contactPage };
}

// Fills in what the search snippet did not have. Leaves the lead unchanged if the site cannot be read.
export async function enrichPromoter(lead, options = {}) {
  const home = await fetchPublicPage(lead.sourceUrl, options);
  if (!home) return lead;
  let found = extractContacts(home.html, home.url);
  if ((!found.emails.length || !found.phones.length) && found.contactPage) {
    const contact = await fetchPublicPage(found.contactPage, options);
    if (contact) {
      const more = extractContacts(contact.html, contact.url);
      found = { emails: [...new Set([...found.emails, ...more.emails])].slice(0, 3), phones: [...new Set([...found.phones, ...more.phones])].slice(0, 2), social: { ...more.social, ...found.social }, contactPage: found.contactPage };
    }
  }
  return {
    ...lead,
    emails: [...new Set([...(lead.emails || []), ...found.emails])].slice(0, 3),
    phones: [...new Set([...(lead.phones || []), ...found.phones])].slice(0, 2),
    social: found.social,
    contactPage: found.contactPage || "",
    contactChecked: true,
    bookingSuitability: found.emails.length || found.phones.length ? "contact-found" : lead.bookingSuitability
  };
}
