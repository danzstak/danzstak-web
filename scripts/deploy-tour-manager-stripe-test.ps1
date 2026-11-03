$ErrorActionPreference = "Stop"

$region = "us-west-1"
$apiId = "0872gqal4m"
$functionName = "DANZSTAK-TourManager-Stripe-Test"
$stage = Join-Path $env:TEMP ("danzstak-tour-manager-stripe-" + [guid]::NewGuid().ToString("N"))
$bundle = Join-Path $env:TEMP "danzstak-tour-manager-stripe-test.zip"
$environmentFile = Join-Path $env:TEMP "danzstak-tour-manager-env.json"
$secretPolicyFile = Join-Path $env:TEMP "danzstak-tour-manager-secret-policy.json"
$dataPolicyFile = Join-Path $env:TEMP "danzstak-tour-manager-data-policy.json"
$resolvedTemp = [IO.Path]::GetFullPath($env:TEMP).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
$resolvedStage = [IO.Path]::GetFullPath($stage)
if (-not $resolvedStage.StartsWith($resolvedTemp, [StringComparison]::OrdinalIgnoreCase)) { throw "Unsafe staging path." }

New-Item -ItemType Directory -Path $stage -Force | Out-Null
try {
  foreach ($secretName in @("danzstak/stripe/secret-key", "danzstak/stripe/webhook-secret")) {
    aws secretsmanager describe-secret --region $region --secret-id $secretName --output json 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Required Stripe secret is missing or unreadable: $secretName. No Lambda changes were made." }
  }
  Copy-Item `
    (Join-Path $PSScriptRoot "..\infrastructure\auth-api\index.mjs"), `
    (Join-Path $PSScriptRoot "..\infrastructure\auth-api\tour-manager-billing.mjs"), `
    (Join-Path $PSScriptRoot "..\infrastructure\auth-api\package.json"), `
    (Join-Path $PSScriptRoot "..\infrastructure\auth-api\package-lock.json") `
    -Destination $stage
  Push-Location $stage
  try {
    npm ci --omit=dev --ignore-scripts --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
  } finally { Pop-Location }
  Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $bundle -Force

  $source = aws lambda get-function-configuration --region $region --function-name DANZSTAK-Auth-API --output json | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "Could not inspect the existing Auth API Lambda." }
  $variables = @{}
  foreach ($property in $source.Environment.Variables.PSObject.Properties) { $variables[$property.Name] = [string]$property.Value }
  $variables.TOURS_TABLE = "DANZSTAK-Tours"
  $variables.TOUR_MANAGER_LIVE_PAYMENTS = "false"
  @{ Variables = $variables } | ConvertTo-Json -Depth 5 -Compress | Set-Content $environmentFile -Encoding ascii

  @{
    Version = "2012-10-17"
    Statement = @(@{
      Sid = "ReadDanzStakStripeSecrets"
      Effect = "Allow"
      Action = @("secretsmanager:GetSecretValue")
      Resource = @(
        "arn:aws:secretsmanager:${region}:635288116224:secret:danzstak/stripe/secret-key-*",
        "arn:aws:secretsmanager:${region}:635288116224:secret:danzstak/stripe/webhook-secret-*"
      )
    })
  } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $secretPolicyFile -Encoding ascii
  aws iam put-role-policy --role-name DANZSTAK-Auth-API-role-zjknf4ur --policy-name DanzStakStripeSecrets --policy-document "file://$secretPolicyFile"
  if ($LASTEXITCODE -ne 0) { throw "The backend role could not be authorized to read the DANZSTAK Stripe secrets." }
  @{
    Version = "2012-10-17"
    Statement = @(@{
      Sid = "UseDanzStakTourManagerLedger"
      Effect = "Allow"
      Action = @("dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query", "dynamodb:TransactWriteItems", "dynamodb:UpdateItem")
      Resource = "arn:aws:dynamodb:${region}:635288116224:table/DANZSTAK-Tours"
    })
  } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $dataPolicyFile -Encoding ascii
  aws iam put-role-policy --role-name DANZSTAK-Auth-API-role-zjknf4ur --policy-name DanzStakTourManagerLedger --policy-document "file://$dataPolicyFile"
  if ($LASTEXITCODE -ne 0) { throw "The backend role could not be authorized to use the DANZSTAK Tour Manager ledger." }

  $previous = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  aws lambda get-function --region $region --function-name $functionName --output json 2>$null | Out-Null
  $exists = $LASTEXITCODE -eq 0
  $ErrorActionPreference = $previous
  if ($exists) {
    aws lambda update-function-configuration --region $region --function-name $functionName --environment "file://$environmentFile" --timeout 30 --memory-size 256 --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Test Lambda configuration update failed." }
    aws lambda wait function-updated-v2 --region $region --function-name $functionName
    aws lambda update-function-code --region $region --function-name $functionName --zip-file "fileb://$bundle" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Test Lambda code update failed." }
    aws lambda wait function-updated-v2 --region $region --function-name $functionName
  } else {
    aws lambda create-function --region $region --function-name $functionName --runtime nodejs20.x --handler index.handler --role $source.Role --zip-file "fileb://$bundle" --timeout 30 --memory-size 256 --environment "file://$environmentFile" --tags "Application=DanzStak,Environment=Test,Purpose=TourManagerStripeWebhook" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Test Lambda creation failed." }
    aws lambda wait function-active-v2 --region $region --function-name $functionName
  }

  $functionArn = aws lambda get-function-configuration --region $region --function-name $functionName --query FunctionArn --output text
  $integrations = aws apigatewayv2 get-integrations --region $region --api-id $apiId --output json | ConvertFrom-Json
  $integration = $integrations.Items | Where-Object { $_.Description -eq "DanzStak Tour Manager Stripe test" } | Select-Object -First 1
  if (-not $integration) {
    $integration = aws apigatewayv2 create-integration --region $region --api-id $apiId --integration-type AWS_PROXY --integration-uri $functionArn --payload-format-version 2.0 --timeout-in-millis 30000 --description "DanzStak Tour Manager Stripe test" --output json | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw "Test API integration creation failed." }
  }
  $routes = aws apigatewayv2 get-routes --region $region --api-id $apiId --output json | ConvertFrom-Json
  foreach ($routeKey in @("POST /tour-manager/stripe/webhook", "POST /tour-manager/checkout", "GET /tour-manager/credits", "GET /tour-manager/outreach", "POST /tour-manager/contact-unlock/checkout", "GET /tour-manager/contact-unlocks", "POST /phone-number/checkout", "GET /phone-number/entitlement", "POST /tour-manager/emails/send")) {
    if (-not ($routes.Items | Where-Object { $_.RouteKey -eq $routeKey })) {
      aws apigatewayv2 create-route --region $region --api-id $apiId --route-key $routeKey --target "integrations/$($integration.IntegrationId)" --output json | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "Test API route creation failed: $routeKey" }
    }
  }
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  $policy = aws lambda get-policy --region $region --function-name $functionName --query Policy --output text 2>$null
  $ErrorActionPreference = $previous
  if (-not ([string]$policy).Contains("AllowTourManagerStripeTestApi")) {
    aws lambda add-permission --region $region --function-name $functionName --statement-id AllowTourManagerStripeTestApi --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${region}:635288116224:${apiId}/*/*/tour-manager/*" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Test API invoke permission failed." }
  }
  Write-Host "Tour Manager Stripe test endpoint: https://api.danzstak.com/tour-manager/stripe/webhook"
} finally {
  if ($resolvedStage.StartsWith($resolvedTemp, [StringComparison]::OrdinalIgnoreCase)) { Remove-Item -LiteralPath $resolvedStage -Recurse -Force -ErrorAction SilentlyContinue }
  foreach ($file in @($bundle, $environmentFile, $secretPolicyFile, $dataPolicyFile)) {
    $resolvedFile = [IO.Path]::GetFullPath($file)
    if ($resolvedFile.StartsWith($resolvedTemp, [StringComparison]::OrdinalIgnoreCase)) { Remove-Item -LiteralPath $resolvedFile -Force -ErrorAction SilentlyContinue }
  }
}
