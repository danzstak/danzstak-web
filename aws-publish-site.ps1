$ErrorActionPreference = "Stop"

$Domain = "danzstak.com"
$Root = $PSScriptRoot

Write-Host "Resolving the CloudFront distribution for $Domain..."
$distributions = aws cloudfront list-distributions --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "Unable to list CloudFront distributions." }
$distribution = $distributions.DistributionList.Items |
  Where-Object { $_.Aliases.Items -contains $Domain } |
  Select-Object -First 1
if (-not $distribution) {
  throw "The active AWS account does not own the $Domain CloudFront distribution. Website files were not uploaded."
}

$origin = $distribution.Origins.Items | Select-Object -First 1
$originDomain = [string]$origin.DomainName
$bucket = if ($originDomain -match '^(.+?)\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$') {
  $Matches[1]
} elseif ($originDomain -match '^(.+?)\.s3-website[.-][a-z0-9-]+\.amazonaws\.com$') {
  $Matches[1]
} else {
  throw "The $Domain distribution origin is not a supported S3 bucket: $originDomain"
}

Write-Host "Verifying access to S3 bucket $bucket..."
aws s3api head-bucket --bucket $bucket
if ($LASTEXITCODE -ne 0) { throw "The website bucket is not accessible with the active AWS credentials." }

Write-Host "Synchronizing the tested DanzStak website release..."
aws s3 sync $Root "s3://$bucket/" `
  --delete `
  --exclude "*" `
  --include "*.html" `
  --include "manifest.webmanifest" `
  --include "service-worker.js" `
  --include "assets/*" `
  --cache-control "public,max-age=300,must-revalidate" `
  --only-show-errors
if ($LASTEXITCODE -ne 0) { throw "Static website synchronization failed." }

foreach ($file in @("index.html", "feed.html", "messages.html", "profile.html", "privacy.html", "terms.html", "service-worker.js", "manifest.webmanifest")) {
  aws s3 cp (Join-Path $Root $file) "s3://$bucket/$file" `
    --cache-control "no-cache,no-store,must-revalidate" `
    --only-show-errors
  if ($LASTEXITCODE -ne 0) { throw "Failed to publish $file." }
}

Write-Host "Invalidating CloudFront distribution $($distribution.Id)..."
$invalidation = aws cloudfront create-invalidation `
  --distribution-id $distribution.Id `
  --paths "/*" `
  --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or -not $invalidation.Invalidation.Id) { throw "CloudFront invalidation failed." }
aws cloudfront wait invalidation-completed `
  --distribution-id $distribution.Id `
  --id $invalidation.Invalidation.Id
if ($LASTEXITCODE -ne 0) { throw "CloudFront invalidation did not complete." }

$liveWorker = Invoke-WebRequest -Uri "https://$Domain/service-worker.js" -UseBasicParsing
$expectedCache = (Select-String -Path (Join-Path $Root "service-worker.js") -Pattern 'danzstak-shell-v\d+').Matches.Value
if (-not $expectedCache -or $liveWorker.Content -notmatch [regex]::Escape($expectedCache)) {
  throw "CloudFront completed, but the live service worker does not match this release."
}

Write-Host "DanzStak static release verified live at https://$Domain/."
