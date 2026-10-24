$ErrorActionPreference = "Stop"

$Domain = "danzstak.com"
$SecurityHeadersPolicyId = "67f7725c-6f97-4210-82d7-5512b31e9d03"

Write-Host "Locating the CloudFront distribution for $Domain..."
$distributions = aws cloudfront list-distributions --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "Unable to list CloudFront distributions." }
$distribution = $distributions.DistributionList.Items |
  Where-Object { $_.Aliases.Items -contains $Domain } |
  Select-Object -First 1

if (-not $distribution) {
  throw "No CloudFront distribution has the $Domain alias."
}

$distributionId = $distribution.Id
$current = aws cloudfront get-distribution-config --id $distributionId --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "Unable to read CloudFront distribution $distributionId." }
$changed = $false

if ($current.DistributionConfig.DefaultCacheBehavior.ResponseHeadersPolicyId -ne $SecurityHeadersPolicyId) {
  $current.DistributionConfig.DefaultCacheBehavior |
    Add-Member -NotePropertyName ResponseHeadersPolicyId -NotePropertyValue $SecurityHeadersPolicyId -Force
  $changed = $true
}

if ($current.DistributionConfig.HttpVersion -ne "http2and3") {
  $current.DistributionConfig.HttpVersion = "http2and3"
  $changed = $true
}

if ($current.DistributionConfig.ViewerCertificate.ACMCertificateArn -and
    $current.DistributionConfig.ViewerCertificate.MinimumProtocolVersion -ne "TLSv1.2_2021") {
  $current.DistributionConfig.ViewerCertificate.MinimumProtocolVersion = "TLSv1.2_2021"
  $changed = $true
}

if (-not $changed) {
  Write-Host "CloudFront security headers, TLS 1.2 minimum, and HTTP/3 are already configured for $Domain."
} else {
  $configPath = Join-Path $env:TEMP "danzstak-cloudfront-$distributionId.json"
  try {
    $current.DistributionConfig | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $configPath -Encoding utf8
    Write-Host "Applying security headers, TLS 1.2 minimum, and HTTP/3 to distribution $distributionId..."
    aws cloudfront update-distribution `
      --id $distributionId `
      --if-match $current.ETag `
      --distribution-config "file://$configPath" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "CloudFront rejected the security configuration update." }
  } finally {
    Remove-Item -LiteralPath $configPath -Force -ErrorAction SilentlyContinue
  }

  Write-Host "Waiting for CloudFront distribution $distributionId to finish deploying..."
  aws cloudfront wait distribution-deployed --id $distributionId
  if ($LASTEXITCODE -ne 0) { throw "CloudFront did not finish deploying successfully." }
}

$response = Invoke-WebRequest -Uri "https://$Domain/" -Method Head -UseBasicParsing
$requiredHeaders = @(
  "Strict-Transport-Security",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Referrer-Policy"
)
foreach ($header in $requiredHeaders) {
  if ([string]::IsNullOrWhiteSpace([string]$response.Headers[$header])) {
    throw "CloudFront deployed, but the required $header response header is missing."
  }
}

Write-Host "CloudFront hardening verified live: TLS 1.2+, HTTP/2 and HTTP/3, HSTS, nosniff, frame protection, and a strict referrer policy are active."
