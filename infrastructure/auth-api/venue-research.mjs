import https from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Pin DNS to the checked public IPv4 address. Never fetch internal URLs or
// follow redirects to unchecked hosts when researching untrusted listings.
export function publicAddress(address) {
  if (isIP(address) !== 4) return false;
  const [a, b] = address.split(".").map(Number);
  return !([0, 10, 127].includes(a) || a >= 224 || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0, 168].includes(b))
    || (a === 100 && b >= 64 && b <= 127) || (a === 198 && [18, 19, 51].includes(b))
    || (a === 203 && b === 0));
}

export async function readPublicPage(rawUrl, redirects = 0) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw new Error("Unsupported public URL");
  const addresses = await lookup(url.hostname, { all: true, family: 4 });
  if (!addresses.length || !addresses.every(item => publicAddress(item.address))) throw new Error("Non-public address");
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      lookup: (_host, options, callback) => options?.all
        ? callback(null, [{ address: addresses[0].address, family: 4 }])
        : callback(null, addresses[0].address, 4),
      headers: { "user-agent": "DanzStak-VenueResearch/1.0", accept: "text/html,application/xhtml+xml" }
    }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.resume();
        if (redirects >= 2 || !response.headers.location) return reject(new Error("Redirect limit"));
        resolve(readPublicPage(new URL(response.headers.location, url).href, redirects + 1));
        return;
      }
      if (response.statusCode !== 200 || !/text\/html|application\/xhtml\+xml/.test(response.headers["content-type"] || "")) {
        response.resume(); reject(new Error("Public page unavailable")); return;
      }
      let size = 0, html = "";
      response.setEncoding("utf8");
      response.on("data", chunk => {
        size += Buffer.byteLength(chunk);
        if (size > 256000) { response.destroy(new Error("Page size limit")); return; }
        html += chunk;
      });
      response.on("error", reject);
      response.on("end", () => resolve({ url: url.href, html }));
    });
    const timer = setTimeout(() => request.destroy(new Error("Public page timeout")), 4000);
    request.on("close", () => clearTimeout(timer));
    request.on("error", reject);
  });
}

export function pageEvidence(html, url) {
  const text = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  const sentences = text.split(/[.!?。]\s*/).filter(line => /music|concert|punk|tekno|techno|hardcore|gabber|dj\b|agenda|program|ライブ|音楽|공연|موسيقى/i.test(line));
  const emails = [...new Set([...html.matchAll(/mailto:([^"'<>?\s]+)/gi)].map(match => match[1].toLowerCase()))]
    .filter(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)).slice(0, 2);
  return { url, text: sentences.join(". ").slice(0, 1800), emails, checkedAt: new Date().toISOString() };
}

export async function researchVenuePages(places, limit = 6) {
  const selected = places.filter(place => place.websites?.length).slice(0, limit);
  // Small, bounded batches keep one slow website from occupying the request.
  for (let offset = 0; offset < selected.length; offset += 3) {
    await Promise.all(selected.slice(offset, offset + 3).map(async place => {
      try {
        const page = await readPublicPage(place.websites[0]);
        const evidence = pageEvidence(page.html, page.url);
        place.programmingEvidence = evidence.text;
        place.emails = [...new Set([...(place.emails || []), ...evidence.emails])].slice(0, 2);
        place.sources = [...(place.sources || []), { name: "Venue website (identity and programming require confirmation)", url: evidence.url, checkedAt: evidence.checkedAt }];
        place.websiteResearch = evidence.text ? "evidence-found" : "no-programming-found";
        if (evidence.text) place.activityEvidence = evidence.text.slice(0, 500);
      } catch { place.websiteResearch = "unavailable"; }
    }));
  }
  return places;
}
