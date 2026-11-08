param(
  [string]$Region = "us-east-1",
  [string]$AppRegion = "us-west-1"
)

$ErrorActionPreference = "Stop"
$AccountId = "635288116224"
$HostedZoneId = "Z0864481MZJ0HPSLQPR9"
$RuleSet = "DanzStakSupportMail"
$Rule = "BookingReplies"
$FunctionName = "DANZSTAK-Booking-Inbound"
$RoleName = "DANZSTAK-Booking-Inbound-role"
$Bucket = "danzstak-booking-replies-$AccountId-$Region"
$Source = Join-Path $PSScriptRoot "infrastructure\booking-inbound"
$Stage = Join-Path $env:TEMP ("danzstak-booking-inbound-" + [guid]::NewGuid().ToString("N"))
$Bundle = Join-Path $env:TEMP "danzstak-booking-inbound.zip"
$TrustFile = Join-Path $env:TEMP "danzstak-booking-inbound-trust.json"
$PolicyFile = Join-Path $env:TEMP "danzstak-booking-inbound-policy.json"
$BucketPolicyFile = Join-Path $env:TEMP "danzstak-booking-inbound-bucket-policy.json"
$RuleFile = Join-Path $env:TEMP "danzstak-booking-inbound-rule.json"
$DnsFile = Join-Path $env:TEMP "danzstak-booking-inbound-dns.json"

function Assert-Success([string]$Message) { if ($LASTEXITCODE -ne 0) { throw $Message } }

try {
  aws sts get-caller-identity --region $Region --output json | Out-Null
  Assert-Success "AWS authentication is missing or expired. Run aws login."
  node --check (Join-Path $Source "index.mjs")
  Assert-Success "Inbound booking handler validation failed."

  @{ Comment = "Route DanzStak booking replies to SES"; Changes = @(@{ Action = "UPSERT"; ResourceRecordSet = @{ Name = "reply.danzstak.com"; Type = "MX"; TTL = 300; ResourceRecords = @(@{ Value = "10 inbound-smtp.$Region.amazonaws.com" }) } }) } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $DnsFile -Encoding ascii
  aws route53 change-resource-record-sets --hosted-zone-id $HostedZoneId --change-batch "file://$DnsFile" --output json | Out-Null
  Assert-Success "Booking reply MX record failed."

  aws s3api head-bucket --bucket $Bucket 2>$null
  if ($LASTEXITCODE -ne 0) { aws s3api create-bucket --region $Region --bucket $Bucket | Out-Null; Assert-Success "Booking reply bucket creation failed." }
  aws s3api put-public-access-block --bucket $Bucket --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
  aws s3api put-bucket-encryption --bucket $Bucket --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
  aws s3api put-bucket-lifecycle-configuration --bucket $Bucket --lifecycle-configuration '{"Rules":[{"ID":"ExpireRawBookingReplies","Status":"Enabled","Filter":{"Prefix":"incoming/"},"Expiration":{"Days":30}}]}'
  @{
    Version = "2012-10-17"
    Statement = @(
      @{ Sid = "AllowSesReceipt"; Effect = "Allow"; Principal = @{ Service = "ses.amazonaws.com" }; Action = "s3:PutObject"; Resource = "arn:aws:s3:::$Bucket/incoming/*"; Condition = @{ StringEquals = @{ "AWS:SourceAccount" = $AccountId } } },
      @{ Sid = "DenyInsecureTransport"; Effect = "Deny"; Principal = "*"; Action = "s3:*"; Resource = @("arn:aws:s3:::$Bucket", "arn:aws:s3:::$Bucket/*"); Condition = @{ Bool = @{ "aws:SecureTransport" = "false" } } }
    )
  } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $BucketPolicyFile -Encoding ascii
  aws s3api put-bucket-policy --bucket $Bucket --policy "file://$BucketPolicyFile"
  Assert-Success "Booking reply bucket policy failed."

  @{ Version = "2012-10-17"; Statement = @(@{ Effect = "Allow"; Principal = @{ Service = "lambda.amazonaws.com" }; Action = "sts:AssumeRole" }) } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $TrustFile -Encoding ascii
  aws iam get-role --role-name $RoleName --output json 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { aws iam create-role --role-name $RoleName --assume-role-policy-document "file://$TrustFile" --output json | Out-Null; Assert-Success "Booking reply Lambda role creation failed." }
  @{
    Version = "2012-10-17"
    Statement = @(
      @{ Effect = "Allow"; Action = @("logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"); Resource = "arn:aws:logs:${Region}:${AccountId}:*" },
      @{ Effect = "Allow"; Action = "s3:GetObject"; Resource = "arn:aws:s3:::$Bucket/incoming/*" },
      @{ Effect = "Allow"; Action = @("dynamodb:GetItem", "dynamodb:TransactWriteItems"); Resource = "arn:aws:dynamodb:${AppRegion}:${AccountId}:table/DANZSTAK-Tours" }
    )
  } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $PolicyFile -Encoding ascii
  aws iam put-role-policy --role-name $RoleName --policy-name DanzStakBookingInbound --policy-document "file://$PolicyFile"
  Assert-Success "Booking reply Lambda policy failed."

  New-Item -ItemType Directory -Path $Stage -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $Source "index.mjs"),(Join-Path $Source "mime.mjs"),(Join-Path $Source "package.json"),(Join-Path $Source "package-lock.json") -Destination $Stage
  Push-Location $Stage
  try { npm ci --omit=dev --ignore-scripts --no-audit --no-fund; Assert-Success "Booking reply dependencies failed." } finally { Pop-Location }
  Compress-Archive -Path (Join-Path $Stage "*") -DestinationPath $Bundle -Force
  $RoleArn = "arn:aws:iam::${AccountId}:role/$RoleName"
  aws lambda get-function --region $Region --function-name $FunctionName --output json 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Start-Sleep -Seconds 8
    aws lambda create-function --region $Region --function-name $FunctionName --runtime nodejs22.x --handler index.handler --role $RoleArn --zip-file "fileb://$Bundle" --timeout 20 --memory-size 256 --environment "Variables={APP_REGION=$AppRegion,INBOUND_BUCKET=$Bucket,TOURS_TABLE=DANZSTAK-Tours}" --output json | Out-Null
  } else {
    aws lambda update-function-code --region $Region --function-name $FunctionName --zip-file "fileb://$Bundle" --output json | Out-Null
  }
  Assert-Success "Booking reply Lambda deployment failed."
  aws lambda wait function-updated --region $Region --function-name $FunctionName
  aws lambda add-permission --region $Region --function-name $FunctionName --statement-id AllowSesBookingReplies --action lambda:InvokeFunction --principal ses.amazonaws.com --source-account $AccountId --source-arn "arn:aws:ses:${Region}:${AccountId}:receipt-rule-set/${RuleSet}:receipt-rule/$Rule" --output json 2>$null | Out-Null

  @{ RuleSetName = $RuleSet; Rule = @{ Name = $Rule; Enabled = $true; TlsPolicy = "Require"; Recipients = @("reply.danzstak.com"); ScanEnabled = $true; Actions = @(@{ S3Action = @{ BucketName = $Bucket; ObjectKeyPrefix = "incoming/" } }, @{ LambdaAction = @{ FunctionArn = "arn:aws:lambda:${Region}:${AccountId}:function:$FunctionName"; InvocationType = "Event" } }) } } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $RuleFile -Encoding ascii
  aws ses create-receipt-rule --region $Region --cli-input-json "file://$RuleFile" 2>$null
  if ($LASTEXITCODE -ne 0) { aws ses update-receipt-rule --region $Region --cli-input-json "file://$RuleFile"; Assert-Success "Booking reply receipt rule update failed." }
  aws ses set-active-receipt-rule-set --region $Region --rule-set-name $RuleSet
  Assert-Success "Booking reply receipt rule activation failed."
  Write-Host "Booking replies are configured for *@reply.danzstak.com and route into private SYNC booking threads."
} finally {
  Remove-Item -LiteralPath $Stage -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $Bundle,$TrustFile,$PolicyFile,$BucketPolicyFile,$RuleFile,$DnsFile -Force -ErrorAction SilentlyContinue
}
