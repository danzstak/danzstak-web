// Task 38 (owner 2026-11-19: "build the CDN", "takes 10 sec with one user"): photos and videos load through CloudFront
// instead of straight from the S3 bucket in us-west-1, with signed URLs that stay the SAME for a whole time window, so the
// browser, the installed app and the CloudFront edge (Milan, San Francisco…) can cache them. Private media stays private:
// the distribution only serves URLs signed with DanzStak's key (trusted key group), and the bucket only lets CloudFront in.
//
// Fail-safe: until the owner session sets MEDIA_CDN_DOMAIN and stores the key in Secrets Manager
// (danzstak/cloudfront/media-signing-key: {"keyPairId": "...", "privateKey": "-----BEGIN ..."}), url() returns "" and
// the caller keeps today's S3 signed URL. The private key is read once per Lambda container and never logged.
import { createSign } from "node:crypto";

export const WINDOW_SECONDS = 6 * 60 * 60; // one URL per media file per 6-hour block
export const MIN_LIFETIME_SECONDS = 60 * 60; // a URL handed out is always valid for at least another hour

// Same expiry for every request in the same block: rounded up to the end of the block that starts at least an hour ahead.
export function windowExpiry(nowSeconds, windowSeconds = WINDOW_SECONDS, minimum = MIN_LIFETIME_SECONDS) {
  return Math.ceil((nowSeconds + minimum) / windowSeconds) * windowSeconds;
}

// CloudFront's URL-safe base64: + → -, = → _, / → ~
const cloudFrontBase64 = buffer => buffer.toString("base64").replace(/\+/g, "-").replace(/=/g, "_").replace(/\//g, "~");
const encodePath = key => String(key).split("/").map(part => encodeURIComponent(part).replace(/[!'()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase())).join("/");

// Canned-policy signed URL (https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-creating-signed-url-canned-policy.html)
export function signCloudFrontUrl({ domain, key, keyPairId, privateKey, expires }) {
  const resource = `https://${domain}/${encodePath(key)}`;
  const policy = JSON.stringify({ Statement: [{ Resource: resource, Condition: { DateLessThan: { "AWS:EpochTime": expires } } }] });
  const signature = createSign("RSA-SHA1").update(policy).sign(privateKey);
  return `${resource}?Expires=${expires}&Signature=${cloudFrontBase64(signature)}&Key-Pair-Id=${encodeURIComponent(keyPairId)}`;
}

export function createMediaCdn({ domain = "", loadSecret, clock = () => Date.now(), retrySeconds = 300 } = {}) {
  const cleanDomain = String(domain || "").trim().toLowerCase();
  const validDomain = /^[a-z0-9.-]+\.(cloudfront\.net|danzstak\.com)$/.test(cleanDomain);
  let key = null, loading = null, failedAt = 0;
  async function ready() {
    if (!validDomain || key) return Boolean(key);
    if (failedAt && clock() - failedAt < retrySeconds * 1000) return false;
    if (!loading) loading = (async () => {
      try {
        const raw = await loadSecret();
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (!/^K[A-Z0-9]{6,}$/.test(String(parsed?.keyPairId || "")) || !String(parsed?.privateKey || "").includes("PRIVATE KEY")) throw new Error("Media CDN key is not configured.");
        key = { keyPairId: parsed.keyPairId, privateKey: parsed.privateKey };
        failedAt = 0;
      } catch (error) {
        failedAt = clock();
        console.error("Media CDN key unavailable; serving S3 URLs", { error: error?.name || "Error" });
      } finally { loading = null; }
    })();
    await loading;
    return Boolean(key);
  }
  function url(mediaKey) {
    if (!key || !mediaKey) return "";
    try { return signCloudFrontUrl({ domain: cleanDomain, key: mediaKey, keyPairId: key.keyPairId, privateKey: key.privateKey, expires: windowExpiry(Math.floor(clock() / 1000)) }); }
    catch { return ""; }
  }
  return { ready, url, enabled: () => Boolean(key), domain: validDomain ? cleanDomain : "" };
}

// Delete everywhere: once a media file is deleted from S3, CloudFront drops its cached copy too (one path per file), so a
// deleted photo stops loading from the edge right away. `send` is a CloudFront client's send (injected for tests).
export function createMediaInvalidator({ distributionId = "", send, CreateInvalidationCommand, clock = () => Date.now() } = {}) {
  const id = String(distributionId || "").trim();
  const valid = /^E[A-Z0-9]{6,}$/.test(id) && typeof send === "function" && typeof CreateInvalidationCommand === "function";
  return async function invalidate(keys = []) {
    const paths = [...new Set(keys.filter(Boolean).map(key => "/" + encodePath(key)))];
    if (!valid || !paths.length) return false;
    try {
      await send(new CreateInvalidationCommand({ DistributionId: id, InvalidationBatch: { CallerReference: `delete-${clock()}-${Math.random().toString(36).slice(2, 10)}`, Paths: { Quantity: paths.length, Items: paths } } }));
      return true;
    } catch (error) { console.error("Media CDN invalidation failed", { error: error?.name || "Error", paths: paths.length }); return false; }
  };
}
