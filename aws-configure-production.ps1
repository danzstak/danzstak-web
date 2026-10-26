$ErrorActionPreference = "Stop"

$ApiRegion = "us-west-1"
$ApiId = "0872gqal4m"
$AmplifyAppId = "d31oovi2mos5iz"
$UserPoolRegion = "us-east-1"
$UserPoolId = "us-east-1_qA4B46ilc"

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
  --cors-configuration "AllowCredentials=true,AllowHeaders=content-type,AllowMethods=GET,POST,PATCH,DELETE,OPTIONS,AllowOrigins=https://danzstak.com,https://www.danzstak.com,MaxAge=300" | Out-Null
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
