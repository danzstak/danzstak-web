# Task 38 (owner session, run once): creates the CloudFront signing key for the DanzStak media CDN.
# The private key goes ONLY into AWS Secrets Manager (danzstak/cloudfront/media-signing-key, us-west-1) and the local copy
# is deleted. Prints the public key id (not a secret) for the call-signaling deploy parameter MediaSigningPublicKeyId.
# Needs: AWS CLI signed in to the DanzStak account, openssl (comes with Git for Windows).
#   powershell -ExecutionPolicy Bypass -File scripts/setup-media-cdn-key.ps1
$ErrorActionPreference = "Stop"
$secretName = "danzstak/cloudfront/media-signing-key"
$region = "us-west-1"
$dir = Join-Path $env:TEMP ("danzstak-cdn-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $dir | Out-Null
try {
  $existing = aws secretsmanager list-secrets --region $region --filters Key=name,Values=$secretName --query "SecretList[].Name" --output text
  if ($existing -match [regex]::Escape($secretName)) { throw "The secret $secretName already exists. Nothing changed. (Delete it first only if you mean to replace the key.)" }
  $pem = Join-Path $dir "media-key.pem"; $pub = Join-Path $dir "media-key.pub"
  openssl genrsa -out $pem 2048 2>$null
  openssl rsa -pubout -in $pem -out $pub 2>$null
  if (-not (Test-Path $pub)) { throw "openssl did not create the key. Install Git for Windows (it includes openssl) and run again." }
  $config = @{ CallerReference = "danzstak-media-$(Get-Date -Format yyyyMMddHHmmss)"; Name = "danzstak-media-signing"; EncodedKey = (Get-Content $pub -Raw); Comment = "DanzStak media CDN signing" } | ConvertTo-Json -Compress
  $configFile = Join-Path $dir "pk.json"; $config | Out-File -Encoding ascii $configFile
  $id = aws cloudfront create-public-key --public-key-config "file://$configFile" --query PublicKey.Id --output text
  if ($id -notmatch '^K[A-Z0-9]+$') { throw "CloudFront did not return a public key id." }
  $secretFile = Join-Path $dir "sk.json"
  @{ keyPairId = $id; privateKey = (Get-Content $pem -Raw) } | ConvertTo-Json -Compress | Out-File -Encoding ascii $secretFile
  aws secretsmanager create-secret --region $region --name $secretName --description "DanzStak media CDN signing key (task 38)" --secret-string "file://$secretFile" --query Name --output text | Out-Null
  Write-Host ""
  Write-Host "Done. Private key stored in Secrets Manager: $secretName ($region)."
  Write-Host "Public key id (not a secret, send it to Claude): $id"
} finally {
  Remove-Item -Recurse -Force $dir -ErrorAction SilentlyContinue
}
