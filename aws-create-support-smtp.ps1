$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false

$Region = "us-west-1"
$AccountId = "635288116224"
$UserName = "DanzStakSupportGmailSmtp"
$PolicyName = "DanzStakSupportSendOnly"
$PolicyPath = Join-Path $env:TEMP "danzstak-support-smtp-policy.json"

function Invoke-HmacSha256([byte[]]$Key, [string]$Text) {
  $hmac = [System.Security.Cryptography.HMACSHA256]::new($Key)
  try {
    return $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Text))
  } finally {
    $hmac.Dispose()
  }
}

try {
  @{
    Version = "2012-10-17"
    Statement = @(@{
      Effect = "Allow"
      Action = @("ses:SendEmail", "ses:SendRawEmail")
      Resource = "arn:aws:ses:${Region}:${AccountId}:identity/danzstak.com"
      Condition = @{ StringEquals = @{ "ses:FromAddress" = "support@danzstak.com" } }
    })
  } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $PolicyPath -Encoding ascii

  aws iam get-user --user-name $UserName --output json 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    aws iam create-user --user-name $UserName --tags Key=Application,Value=DanzStak Key=Purpose,Value=GmailSupportSmtp --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not create the restricted SMTP user." }
  }
  aws iam put-user-policy --user-name $UserName --policy-name $PolicyName --policy-document "file://$PolicyPath"
  if ($LASTEXITCODE -ne 0) { throw "Could not apply the restricted SMTP policy." }

  $existingKeys = @(aws iam list-access-keys --user-name $UserName --query "AccessKeyMetadata[].AccessKeyId" --output text)
  foreach ($existingKey in ($existingKeys -split "\s+" | Where-Object { $_ })) {
    aws iam delete-access-key --user-name $UserName --access-key-id $existingKey
    if ($LASTEXITCODE -ne 0) { throw "Could not rotate the existing SMTP credential." }
  }

  $key = (aws iam create-access-key --user-name $UserName --output json | ConvertFrom-Json).AccessKey
  if ($LASTEXITCODE -ne 0 -or -not $key) { throw "Could not create the SMTP credential." }

  $dateKey = Invoke-HmacSha256 ([System.Text.Encoding]::UTF8.GetBytes("AWS4$($key.SecretAccessKey)")) "11111111"
  $regionKey = Invoke-HmacSha256 $dateKey $Region
  $serviceKey = Invoke-HmacSha256 $regionKey "ses"
  $terminalKey = Invoke-HmacSha256 $serviceKey "aws4_request"
  $messageKey = Invoke-HmacSha256 $terminalKey "SendRawEmail"
  $smtpPassword = [Convert]::ToBase64String(([byte[]](4)) + $messageKey)

  [pscustomobject]@{
    SmtpServer = "email-smtp.$Region.amazonaws.com"
    Port = 587
    Username = $key.AccessKeyId
    Password = $smtpPassword
  } | ConvertTo-Json -Compress
} finally {
  Remove-Item -LiteralPath $PolicyPath -Force -ErrorAction SilentlyContinue
}
