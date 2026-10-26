$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false

$Region = "us-west-1"
$Domain = "danzstak.com"
$SupportAddress = "support@$Domain"
$HostedZoneId = "Z0864481MZJ0HPSLQPR9"
$AccountId = "635288116224"
$Bucket = "danzstak-support-mail-$AccountId"
$RuleSet = "DanzStakSupportMail"
$Rule = "SupportAddress"
$TicketsTable = "DANZSTAK-SupportTickets"
$ApiId = "0872gqal4m"
$AuthIntegrationId = "5pipi5a"
$ChangeFile = Join-Path $env:TEMP "danzstak-support-dns.json"
$PolicyFile = Join-Path $env:TEMP "danzstak-support-mail-policy.json"
$RuleFile = Join-Path $env:TEMP "danzstak-support-receipt-rule.json"

function Assert-AwsSuccess([string]$Message) {
  if ($LASTEXITCODE -ne 0) { throw $Message }
}

try {
  $identity = $null
  try {
    $identity = aws sesv2 get-email-identity --region $Region --email-identity $Domain --output json 2>$null | ConvertFrom-Json
  } catch { $identity = $null }
  if (-not $identity) {
    aws sesv2 create-email-identity --region $Region --email-identity $Domain --dkim-signing-attributes NextSigningKeyLength=RSA_2048_BIT --output json | Out-Null
    Assert-AwsSuccess "SES domain identity creation failed."
    $identity = aws sesv2 get-email-identity --region $Region --email-identity $Domain --output json | ConvertFrom-Json
    Assert-AwsSuccess "SES domain identity could not be read."
  }

  $changes = @()
  foreach ($token in $identity.DkimAttributes.Tokens) {
    $changes += @{
      Action = "UPSERT"
      ResourceRecordSet = @{
        Name = "$token._domainkey.$Domain"
        Type = "CNAME"
        TTL = 300
        ResourceRecords = @(@{ Value = "$token.dkim.amazonses.com" })
      }
    }
  }
  $changes += @(
    @{
      Action = "UPSERT"
      ResourceRecordSet = @{
        Name = $Domain
        Type = "MX"
        TTL = 300
        ResourceRecords = @(@{ Value = "10 inbound-smtp.$Region.amazonaws.com" })
      }
    },
    @{
      Action = "UPSERT"
      ResourceRecordSet = @{
        Name = "_dmarc.$Domain"
        Type = "TXT"
        TTL = 300
        ResourceRecords = @(@{ Value = '"v=DMARC1; p=quarantine; rua=mailto:support@danzstak.com; adkim=s; aspf=s; pct=100"' })
      }
    },
    @{
      Action = "UPSERT"
      ResourceRecordSet = @{
        Name = "mail.$Domain"
        Type = "MX"
        TTL = 300
        ResourceRecords = @(@{ Value = "10 feedback-smtp.$Region.amazonses.com" })
      }
    },
    @{
      Action = "UPSERT"
      ResourceRecordSet = @{
        Name = "mail.$Domain"
        Type = "TXT"
        TTL = 300
        ResourceRecords = @(@{ Value = '"v=spf1 include:amazonses.com -all"' })
      }
    }
  )
  @{ Comment = "Authenticate and receive DanzStak support mail"; Changes = $changes } |
    ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $ChangeFile -Encoding ascii
  aws route53 change-resource-record-sets --hosted-zone-id $HostedZoneId --change-batch "file://$ChangeFile" --output json | Out-Null
  Assert-AwsSuccess "Support email DNS update failed."

  aws sesv2 put-email-identity-mail-from-attributes --region $Region --email-identity $Domain --mail-from-domain "mail.$Domain" --behavior-on-mx-failure REJECT_MESSAGE
  Assert-AwsSuccess "SES custom MAIL FROM configuration failed."

  aws s3api head-bucket --bucket $Bucket 2>$null
  if ($LASTEXITCODE -ne 0) {
    aws s3api create-bucket --region $Region --bucket $Bucket --create-bucket-configuration LocationConstraint=$Region | Out-Null
    Assert-AwsSuccess "Support mail bucket creation failed."
  }
  aws s3api put-public-access-block --bucket $Bucket --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
  Assert-AwsSuccess "Support mail public access block failed."
  aws s3api put-bucket-encryption --bucket $Bucket --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true}]}'
  Assert-AwsSuccess "Support mail encryption configuration failed."
  aws s3api put-bucket-lifecycle-configuration --bucket $Bucket --lifecycle-configuration '{"Rules":[{"ID":"ExpireRawSupportMail","Status":"Enabled","Filter":{"Prefix":"incoming/"},"Expiration":{"Days":365},"NoncurrentVersionExpiration":{"NoncurrentDays":30}}]}'
  Assert-AwsSuccess "Support mail retention configuration failed."

  @{
    Version = "2012-10-17"
    Statement = @(
      @{
        Sid = "AllowSesToStoreSupportMail"
        Effect = "Allow"
        Principal = @{ Service = "ses.amazonaws.com" }
        Action = "s3:PutObject"
        Resource = "arn:aws:s3:::$Bucket/incoming/*"
        Condition = @{ StringEquals = @{ "AWS:SourceAccount" = $AccountId }; StringLike = @{ "AWS:SourceArn" = "arn:aws:ses:${Region}:${AccountId}:receipt-rule-set/${RuleSet}:receipt-rule/$Rule" } }
      },
      @{
        Sid = "DenyInsecureTransport"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:*"
        Resource = @("arn:aws:s3:::$Bucket", "arn:aws:s3:::$Bucket/*")
        Condition = @{ Bool = @{ "aws:SecureTransport" = "false" } }
      }
    )
  } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $PolicyFile -Encoding ascii
  aws s3api put-bucket-policy --bucket $Bucket --policy "file://$PolicyFile"
  Assert-AwsSuccess "Support mail bucket policy failed."

  aws ses create-receipt-rule-set --region $Region --rule-set-name $RuleSet 2>$null
  if ($LASTEXITCODE -ne 0) {
    $sets = aws ses list-receipt-rule-sets --region $Region --query "RuleSets[?Name=='$RuleSet'].Name | [0]" --output text
    if ($sets -ne $RuleSet) { throw "Support receipt rule set creation failed." }
  }
  @{
    RuleSetName = $RuleSet
    Rule = @{
      Name = $Rule
      Enabled = $true
      TlsPolicy = "Require"
      Recipients = @($SupportAddress)
      ScanEnabled = $true
      Actions = @(@{ S3Action = @{ BucketName = $Bucket; ObjectKeyPrefix = "incoming/" } })
    }
  } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $RuleFile -Encoding ascii
  aws ses create-receipt-rule --region $Region --cli-input-json "file://$RuleFile"
  if ($LASTEXITCODE -ne 0) {
    aws ses update-receipt-rule --region $Region --cli-input-json "file://$RuleFile"
    Assert-AwsSuccess "Support receipt rule update failed."
  }
  aws ses set-active-receipt-rule-set --region $Region --rule-set-name $RuleSet
  Assert-AwsSuccess "Support receipt rule activation failed."

  $tableStatus = aws dynamodb describe-table --region $Region --table-name $TicketsTable --query 'Table.TableStatus' --output text 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $tableStatus) {
    aws dynamodb create-table --region $Region --table-name $TicketsTable --billing-mode PAY_PER_REQUEST --attribute-definitions AttributeName=ticketId,AttributeType=S --key-schema AttributeName=ticketId,KeyType=HASH --tags Key=Application,Value=DanzStak Key=Purpose,Value=Support --output json | Out-Null
    Assert-AwsSuccess "Support ticket table creation failed."
    aws dynamodb wait table-exists --region $Region --table-name $TicketsTable
    Assert-AwsSuccess "Support ticket table did not become ready."
  }
  aws dynamodb update-time-to-live --region $Region --table-name $TicketsTable --time-to-live-specification Enabled=true,AttributeName=expiresAt --output json | Out-Null
  if ($LASTEXITCODE -ne 0) {
    $ttl = aws dynamodb describe-time-to-live --region $Region --table-name $TicketsTable --query 'TimeToLiveDescription.TimeToLiveStatus' --output text
    if ($ttl -notin @("ENABLED", "ENABLING")) { throw "Support ticket retention could not be enabled." }
  }
  aws dynamodb update-continuous-backups --region $Region --table-name $TicketsTable --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true --output json | Out-Null
  Assert-AwsSuccess "Support ticket point-in-time recovery could not be enabled."

  $routeId = aws apigatewayv2 get-routes --region $Region --api-id $ApiId --query "Items[?RouteKey=='POST /support-tickets'].RouteId | [0]" --output text
  Assert-AwsSuccess "Support API routes could not be inspected."
  if (-not $routeId -or $routeId -eq "None") {
    aws apigatewayv2 create-route --region $Region --api-id $ApiId --route-key "POST /support-tickets" --target "integrations/$AuthIntegrationId" --output json | Out-Null
    Assert-AwsSuccess "Support API route creation failed."
  }
  aws lambda add-permission --region $Region --function-name DANZSTAK-Auth-API --statement-id AllowSupportTicketsFromApiGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:${AccountId}:${ApiId}/*/POST/support-tickets" --output json 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    $permission = aws lambda get-policy --region $Region --function-name DANZSTAK-Auth-API --query Policy --output text
    if ($permission -notmatch "AllowSupportTicketsFromApiGateway") { throw "Support API invoke permission failed." }
  }

  Write-Host "DanzStak support mail configured for $SupportAddress."
  Write-Host "Raw inbound mail is private in s3://$Bucket/incoming/ with a 365-day lifecycle."
  Write-Host "Authenticated web requests are retained in $TicketsTable with point-in-time recovery."
  Write-Host "SES account sandbox status must be removed before acknowledgements can be sent to unverified recipients."
} finally {
  Remove-Item -LiteralPath $ChangeFile,$PolicyFile,$RuleFile -Force -ErrorAction SilentlyContinue
}
