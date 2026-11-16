// Link previews (owner directive 2026-11-16): when a member shares an outside link (YouTube, Mixcloud,
// Bandcamp, SoundCloud, Facebook, news...), the post shows the image and title the source publishes for
// itself (Open Graph / Twitter card / oEmbed), and tapping it opens the original. DanzStak only reads the
// public page head; it never downloads or re-hosts media.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_BYTES = 600_000, TIMEOUT_MS = 4500, MAX_REDIRECTS = 3, CACHE_MS = 6 * 60 * 60 * 1000;
const cache = new Map();

function privateAddress(address) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v6 = address.toLowerCase();
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("::ffff:127.") || v6.startsWith("::ffff:10.") || v6.startsWith("::ffff:192.168.");
}

export async function safePublicUrl(raw, resolver = lookup) {
  let url;
  try { url = new URL(String(raw || "").trim()); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return null;
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") || host.endsWith(".local") || host.endsWith(".internal") || host === "localhost" || isIP(host)) return null;
  try {
    const addresses = await resolver(host, { all: true });
    if (!addresses.length || addresses.some(entry => privateAddress(entry.address))) return null;
  } catch { return null; }
  url.hash = "";
  return url;
}

const decode = text => String(text || "").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).trim();

export function parseHead(html, base) {
  const head = String(html || "").slice(0, MAX_BYTES);
  const meta = {};
  for (const tag of head.match(/<meta\b[^>]*>/gi) || []) {
    const key = (tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i) || [])[1]?.toLowerCase();
    const value = (tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i) || [])[1];
    if (key && value !== undefined && !(key in meta)) meta[key] = decode(value);
  }
  const titleTag = decode((head.match(/<title[^>]*>([^<]{1,300})<\/title>/i) || [])[1]);
  const absolute = value => { if (!value) return ""; try { const u = new URL(value, base); return u.protocol === "https:" ? u.href : ""; } catch { return ""; } };
  const image = absolute(meta["og:image:secure_url"] || meta["og:image"] || meta["og:image:url"] || meta["twitter:image"] || meta["twitter:image:src"] || "");
  return {
    title: (meta["og:title"] || meta["twitter:title"] || titleTag || "").slice(0, 200),
    description: (meta["og:description"] || meta["twitter:description"] || meta.description || "").slice(0, 300),
    site: (meta["og:site_name"] || "").slice(0, 80),
    image
  };
}

function youTubeId(url) {
  const host = url.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtu.be") return url.pathname.slice(1).split("/")[0];
  if (host === "youtube.com" || host === "music.youtube.com") return url.searchParams.get("v") || (url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,})/) || [])[1] || "";
  return "";
}

export async function linkPreview(raw, { fetcher = fetch, resolver = lookup, now = Date.now } = {}) {
  let url = await safePublicUrl(raw, resolver);
  if (!url) return null;
  const key = url.href, hit = cache.get(key);
  if (hit && now() - hit.at < CACHE_MS) return hit.value;
  const host = url.hostname.replace(/^www\./, "");
  const ytId = youTubeId(url);
  let found = { title: "", description: "", site: "", image: "" };
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetcher(url.href, { redirect: "manual", signal: controller.signal, headers: { "user-agent": "DanzStakLinkPreview/1.0 (+https://danzstak.com)", accept: "text/html,application/xhtml+xml" } });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const next = await safePublicUrl(new URL(response.headers.get("location") || "", url).href, resolver);
        if (!next) break; url = next; continue;
      }
      if (!response.ok || !String(response.headers.get("content-type") || "").includes("html")) break;
      const reader = response.body?.getReader?.();
      let html = "", received = 0;
      if (reader) {
        const decoder = new TextDecoder();
        while (received < MAX_BYTES) { const { done, value } = await reader.read(); if (done) break; received += value.length; html += decoder.decode(value, { stream: true }); if (/<\/head>/i.test(html)) break; }
        try { await reader.cancel(); } catch {}
      } else html = (await response.text()).slice(0, MAX_BYTES);
      found = parseHead(html, url.href);
      break;
    } catch { break; } finally { clearTimeout(timer); }
  }
  if (ytId && /^[\w-]{6,20}$/.test(ytId) && !found.image) found.image = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
  const value = { url: url.href, host, title: found.title || host, description: found.description, site: found.site || host, image: found.image, video: Boolean(ytId) };
  cache.set(key, { at: now(), value });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return value;
}
