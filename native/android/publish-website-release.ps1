param(
  [Parameter(Mandatory = $true)][string]$Bucket,
  [string]$DistributionId,
  [string]$Region = "us-west-1"
)

$ErrorActionPreference = "Stop"
& (Join-Path $PSScriptRoot "build-website-release.ps1")

$apk = Join-Path $PSScriptRoot "app\build\outputs\apk\release\app-release.apk"
$publicKey = "downloads/danzstak-android.apk"

aws s3 cp $apk "s3://$Bucket/$publicKey" `
  --region $Region `
  --content-type "application/vnd.android.package-archive" `
  --cache-control "public,max-age=300,must-revalidate" `
  --metadata-directive REPLACE `
  --only-show-errors
if ($LASTEXITCODE -ne 0) { throw "Uploading the Android release failed." }

if ($DistributionId) {
  aws cloudfront create-invalidation `
    --region $Region `
    --distribution-id $DistributionId `
    --paths "/$publicKey" `
    --output json | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "CloudFront invalidation failed." }
}

$localHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $apk).Hash
Write-Host "Android release published at https://danzstak.com/$publicKey"
Write-Host "SHA-256: $localHash"
