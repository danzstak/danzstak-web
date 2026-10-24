$ErrorActionPreference = "Stop"

$Domain = "danzstak.com"
$SecurityHeadersPolicyId = "67f7725c-6f97-4210-82d7-5512b31e9d03"

Write-Host "Locating the CloudFront distribution for $Domain..."
$distributions = aws cloudfront list-distributions --output json | ConvertFrom-Json
$distribution = $distributions.DistributionList.Items |
  Where-Object { $_.Aliases.Items -contains $Domain } |
  Select-Object -First 1

if (-not $distribution) {
  throw "No CloudFront distribution has the $Domain alias."
}

$distributionId = $distribution.Id
$current = aws cloudfront get-distribution-config --id $distributionId --output json | ConvertFrom-Json

if ($current.DistributionConfig.DefaultCacheBehavior.ResponseHeadersPolicyId -eq $SecurityHeadersPolicyId) {
  Write-Host "AWS managed SecurityHeadersPolicy is already attached to $Domain."
  exit 0
}

$current.DistributionConfig.DefaultCacheBehavior |
  Add-Member -NotePropertyName ResponseHeadersPolicyId -NotePropertyValue $SecurityHeadersPolicyId -Force

$configPath = Join-Path $env:TEMP "danzstak-cloudfront-$distributionId.json"
try {
  $current.DistributionConfig | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $configPath -Encoding utf8
  Write-Host "Attaching AWS managed SecurityHeadersPolicy to distribution $distributionId..."
  aws cloudfront update-distribution `
    --id $distributionId `
    --if-match $current.ETag `
    --distribution-config "file://$configPath" | Out-Null
} finally {
  Remove-Item -LiteralPath $configPath -Force -ErrorAction SilentlyContinue
}

Write-Host "CloudFront update submitted. HSTS, nosniff, frame protection, and a strict referrer policy will appear after deployment."
