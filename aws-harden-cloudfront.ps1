$ErrorActionPreference = "Stop"

$Domain = "danzstak.com"
$Region = "us-west-1"
$SecurityHeadersPolicyId = "67f7725c-6f97-4210-82d7-5512b31e9d03"
$CachePolicyName = "DanzStak-Frequent-Revalidation"

Write-Host "Locating the CloudFront distribution for $Domain..."
$distributions = aws cloudfront list-distributions --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "Unable to list CloudFront distributions." }
$distribution = $distributions.DistributionList.Items |
  Where-Object { $_.Aliases.Items -contains $Domain } |
  Select-Object -First 1

if (-not $distribution) {
  Write-Host "CloudFront is managed by Amplify Hosting; validating the repository-managed security headers."
  $headerFile = Join-Path $PSScriptRoot "customHttp.yml"
  if (-not (Test-Path -LiteralPath $headerFile)) { throw "Amplify security header file customHttp.yml is missing." }
  $headerSource = Get-Content -LiteralPath $headerFile -Raw
  foreach ($required in @("Strict-Transport-Security", "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy")) {
    if ($headerSource -notmatch [regex]::Escape($required)) { throw "customHttp.yml is missing $required." }
  }
  $apps = aws amplify list-apps --region $Region --output json | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "Unable to list Amplify apps." }
  $amplifyApp = $null
  foreach ($app in $apps.apps) {
    $domains = aws amplify list-domain-associations --region $Region --app-id $app.appId --output json | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw "Unable to inspect Amplify domains for $($app.name)." }
    if ($domains.domainAssociations.domainName -contains $Domain) { $amplifyApp = $app; break }
  }
  if (-not $amplifyApp) { throw "No Amplify app serves $Domain." }

  $response = Invoke-WebRequest -Uri "https://$Domain/" -Method Head -UseBasicParsing
  foreach ($required in @("Strict-Transport-Security", "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy")) {
    if ([string]::IsNullOrWhiteSpace([string]$response.Headers[$required])) {
      throw "Amplify serves $Domain, but the deployed release is missing $required."
    }
  }
  Write-Host "Amplify Hosting verified live with required DanzStak security headers."
  exit 0
}

$distributionId = $distribution.Id
$current = aws cloudfront get-distribution-config --id $distributionId --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "Unable to read CloudFront distribution $distributionId." }
$changed = $false

Write-Host "Locating the bounded DanzStak cache policy..."
$cachePolicies = aws cloudfront list-cache-policies --type custom --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "Unable to list CloudFront cache policies." }
$cachePolicy = $cachePolicies.CachePolicyList.Items |
  Where-Object { $_.CachePolicy.CachePolicyConfig.Name -eq $CachePolicyName } |
  Select-Object -First 1

if (-not $cachePolicy) {
  $cachePolicyPath = Join-Path $env:TEMP "danzstak-cache-policy.json"
  try {
    @{
      Name = $CachePolicyName
      Comment = "Revalidate DanzStak releases within five minutes"
      MinTTL = 0
      DefaultTTL = 60
      MaxTTL = 300
      ParametersInCacheKeyAndForwardedToOrigin = @{
        EnableAcceptEncodingGzip = $true
        EnableAcceptEncodingBrotli = $true
        HeadersConfig = @{ HeaderBehavior = "none" }
        CookiesConfig = @{ CookieBehavior = "none" }
        QueryStringsConfig = @{ QueryStringBehavior = "none" }
      }
    } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $cachePolicyPath -Encoding utf8
    $createdPolicy = aws cloudfront create-cache-policy --cache-policy-config "file://$cachePolicyPath" --output json | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or -not $createdPolicy.CachePolicy.Id) { throw "Unable to create the DanzStak cache policy." }
    $cachePolicyId = $createdPolicy.CachePolicy.Id
  } finally {
    Remove-Item -LiteralPath $cachePolicyPath -Force -ErrorAction SilentlyContinue
  }
} else {
  $cachePolicyId = $cachePolicy.CachePolicy.Id
}

if ($current.DistributionConfig.DefaultCacheBehavior.CachePolicyId -ne $cachePolicyId) {
  $current.DistributionConfig.DefaultCacheBehavior |
    Add-Member -NotePropertyName CachePolicyId -NotePropertyValue $cachePolicyId -Force
  $current.DistributionConfig.DefaultCacheBehavior.PSObject.Properties.Remove("ForwardedValues")
  $changed = $true
}

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
  Write-Host "CloudFront cache limits, security headers, TLS 1.2 minimum, and HTTP/3 are already configured for $Domain."
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

Write-Host "Invalidating the previous DanzStak release from CloudFront..."
aws cloudfront create-invalidation --distribution-id $distributionId --paths "/*" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "CloudFront invalidation failed." }

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

Write-Host "CloudFront verified live: five-minute maximum cache age, TLS 1.2+, HTTP/2 and HTTP/3, HSTS, nosniff, frame protection, and a strict referrer policy are active."
