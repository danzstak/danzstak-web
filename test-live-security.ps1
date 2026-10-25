param(
  [switch]$ExpectGroups
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
$groupsStatus = & curl.exe -sS -o NUL -w "%{http_code}" "https://api.danzstak.com/groups"
$expectedGroupsStatus = if ($ExpectGroups) { "401" } else { "404" }
if ($LASTEXITCODE -ne 0 -or $groupsStatus -ne $expectedGroupsStatus) { Add-Failure "Unauthenticated groups request returned $groupsStatus instead of $expectedGroupsStatus" }

& curl.exe -sS --tlsv1.2 --tls-max 1.2 -o NUL "https://danzstak.com/"
if ($LASTEXITCODE -ne 0) { Add-Failure "TLS 1.2 connection failed" }
& curl.exe -sS --tlsv1.0 --tls-max 1.1 -o NUL "https://danzstak.com/" 2>$null
if ($LASTEXITCODE -eq 0) { Add-Failure "TLS 1.1 or older was accepted" }

if ($failures.Count) {
  $failures | ForEach-Object { Write-Error $_ }
  exit 1
}

Write-Host "Live security checks passed: website headers, API authentication, and TLS policy."
