const unfold = value => String(value || "").replace(/\r?\n[ \t]+/g, " ");
export const headerValue = (raw, name) => unfold(raw.split(/\r?\n\r?\n/, 1)[0]).match(new RegExp(`(?:^|\\r?\\n)${name}:\\s*([^\\r\\n]+)`, "i"))?.[1]?.trim() || "";
const decodeQuotedPrintable = value => value.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
export function decodePart(raw) {
  const split = raw.search(/\r?\n\r?\n/), headers = split >= 0 ? raw.slice(0, split) : "", body = split >= 0 ? raw.slice(split).replace(/^\r?\n\r?\n/, "") : raw;
  const type = headerValue(`${headers}\n\n`, "Content-Type").toLowerCase(), encoding = headerValue(`${headers}\n\n`, "Content-Transfer-Encoding").toLowerCase();
  if (type.includes("multipart/")) {
    const boundary = headerValue(`${headers}\n\n`, "Content-Type").match(/boundary=(?:"([^"]+)"|([^;\s]+))/i)?.slice(1).find(Boolean);
    if (!boundary) return "";
    return body.split(`--${boundary}`).map(decodePart).find(text => text.trim()) || "";
  }
  if (type && !type.includes("text/plain")) return "";
  if (encoding === "base64") { try { return Buffer.from(body.replace(/\s/g, ""), "base64").toString("utf8"); } catch { return ""; } }
  return encoding === "quoted-printable" ? decodeQuotedPrintable(body) : body;
}
export function cleanReply(text) {
  return String(text || "").replace(/\u0000/g, "").split(/\r?\nOn .+wrote:\s*$|\r?\nFrom:\s.+$/im)[0].trim().slice(0, 4000);
}
export function receiptIsSafe(receipt) {
  return [receipt?.spamVerdict, receipt?.virusVerdict, receipt?.spfVerdict, receipt?.dkimVerdict].every(item => !item?.status || ["PASS", "GRAY"].includes(item.status));
}
