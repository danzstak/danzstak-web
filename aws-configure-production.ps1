$ErrorActionPreference = "Stop"

$ApiRegion = "us-west-1"
$ApiId = "0872gqal4m"
$AmplifyAppId = "d31oovi2mos5iz"
$UserPoolRegion = "us-east-1"
$UserPoolId = "us-east-1_qA4B46ilc"

Write-Host "Keeping DanzStak self-signup open with email verification..."
$CurrentUserPool = (aws cognito-idp describe-user-pool `
  --region $UserPoolRegion `
  --user-pool-id $UserPoolId `
  --output json | ConvertFrom-Json).UserPool
if ($LASTEXITCODE -ne 0 -or -not $CurrentUserPool) { throw "Cognito user-pool lookup failed." }

# UpdateUserPool resets omitted fields to service defaults. Build the request from
# the live pool so opening signup cannot silently weaken unrelated settings.
$SignupConfig = [ordered]@{
  UserPoolId = $UserPoolId
  PoolName = $CurrentUserPool.Name
}
foreach ($Name in @(
  "Policies", "DeletionProtection", "VerificationMessageTemplate",
  "UserAttributeUpdateSettings", "MfaConfiguration", "EmailConfiguration",
  "UserPoolTags", "AdminCreateUserConfig", "AccountRecoverySetting",
  "UserPoolTier", "KeyConfiguration", "IssuerConfiguration",
  "DeviceConfiguration", "SmsConfiguration", "UserPoolAddOns"
)) {
  $Property = $CurrentUserPool.PSObject.Properties[$Name]
  if ($Property -and $null -ne $Property.Value) { $SignupConfig[$Name] = $Property.Value }
}
$PreservedTriggers = [ordered]@{}
if ($CurrentUserPool.LambdaConfig) {
  foreach ($Property in $CurrentUserPool.LambdaConfig.PSObject.Properties) {
    if ($Property.Name -ne "PreSignUp") { $PreservedTriggers[$Property.Name] = $Property.Value }
  }
}
$SignupConfig["LambdaConfig"] = $PreservedTriggers
$SignupConfig["AutoVerifiedAttributes"] = @("email")
$SignupConfig["VerificationMessageTemplate"] = [ordered]@{
  DefaultEmailOption = "CONFIRM_WITH_CODE"
  EmailSubject = "Verify your DanzStak account"
  EmailMessage = "Welcome to DanzStak - your digital clubhouse for music people.`n`nYour verification code is {####}.`n`nIf you did not create this account, you can ignore this email. DanzStak will never ask for your password or sell your personal information."
}
$SignupJson = $SignupConfig | ConvertTo-Json -Depth 20 -Compress
$SignupRequestPath = Join-Path ([System.IO.Path]::GetTempPath()) ("danzstak-cognito-" + [guid]::NewGuid().ToString("N") + ".json")
try {
  [System.IO.File]::WriteAllText($SignupRequestPath, $SignupJson, (New-Object System.Text.UTF8Encoding($false)))
  aws cognito-idp update-user-pool `
    --region $UserPoolRegion `
    --cli-input-json ("file://" + $SignupRequestPath) | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Cognito public signup configuration failed." }
}
finally {
  if (Test-Path -LiteralPath $SignupRequestPath) { Remove-Item -LiteralPath $SignupRequestPath -Force }
}

$VerifiedSignupConfig = (aws cognito-idp describe-user-pool `
  --region $UserPoolRegion `
  --user-pool-id $UserPoolId `
  --output json | ConvertFrom-Json).UserPool
if ($LASTEXITCODE -ne 0 -or
    $VerifiedSignupConfig.AdminCreateUserConfig.AllowAdminCreateUserOnly -or
    $VerifiedSignupConfig.AutoVerifiedAttributes -notcontains "email" -or
    $VerifiedSignupConfig.LambdaConfig.PSObject.Properties.Name -contains "PreSignUp") {
  throw "Cognito public signup verification failed."
}

Write-Host "Configuring optional authenticator-app MFA..."
aws cognito-idp set-user-pool-mfa-config `
  --region $UserPoolRegion `
  --user-pool-id $UserPoolId `
  --mfa-configuration OPTIONAL `
  --software-token-mfa-configuration Enabled=true | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Cognito MFA configuration failed." }

Write-Host "Configuring credentialed CORS for the DanzStak origin..."
aws apigatewayv2 update-api `
  --region $ApiRegion `
  --api-id $ApiId `
  --cors-configuration "AllowCredentials=true,AllowHeaders=content-type,x-danzstak-device-id,x-danzstak-device-token,AllowMethods=GET,POST,PATCH,DELETE,OPTIONS,AllowOrigins=https://danzstak.com,https://www.danzstak.com,https://review.danzstak.com,MaxAge=300" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "API CORS configuration failed." }

Write-Host "Configuring API metrics and throttling..."
aws apigatewayv2 update-stage `
  --region $ApiRegion `
  --api-id $ApiId `
  --stage-name '$default' `
  --default-route-settings ThrottlingBurstLimit=40,ThrottlingRateLimit=20,DetailedMetricsEnabled=true | Out-Null
if ($LASTEXITCODE -ne 0) { throw "API throttling and metrics configuration failed." }

Write-Host "Configuring the canonical DanzStak domain redirect..."
$amplifyRulesPath = Join-Path $PSScriptRoot 'infrastructure\amplify-custom-rules.json'
aws amplify update-app `
  --region $ApiRegion `
  --app-id $AmplifyAppId `
  --custom-rules "file://$amplifyRulesPath" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Amplify canonical-domain redirect configuration failed." }

Write-Host "DanzStak production runtime configuration applied."
