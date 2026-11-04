import { createHash } from "node:crypto";

const categoryByPrefix = Object.freeze({ users: "uploads", stories: "flashes", messages: "messages", epk: "epk" });

function cleanSegment(value) {
  return String(value || "file").normalize("NFKC").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-").replace(/^\.+$/, "file").slice(0, 160) || "file";
}

export function accountMediaExportEntry(object, allowedPrefixes, sign) {
  const key = String(object?.Key || "");
  const prefix = allowedPrefixes.find(candidate => key.startsWith(candidate));
  if (!prefix || typeof sign !== "function") return null;
  const category = categoryByPrefix[prefix.split("/", 1)[0]] || "media";
  const relative = key.slice(prefix.length).split("/").filter(Boolean).map(cleanSegment).join("/") || `file-${createHash("sha256").update(key).digest("hex").slice(0, 12)}`;
  const archivePath = `media/${category}/${relative}`;
  return {
    archivePath,
    size: Math.max(0, Number(object.Size || 0)),
    modifiedAt: object.LastModified instanceof Date ? object.LastModified.toISOString() : String(object.LastModified || ""),
    downloadUrl: sign(key, archivePath.split("/").pop())
  };
}

export function publicMediaManifest(entries, complete) {
  return {
    complete: complete === true,
    files: entries.map(({ archivePath, size, modifiedAt }) => ({ archivePath, size, modifiedAt })),
    totalBytes: entries.reduce((total, entry) => total + entry.size, 0)
  };
}
