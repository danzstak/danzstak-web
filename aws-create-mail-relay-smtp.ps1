$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false

$Region = "us-west-1"
$UserName = "DanzStakMailServerSmtp"
$PolicyName = "DanzStakMailServerSendOnly"
$SecretName = "DanzStak/Mail/RelaySmtp"
$PolicyPath = Join-Path $env:TEMP "danzstak-mail-relay-policy.json"

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
      Resource = "*"
      Condition = @{ StringLike = @{ "ses:FromAddress" = "*@danzstak.com" } }
    })
  } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $PolicyPath -Encoding ascii

  aws iam get-user --user-name $UserName --output json 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    aws iam create-user --user-name $UserName --tags Key=Application,Value=DanzStak Key=Purpose,Value=MailServerRelay --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not create the restricted SMTP relay user." }
  }

  aws iam put-user-policy --user-name $UserName --policy-name $PolicyName --policy-document "file://$PolicyPath"
  if ($LASTEXITCODE -ne 0) { throw "Could not apply the restricted SMTP relay policy." }

  $existingKeys = @(aws iam list-access-keys --user-name $UserName --query "AccessKeyMetadata[].AccessKeyId" --output text)
  foreach ($existingKey in ($existingKeys -split "\s+" | Where-Object { $_ })) {
    aws iam delete-access-key --user-name $UserName --access-key-id $existingKey
    if ($LASTEXITCODE -ne 0) { throw "Could not rotate the existing SMTP relay credential." }
  }

  $key = (aws iam create-access-key --user-name $UserName --output json | ConvertFrom-Json).AccessKey
  if ($LASTEXITCODE -ne 0 -or -not $key) { throw "Could not create the SMTP relay credential." }

  $dateKey = Invoke-HmacSha256 ([System.Text.Encoding]::UTF8.GetBytes("AWS4$($key.SecretAccessKey)")) "11111111"
  $regionKey = Invoke-HmacSha256 $dateKey $Region
  $serviceKey = Invoke-HmacSha256 $regionKey "ses"
  $terminalKey = Invoke-HmacSha256 $serviceKey "aws4_request"
  $messageKey = Invoke-HmacSha256 $terminalKey "SendRawEmail"
  $smtpPassword = [Convert]::ToBase64String(([byte[]](4)) + $messageKey)

  $secret = @{
    host = "email-smtp.$Region.amazonaws.com"
    port = 587
    username = $key.AccessKeyId
    password = $smtpPassword
  } | ConvertTo-Json -Compress

  aws secretsmanager describe-secret --region $Region --secret-id $SecretName --output json 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) {
    aws secretsmanager put-secret-value --region $Region --secret-id $SecretName --secret-string $secret | Out-Null
  } else {
    aws secretsmanager create-secret --region $Region --name $SecretName --description "Restricted SES SMTP relay credentials for the DanzStak mail server" --secret-string $secret | Out-Null
  }
  if ($LASTEXITCODE -ne 0) { throw "Could not store the SMTP relay credential." }

  Write-Output "Restricted SMTP relay credentials created and stored in AWS Secrets Manager."
} finally {
  Remove-Item -LiteralPath $PolicyPath -Force -ErrorAction SilentlyContinue
}
