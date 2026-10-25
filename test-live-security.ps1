param(
  [switch]$ExpectGroups,
  [switch]$ExpectProfileVideo
)

$ErrorActionPreference = "Stop"

$failures = [System.Collections.Generic.List[string]]::new()
function Add-Failure([string]$message) { $failures.Add($message) }

function Get-Headers([string]$url) {
  $output = & curl.exe -sS -D - -o NUL $url
  if ($LASTEXITCODE -ne 0) { Add-Failure "Could not reach $url"; return "" }
  return ($output -join "`n")
}

$siteHeaders = Get-Headers "https://danzstak.com/"
if ($siteHeaders -notmatch "HTTP/\S+ 200") { Add-Failure "Website did not return HTTP 200" }
foreach ($header in @("Strict-Transport-Security", "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy")) {
  if ($siteHeaders -notmatch "(?im)^$([regex]::Escape($header)):\s*\S+") { Add-Failure "Website is missing $header" }
}

$postsStatus = & curl.exe -sS -o NUL -w "%{http_code}" "https://api.danzstak.com/secure-posts"
if ($LASTEXITCODE -ne 0 -or $postsStatus -ne "401") { Add-Failure "Unauthenticated posts request returned $postsStatus instead of 401" }
$trustedCors = & curl.exe -sS -D - -o NUL -H "Origin: https://danzstak.com" "https://api.danzstak.com/secure-posts"
if ($LASTEXITCODE -ne 0 -or ($trustedCors -join "`n") -notmatch '(?im)^access-control-allow-origin:\s*https://danzstak\.com\s*$' -or ($trustedCors -join "`n") -notmatch '(?im)^access-control-allow-credentials:\s*true\s*$') {
  Add-Failure "Trusted website origin does not receive credentialed API CORS access"
}
$untrustedCors = & curl.exe -sS -D - -o NUL -H "Origin: https://evil.example" "https://api.danzstak.com/secure-posts"
if ($LASTEXITCODE -ne 0) { Add-Failure "Could not test untrusted API origin" }
elseif (($untrustedCors -join "`n") -match '(?im)^access-control-allow-origin:') { Add-Failure "Untrusted origin received API CORS access" }
$preflight = & curl.exe -sS -D - -o NUL -X OPTIONS -H "Origin: https://danzstak.com" -H "Access-Control-Request-Method: POST" "https://api.danzstak.com/secure-posts"
$preflightText = $preflight -join "`n"
if ($LASTEXITCODE -ne 0 -or $preflightText -notmatch '(?im)^access-control-allow-methods:.*\bPOST\b' -or $preflightText -notmatch '(?im)^access-control-allow-origin:\s*https://danzstak\.com\s*$') {
  Add-Failure "Trusted API preflight does not authorize required POST requests"
}
$groupsStatus = & curl.exe -sS -o NUL -w "%{http_code}" "https://api.danzstak.com/groups"
$expectedGroupsStatus = if ($ExpectGroups) { "401" } else { "404" }
if ($LASTEXITCODE -ne 0 -or $groupsStatus -ne $expectedGroupsStatus) { Add-Failure "Unauthenticated groups request returned $groupsStatus instead of $expectedGroupsStatus" }
$profileVideoStatus = & curl.exe -sS -o NUL -w "%{http_code}" "https://api.danzstak.com/profile-video"
$expectedProfileVideoStatus = if ($ExpectProfileVideo) { "401" } else { "404" }
if ($LASTEXITCODE -ne 0 -or $profileVideoStatus -ne $expectedProfileVideoStatus) { Add-Failure "Unauthenticated profile-video request returned $profileVideoStatus instead of $expectedProfileVideoStatus" }

foreach ($asset in @(
  @{ Url = "https://danzstak.com/assets/favicon-32.png?v=1"; Type = "image/png"; Name = "favicon" },
  @{ Url = "https://danzstak.com/assets/danzstak-share-fb-v2.jpg"; Type = "image/jpeg"; Name = "social-share image" }
)) {
  $headers = Get-Headers $asset.Url
  if ($headers -notmatch "HTTP/\S+ 200") { Add-Failure "$($asset.Name) did not return HTTP 200" }
  if ($headers -notmatch "(?im)^Content-Type:\s*$([regex]::Escape($asset.Type))") { Add-Failure "$($asset.Name) has the wrong content type" }
}

& curl.exe -sS --tlsv1.2 --tls-max 1.2 -o NUL "https://danzstak.com/"
if ($LASTEXITCODE -ne 0) { Add-Failure "TLS 1.2 connection failed" }
$previousErrorPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& curl.exe -sS --tlsv1.0 --tls-max 1.1 -o NUL "https://danzstak.com/" 2>$null
$legacyTlsExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorPreference
if ($legacyTlsExitCode -eq 0) { Add-Failure "TLS 1.1 or older was accepted" }

if ($failures.Count) {
  $failures | ForEach-Object { Write-Error $_ -ErrorAction Continue }
  exit 1
}

Write-Host "Live security checks passed: website headers, branded assets, API authentication, and TLS policy."
