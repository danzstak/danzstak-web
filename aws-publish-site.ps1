$ErrorActionPreference = "Stop"

$Domain = "danzstak.com"
$Root = $PSScriptRoot
$Region = "us-west-1"
$ExpectedWorkerCache = (Select-String -Path (Join-Path $Root "service-worker.js") -Pattern 'danzstak-shell-v\d+').Matches.Value

function Wait-ForPublishedWorker {
  param([string]$Url, [string]$ExpectedCache, [int]$MaxAttempts = 19, [int]$RetrySeconds = 10)
  if (-not $ExpectedCache) { throw "The local service worker has no release identifier." }
  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    try {
      $worker = Invoke-WebRequest -Uri $Url -Headers @{ 'Cache-Control' = 'no-cache' } -UseBasicParsing -TimeoutSec 15
      if ($worker.Content -match [regex]::Escape($ExpectedCache)) { return }
    } catch { Write-Host "Live release check $attempt could not reach the service worker; retrying within the verification limit." }
    if ($attempt -lt $MaxAttempts) { Start-Sleep -Seconds $RetrySeconds }
  }
  throw "The live service worker did not match release $ExpectedCache after $MaxAttempts checks."
}

Write-Host "Resolving the CloudFront distribution for $Domain..."
$distributions = aws cloudfront list-distributions --region $Region --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "Unable to list CloudFront distributions." }
$distribution = $distributions.DistributionList.Items |
  Where-Object { $_.Aliases.Items -contains $Domain } |
  Select-Object -First 1
if (-not $distribution) {
  Write-Host "No customer-managed CloudFront distribution found; checking AWS Amplify Hosting..."
  $apps = aws amplify list-apps --region $Region --output json | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "Unable to list Amplify apps." }
  $amplifyApp = $null
  foreach ($app in $apps.apps) {
    $domains = aws amplify list-domain-associations --region $Region --app-id $app.appId --output json | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw "Unable to inspect Amplify domains for $($app.name)." }
    if ($domains.domainAssociations.domainName -contains $Domain) { $amplifyApp = $app; break }
  }
  if (-not $amplifyApp) {
    throw "Neither CloudFront nor Amplify Hosting in the active AWS account serves $Domain."
  }

  $branch = (aws amplify list-branches --region $Region --app-id $amplifyApp.appId --output json | ConvertFrom-Json).branches |
    Where-Object { $_.stage -eq "PRODUCTION" } | Select-Object -First 1
  if (-not $branch) { throw "The Amplify app has no production branch." }
  $localCommit = (& "C:\Users\5star\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe" -C $Root rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $localCommit) { throw "Unable to resolve the local release commit." }

  Write-Host "Waiting for Amplify production branch $($branch.branchName) to publish $localCommit..."
  $deadline = (Get-Date).AddMinutes(10)
  do {
    $latest = (aws amplify list-jobs --region $Region --app-id $amplifyApp.appId --branch-name $branch.branchName --max-results 1 --output json | ConvertFrom-Json).jobSummaries | Select-Object -First 1
    if ($LASTEXITCODE -ne 0) { throw "Unable to inspect the Amplify deployment job." }
    if ($latest.commitId -eq $localCommit -and $latest.status -eq "SUCCEED") { break }
    if ($latest.commitId -eq $localCommit -and $latest.status -in @("FAILED", "CANCELLED")) { throw "Amplify deployment $($latest.jobId) ended with status $($latest.status)." }
    Start-Sleep -Seconds 10
  } while ((Get-Date) -lt $deadline)
  if ($latest.commitId -ne $localCommit -or $latest.status -ne "SUCCEED") {
    throw "Amplify did not publish commit $localCommit within ten minutes."
  }

  Wait-ForPublishedWorker -Url "https://$Domain/service-worker.js" -ExpectedCache $ExpectedWorkerCache
  Write-Host "DanzStak Amplify release verified live at https://$Domain/."
  exit 0
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
  --region $Region `
  --distribution-id $distribution.Id `
  --paths "/*" `
  --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or -not $invalidation.Invalidation.Id) { throw "CloudFront invalidation failed." }
aws cloudfront wait invalidation-completed `
  --region $Region `
  --distribution-id $distribution.Id `
  --id $invalidation.Invalidation.Id
if ($LASTEXITCODE -ne 0) { throw "CloudFront invalidation did not complete." }

$liveWorker = Invoke-WebRequest -Uri "https://$Domain/service-worker.js" -UseBasicParsing
$expectedCache = (Select-String -Path (Join-Path $Root "service-worker.js") -Pattern 'danzstak-shell-v\d+').Matches.Value
if (-not $expectedCache -or $liveWorker.Content -notmatch [regex]::Escape($expectedCache)) {
  throw "CloudFront completed, but the live service worker does not match this release."
}

Write-Host "DanzStak static release verified live at https://$Domain/."
