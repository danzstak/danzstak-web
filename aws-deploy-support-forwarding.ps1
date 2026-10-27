$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false

$Region = "us-west-1"
$AccountId = "635288116224"
$FunctionName = "DanzStak-Support-Mail-Forwarder"
$RoleName = "DanzStakSupportMailForwarderRole"
$Bucket = "danzstak-support-mail-$AccountId"
$RuleSet = "DanzStakSupportMail"
$RuleName = "SupportAddress"
$SupportAddress = "support@danzstak.com"
$ForwardTo = "5starceo@gmail.com"
$BuildDirectory = Join-Path $env:TEMP "danzstak-support-forwarder"
$ZipPath = Join-Path $env:TEMP "danzstak-support-forwarder.zip"
$TrustPath = Join-Path $env:TEMP "danzstak-support-forwarder-trust.json"
$PolicyPath = Join-Path $env:TEMP "danzstak-support-forwarder-policy.json"
$RulePath = Join-Path $env:TEMP "danzstak-support-forwarder-rule.json"

function Assert-AwsSuccess([string]$Message) {
  if ($LASTEXITCODE -ne 0) { throw $Message }
}

try {
  New-Item -ItemType Directory -Path $BuildDirectory -Force | Out-Null
  Copy-Item -LiteralPath ".\infrastructure\support-email-forwarder\lambda_function.py" -Destination $BuildDirectory -Force
  Compress-Archive -LiteralPath (Join-Path $BuildDirectory "lambda_function.py") -DestinationPath $ZipPath -Force

  @{ Version = "2012-10-17"; Statement = @(@{ Effect = "Allow"; Principal = @{ Service = "lambda.amazonaws.com" }; Action = "sts:AssumeRole" }) } |
    ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $TrustPath -Encoding ascii
  @{ Version = "2012-10-17"; Statement = @(
      @{ Effect = "Allow"; Action = @("logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"); Resource = "arn:aws:logs:${Region}:${AccountId}:*" },
      @{ Effect = "Allow"; Action = "s3:GetObject"; Resource = "arn:aws:s3:::$Bucket/incoming/*" },
      @{ Effect = "Allow"; Action = "ses:SendRawEmail"; Resource = "*" }
    ) } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $PolicyPath -Encoding ascii

  $roleArn = aws iam get-role --role-name $RoleName --query "Role.Arn" --output text 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $roleArn) {
    $roleArn = aws iam create-role --role-name $RoleName --assume-role-policy-document "file://$TrustPath" --query "Role.Arn" --output text
    Assert-AwsSuccess "Could not create the support forwarding role."
    Start-Sleep -Seconds 10
  }
  aws iam put-role-policy --role-name $RoleName --policy-name DanzStakSupportMailForwarder --policy-document "file://$PolicyPath"
  Assert-AwsSuccess "Could not update the support forwarding role policy."

  aws lambda get-function --region $Region --function-name $FunctionName --output json 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) {
    aws lambda update-function-code --region $Region --function-name $FunctionName --zip-file "fileb://$ZipPath" --output json | Out-Null
    Assert-AwsSuccess "Could not update the support forwarding function."
    aws lambda wait function-updated --region $Region --function-name $FunctionName
    aws lambda update-function-configuration --region $Region --function-name $FunctionName --runtime python3.13 --handler lambda_function.lambda_handler --timeout 30 --memory-size 256 --environment "Variables={MAIL_BUCKET=$Bucket,MAIL_PREFIX=incoming/,FORWARD_TO=$ForwardTo,SUPPORT_ADDRESS=$SupportAddress}" --output json | Out-Null
  } else {
    aws lambda create-function --region $Region --function-name $FunctionName --runtime python3.13 --role $roleArn --handler lambda_function.lambda_handler --timeout 30 --memory-size 256 --zip-file "fileb://$ZipPath" --environment "Variables={MAIL_BUCKET=$Bucket,MAIL_PREFIX=incoming/,FORWARD_TO=$ForwardTo,SUPPORT_ADDRESS=$SupportAddress}" --output json | Out-Null
  }
  Assert-AwsSuccess "Could not deploy the support forwarding function."
  aws lambda wait function-active-v2 --region $Region --function-name $FunctionName
  $functionArn = aws lambda get-function-configuration --region $Region --function-name $FunctionName --query "FunctionArn" --output text
  Assert-AwsSuccess "Could not read the support forwarding function."

  aws lambda add-permission --region $Region --function-name $FunctionName --statement-id AllowSesSupportMail --action lambda:InvokeFunction --principal ses.amazonaws.com --source-account $AccountId --source-arn "arn:aws:ses:${Region}:${AccountId}:receipt-rule-set/${RuleSet}:receipt-rule/$RuleName" --output json 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    $policy = aws lambda get-policy --region $Region --function-name $FunctionName --query Policy --output text
    if ($policy -notmatch "AllowSesSupportMail") { throw "Could not authorize SES to invoke the support forwarder." }
  }

  @{ RuleSetName = $RuleSet; Rule = @{
      Name = $RuleName; Enabled = $true; TlsPolicy = "Require"; Recipients = @($SupportAddress); ScanEnabled = $true
      Actions = @(
        @{ S3Action = @{ BucketName = $Bucket; ObjectKeyPrefix = "incoming/" } },
        @{ LambdaAction = @{ FunctionArn = $functionArn; InvocationType = "Event" } }
      )
    } } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $RulePath -Encoding ascii
  aws ses update-receipt-rule --region $Region --cli-input-json "file://$RulePath"
  Assert-AwsSuccess "Could not enable support mail forwarding."

  Write-Host "support@danzstak.com now forwards to $ForwardTo."
} finally {
  Remove-Item -LiteralPath $BuildDirectory -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $ZipPath,$TrustPath,$PolicyPath,$RulePath -Force -ErrorAction SilentlyContinue
}
