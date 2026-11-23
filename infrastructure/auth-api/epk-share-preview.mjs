// EPK link previews (owner 2026-11-23: a private EPK link posted in Mix showed a bare "EPK Builder | DanzStak" link, "Should
// have a preview", then the EPK builder's ALL ACCESS laminate: "Like this").
//
// danzstak.com/e/<id> (an Amplify 200 rewrite to GET /share/epk/<id>) answers link crawlers (Facebook, WhatsApp, Messages,
// DanzStak's own Mix link cards) with og: tags, and people with a one-line page that opens the EPK: the private review
// view when the link carries its #token (the token never leaves the browser), otherwise the published EPK.
//   - A published EPK shows its name and "genre · home town".
//   - A private review link shows them only once the artist has turned on the card (EPK builder → Share: "Show my EPK
//     card in link previews"), because anyone holding the bare /e/<id> address would see them.
//   - The card picture (1200x630 JPEG drawn by the artist's own browser from the laminate) is served at
//     /e/<id>/card.jpg while the card is on; otherwise the general DanzStak card.
export const EPK_CARD_PARTITION = "epk-share-card";
export const SHARE_SITE = "https://danzstak.com";
export const CARD_MAX_BYTES = 300 * 1024;
export const validEpkId = id => /^[a-z0-9-]{3,64}$/.test(String(id || ""));
export const epkShareLink = id => `${SHARE_SITE}/e/${id}`;
export const validCardKey = (key, ownerPrefix) => /^[a-f0-9]{24}$/.test(String(ownerPrefix || "")) && new RegExp(`^users/${ownerPrefix}/[a-f0-9-]{36}\\.jpg$`).test(String(key || ""));

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]);
const clean = (value, max) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

// "Techno · San Francisco": the first genre and the home town, as on the laminate.
export function epkPreviewLine(kit = {}) {
  const genres = Array.isArray(kit.genres) ? kit.genres : String(kit.genres || "").split(",");
  return [clean(genres[0], 40), clean(kit.hometown, 60)].filter(Boolean).join(" · ");
}

// The page for GET /share/epk/<id>. kit: the published kit, or the private one when the card is on (null otherwise).
export function epkSharePage({ id, kit = null, cardSig = "" }) {
  const named = Boolean(kit && clean(kit.artistName, 120));
  const name = named ? clean(kit.artistName, 120) : "";
  const line = named ? epkPreviewLine(kit) : "";
  const title = named ? `${name} · EPK` : "An EPK on DanzStak";
  const about = named ? (line ? `${line} · Electronic press kit on DanzStak` : "Electronic press kit on DanzStak") : "Electronic press kits, booking and the digital clubhouse for music culture.";
  const version = String(cardSig || "").replace(/[^a-f0-9]/g, "").slice(0, 16);
  const url = epkShareLink(id);
  const image = version ? `${url}/card.jpg?v=${version}` : `${SHARE_SITE}/assets/danzstak-share-card.jpg`;
  const meta = (attribute, key, value) => `<meta ${attribute}="${key}" content="${escapeHtml(value)}">`;
  const head = [
    meta("name", "description", about), meta("property", "og:type", "website"), meta("property", "og:site_name", "DanzStak"),
    meta("property", "og:title", title), meta("property", "og:description", about), meta("property", "og:url", url),
    meta("property", "og:image", image), meta("property", "og:image:secure_url", image), meta("property", "og:image:type", "image/jpeg"),
    meta("property", "og:image:width", "1200"), meta("property", "og:image:height", "630"), meta("property", "og:image:alt", named ? `${name} EPK` : "DanzStak"),
    meta("name", "twitter:card", "summary_large_image"), meta("name", "twitter:title", title), meta("name", "twitter:description", about), meta("name", "twitter:image", image)
  ].join("");
  // The private review token lives in the address's #fragment, which never reaches a server: the page passes it on.
  const open = `/epk.html?id=${id}`;
  const script = `var h=location.hash;location.replace((/(^|[#&])token=[a-f0-9]{64}/.test(h)?${JSON.stringify(`/epk.html?share=${id}`)}:${JSON.stringify(open)})+h)`;
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title>${head}<link rel="canonical" href="${escapeHtml(url)}"></head><body><p><a href="${escapeHtml(open)}">${escapeHtml(named ? `${name} · EPK` : "DanzStak")}</a></p><script>${script}</script></body></html>`;
  return {
    statusCode: 200,
    headers: {
      "strict-transport-security": "max-age=63072000; includeSubDomains; preload", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer",
      "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300",
      "content-security-policy": "default-src 'none'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    },
    body
  };
}
