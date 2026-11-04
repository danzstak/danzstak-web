import assert from "node:assert/strict";
import fs from "node:fs";
import { accountMediaExportEntry, publicMediaManifest } from "./infrastructure/auth-api/account-export-media.mjs";

const prefixes = ["users/abc/", "stories/abc/", "messages/abc/", "epk/abc/"];
const entry = accountMediaExportEntry({ Key: "users/abc/photo.jpg", Size: 42, LastModified: new Date("2026-11-04T12:00:00Z") }, prefixes, (key, filename) => `signed:${key}:${filename}`);
assert.deepEqual(entry, { archivePath: "media/uploads/photo.jpg", size: 42, modifiedAt: "2026-11-04T12:00:00.000Z", downloadUrl: "signed:users/abc/photo.jpg:photo.jpg" });
assert.equal(accountMediaExportEntry({ Key: "users/other/private.jpg", Size: 9 }, prefixes, () => "bad"), null, "another account prefix must never enter the manifest");
const unsafe = accountMediaExportEntry({ Key: "epk/abc/press/../bad:name.pdf", Size: 5 }, prefixes, () => "signed");
assert.equal(unsafe.archivePath, "media/epk/press/file/bad-name.pdf");
assert.deepEqual(publicMediaManifest([entry, unsafe], false), {
  complete: false,
  files: [
    { archivePath: "media/uploads/photo.jpg", size: 42, modifiedAt: "2026-11-04T12:00:00.000Z" },
    { archivePath: "media/epk/press/file/bad-name.pdf", size: 5, modifiedAt: "" }
  ],
  totalBytes: 47
});
const api = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8"), template = fs.readFileSync("infrastructure/engagement/template.yaml", "utf8");
assert.match(api, /getAuthenticatedUser\(event\)/, "media export must require the existing authenticated session");
assert.match(api, /accountMediaPrefixes\(accountEmail\)/, "media listing must derive only the verified account prefixes");
assert.match(api, /objects\.length >= 2000/, "media manifests must have a bounded API response");
assert.match(template, /GET \/account-export\/media/, "the authenticated media manifest route must be defined");
assert.match(template, /s3:prefix: \[users\/\*, stories\/\*, messages\/\*, epk\/\*\]/, "bucket listing permission must be restricted to DanzStak owner-media namespaces");
console.log("Account export media checks passed: owner prefixes, safe archive paths, sizes, timestamps, and honest completeness.");
