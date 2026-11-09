const unfold = value => String(value || "").replace(/\r?\n[ \t]+/g, " ");
export const headerValue = (raw, name) => unfold(raw.split(/\r?\n\r?\n/, 1)[0]).match(new RegExp(`(?:^|\\r?\\n)${name}:\\s*([^\\r\\n]+)`, "i"))?.[1]?.trim() || "";
const decodeQuotedPrintable = value => {
  const source = String(value || "").replace(/=\r?\n/g, ""), chunks = [];
  for (let index = 0; index < source.length;) {
    const encoded = source.slice(index, index + 3);
    if (/^=[0-9A-F]{2}$/i.test(encoded)) {
      chunks.push(Buffer.from([parseInt(encoded.slice(1), 16)]));
      index += 3;
      continue;
    }
    const character = String.fromCodePoint(source.codePointAt(index));
    chunks.push(Buffer.from(character, "utf8"));
    index += character.length;
  }
  return Buffer.concat(chunks).toString("utf8");
};
export function decodePart(raw) {
  const split = raw.search(/\r?\n\r?\n/), headers = split >= 0 ? raw.slice(0, split) : "", body = split >= 0 ? raw.slice(split).replace(/^\r?\n\r?\n/, "") : raw;
  const type = headerValue(`${headers}\n\n`, "Content-Type").toLowerCase(), encoding = headerValue(`${headers}\n\n`, "Content-Transfer-Encoding").toLowerCase(), disposition = headerValue(`${headers}\n\n`, "Content-Disposition").toLowerCase();
  if (disposition.startsWith("attachment")) return "";
  if (type.includes("multipart/")) {
    const boundary = headerValue(`${headers}\n\n`, "Content-Type").match(/boundary=(?:"([^"]+)"|([^;\s]+))/i)?.slice(1).find(Boolean);
    if (!boundary) return "";
    return body.split(`--${boundary}`).slice(1).filter(part => part.trim() && !part.trimStart().startsWith("--")).map(part => decodePart(part.replace(/^\r?\n/, "").replace(/\r?\n$/, ""))).find(text => text.trim()) || "";
  }
  if (type && !type.includes("text/plain")) return "";
  if (encoding === "base64") { try { return Buffer.from(body.replace(/\s/g, ""), "base64").toString("utf8"); } catch { return ""; } }
  return encoding === "quoted-printable" ? decodeQuotedPrintable(body) : body;
}
export function cleanReply(text) {
  return String(text || "").replace(/\u0000/g, "").split(/\r?\nOn .+wrote:\s*$|\r?\nFrom:\s.+$/im)[0].trim().slice(0, 4000);
}
export function receiptIsSafe(receipt) {
  const verdict = item => String(item?.status || "").trim().toUpperCase();
  const spam = verdict(receipt?.spamVerdict), virus = verdict(receipt?.virusVerdict);
  const authentication = [receipt?.dmarcVerdict, receipt?.dkimVerdict, receipt?.spfVerdict].map(verdict);
  return spam === "PASS" && virus === "PASS" && authentication.includes("PASS");
}
