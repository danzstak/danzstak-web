# 38 — Media CDN and fast loading (owner 2026-11-19: "build the CDN", "takes 10 sec with one user", "needs a proper cdn")

## Why it is slow today (found 2026-11-19, from the code)
1. **No CDN for media.** Every photo and video is fetched straight from the S3 bucket in **us-west-1**
   (`danzstak-call-signaling-mediabucket-…`, `MediaBucket` in `infrastructure/call-signaling/template.yaml`). From Italy
   every request crosses the Atlantic and the US.
2. **Nothing can be cached.** `signedMediaUrl()` (Auth API `infrastructure/auth-api/index.mjs`, 11 call sites, and the
   call-signaling template) makes a fresh SigV4 URL on every request (new `X-Amz-Date`), so the browser, the PWA and any
   CDN see a new URL each time and download the whole file again.
3. **Full-size originals.** Phone photos/videos are stored and served as shot (task 37 scales photos; videos need part 2).
4. **Slow API reads.** `GET /stories` (call-signaling) scans the whole Stories table and calls Cognito `ListUsers` once per
   author; Lambdas run at 128–256 MB (slow cold starts, slow CPU).

Architecture stays serverless (Lambda + API Gateway + DynamoDB + S3; stateless, scales out automatically). No
containers, Kubernetes, pm2 or Redis are needed for this.

## Build (Claude Code), one PR per step, frontend/infra code only; the owner session deploys

### Step 1 — CloudFront in front of the media bucket (`infrastructure/call-signaling/template.yaml`)
- New `MediaDistribution` (`AWS::CloudFront::Distribution`): origin = `MediaBucket` through **Origin Access Control**
  (bucket stays private; bucket policy allows only this distribution's `cloudfront.amazonaws.com` principal to `GetObject`).
- HTTP/2+3, IPv6, `PriceClass_All` (Europe and US edges), compress on, viewer protocol `redirect-to-https`.
- Cache policy: cache key = path only (no cookies, no headers); query strings not in the key except the CloudFront
  signing params, which CloudFront checks and strips. Min/default/max TTL 1 day / 30 days / 1 year: media keys are unique
  per upload and never overwritten, so they are immutable.
- Response headers policy: `Cache-Control: private, max-age=31536000, immutable`, CORS GET from `https://danzstak.com`
  (and `www`, the Amplify preview origin), `Accept-Ranges` kept (video seeking).
- **Private media stays private:** distribution uses a **trusted key group** (signed URLs required). Parameters:
  `MediaSigningPublicKey` (PEM, public — fine in CFN) → `AWS::CloudFront::PublicKey` + `KeyGroup`.
- Domain: start on the `*.cloudfront.net` name (no DNS change). `media.danzstak.com` later is optional and needs an ACM
  cert in us-east-1 plus a DNS record: owner decision (DNS is high-risk; never touch the Zoho MX).
- Output `MediaCdnDomain`.

### Step 2 — Cacheable signed URLs (Auth API + call-signaling)
- New shared `cdnMediaUrl(key)`: CloudFront **canned-policy** signed URL (`Expires`, `Signature`, `Key-Pair-Id`) with the
  private key read once per container from Secrets Manager **`danzstak/cloudfront/media-signing-key`** (us-west-1,
  JSON `{"keyPairId": "...", "privateKey": "-----BEGIN…"}`), cached in memory. Never logged, never in the repo.
- **Expiry rounded up to a fixed window** (e.g. the end of the next whole 6-hour block, at least 1 hour ahead), so every
  request in that window returns the **same URL** for the same key → browser, PWA and edge caches hit.
- Every place that calls `signedMediaUrl(key, …)` for **reading** media uses `cdnMediaUrl(key)` when the CDN env
  (`MEDIA_CDN_DOMAIN`) and secret are present; otherwise it falls back to today's S3 URL (fail-safe, nothing breaks
  before deploy). Upload (PUT) tickets stay S3 presigned PUTs.
- Delete everywhere: after deleting the S3 object, also `CreateInvalidation` for that key's path (one path, cheap), so a
  deleted photo stops loading from the edge right away.
- IAM: Auth API and call-signaling roles may read only that secret and create invalidations on only this distribution
  (managed policy, not inline: the Auth API inline policy is at its size limit).

### Step 3 — Browser side
- CSP `img-src`/`media-src`/`connect-src` in every page (and the feed inline-script hash test) allow the CDN domain.
- Service worker: cache-first for the CDN host (stale-while-revalidate, cap ~150 MB / 400 entries, LRU), never for API calls.
- `<img loading="lazy" decoding="async">` everywhere media is listed; posters for videos; `preload="metadata"` until visible
  (already true for feed videos).

### Step 4 — Faster API reads
- `GET /stories`: replace the full-table Scan with a `Query` on a new GSI (`kind#day` or `audience`, `expiresAt`) or a
  per-member query over the member + friends list; author names from `DanzStak-ProfileNames` (one `BatchGetItem`) instead
  of Cognito `ListUsers` per author.
- Mix list: sign media in the list response (already for posts) so the browser never calls `/stories view` per post.
- Lambda memory: Auth API and call-signaling functions 256 → **1024 MB** (more CPU, faster cold starts; cost is per ms, so
  usually about the same). Optional: provisioned concurrency 1 on the Mix/Stories path, owner decision (small fixed cost).

### Step 5 — Videos at 720p (task 37 part 2), served through the CDN.

## Done when
- A browser check loads Mix twice: the second load fetches **no** media bytes from the network (all from cache), media
  URLs are on the CDN domain and identical across the two loads, and a deleted post's photo URL returns 403/404.
- From the owner's phone in Italy (and in San Francisco, owner 2026-11-20): Mix with 10 photos + 3 videos shows the first
  screen in under 2 s on 4G after the first visit; record before/after numbers in the PR.

## Built so far
- Steps 1–2 (`build/media-cdn`): `infrastructure/auth-api/media-cdn.mjs` (6-hour signed URL windows, S3 fallback, delete
  invalidation through the s3 client), call-signaling template resources `MediaKeyGroup`, `MediaOriginAccessControl`,
  `MediaCachePolicy`, `MediaResponseHeadersPolicy`, `MediaDistribution`, bucket-policy statement, role policy, outputs
  `MediaCdnDomain` / `MediaCdnDistributionId`. Parameters: `MediaSigningPublicKeyId` (creates the CDN) and
  `MediaCdnServe` (`false` until step 3's CSP change is live; `true` makes call-signaling hand out CDN URLs). The Auth API
  hands out CDN URLs only when `MEDIA_CDN_DOMAIN` is set; set it together with `MediaCdnServe=true`, plus
  `MEDIA_CDN_DISTRIBUTION_ID` for delete invalidation, and give the Auth API role `secretsmanager:GetSecretValue` on the
  signing secret and `cloudfront:CreateInvalidation` on the distribution (managed policy).

## Owner session (only the owner's computer / AWS console)
1. Make the signing key (AWS CloudShell or `scripts/setup-media-cdn-key.ps1`): creates the CloudFront public key and stores
   the private key only in Secrets Manager `danzstak/cloudfront/media-signing-key` (us-west-1); prints the public key id.
2. Deploy call-signaling with `MediaSigningPublicKeyId=<that id>` (and `MediaCdnServe=false` until step 3 is live).
3. Deploy call-signaling (CloudFormation change set), then the Auth API; set `MEDIA_CDN_DOMAIN` from the stack output.
4. CloudFront console: https://us-east-1.console.aws.amazon.com/cloudfront/v4/home#/distributions
