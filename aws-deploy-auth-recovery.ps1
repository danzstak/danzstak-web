param(
  [switch]$ConfirmProduction
)

$ErrorActionPreference = "Stop"

$Region = "us-west-1"
$FunctionName = "DANZSTAK-Auth-API"
$ApiId = "0872gqal4m"
$SourceRoot = Join-Path $PSScriptRoot "infrastructure\auth-api"
$SourceFiles = @(
  "index.mjs",
  "tour-manager-billing.mjs",
  "marketplace.mjs",
  "ticketing.mjs",
  "package.json",
  "package-lock.json"
)
$RunId = [guid]::NewGuid().ToString("N")
$Stage = Join-Path ([IO.Path]::GetTempPath()) ("danzstak-auth-recovery-" + $RunId)
$Bundle = Join-Path ([IO.Path]::GetTempPath()) ("danzstak-auth-recovery-" + $RunId + ".zip")
$RollbackBundle = Join-Path ([IO.Path]::GetTempPath()) ("danzstak-auth-recovery-rollback-" + $RunId + ".zip")

function Invoke-AwsJson {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)

  $output = & aws @Arguments 2>$null
  if ($LASTEXITCODE -ne 0) {
    throw "AWS command failed: aws $($Arguments -join ' ')"
  }
  if ([string]::IsNullOrWhiteSpace([string]$output)) {
    throw "AWS command returned no result: aws $($Arguments -join ' ')"
  }
  return ($output | ConvertFrom-Json)
}

function Remove-TemporaryPath {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [switch]$Recurse
  )

  if (-not (Test-Path -LiteralPath $Path)) { return }
  $fullPath = [IO.Path]::GetFullPath($Path)
  $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if (-not $fullPath.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove a path outside the temporary directory: $fullPath"
  }
  Remove-Item -LiteralPath $fullPath -Force -Recurse:$Recurse
}

function Get-RedirectLocation {
  param([Parameter(Mandatory = $true)][string]$Uri)

  Add-Type -AssemblyName System.Net.Http
  $handler = [Net.Http.HttpClientHandler]::new()
  $handler.AllowAutoRedirect = $false
  $client = [Net.Http.HttpClient]::new($handler)
  try {
    $statusCode = 0
    foreach ($attempt in 1..12) {
      $response = $null
      try {
        $response = $client.GetAsync($Uri).GetAwaiter().GetResult()
        $statusCode = [int]$response.StatusCode
        if ($statusCode -ge 300 -and $statusCode -lt 400 -and $response.Headers.Location) {
          return [string]$response.Headers.Location
        }
      } finally {
        if ($response) { $response.Dispose() }
      }
      if ($attempt -lt 12) { Start-Sleep -Seconds 5 }
    }
    throw "$Uri returned HTTP $statusCode instead of a redirect after route propagation retries."
  } finally {
    $client.Dispose()
    $handler.Dispose()
  }
}

$codeUpdated = $false
$createdResetPermission = $false
$createdResetRouteId = ""
$changedResetRouteId = ""
$previousResetTarget = ""
$resetPermissionSid = "AllowAuthResetPasswordFromApiGateway"

try {
  $identity = Invoke-AwsJson @("sts", "get-caller-identity", "--region", $Region, "--output", "json")
  if ([string]::IsNullOrWhiteSpace([string]$identity.Account)) {
    throw "AWS identity could not be verified. No production resources were changed."
  }

  foreach ($file in $SourceFiles) {
    $sourcePath = Join-Path $SourceRoot $file
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
      throw "Auth API release input is missing: $sourcePath"
    }
  }

  foreach ($module in @("index.mjs", "tour-manager-billing.mjs", "marketplace.mjs", "ticketing.mjs")) {
    & node --check (Join-Path $SourceRoot $module)
    if ($LASTEXITCODE -ne 0) { throw "JavaScript validation failed for $module." }
  }

  $function = Invoke-AwsJson @("lambda", "get-function", "--region", $Region, "--function-name", $FunctionName, "--output", "json")
  $functionArn = [string]$function.Configuration.FunctionArn
  if ($functionArn -ne "arn:aws:lambda:${Region}:$($identity.Account):function:${FunctionName}") {
    throw "The resolved Lambda does not match the authenticated DanzStak account."
  }
  $resetSourceArn = "arn:aws:execute-api:${Region}:$($identity.Account):${ApiId}/*/GET/auth/reset-password"
  $policyResult = Invoke-AwsJson @("lambda", "get-policy", "--region", $Region, "--function-name", $FunctionName, "--output", "json")
  $policy = ([string]$policyResult.Policy | ConvertFrom-Json)
  $resetPermission = $policy.Statement | Where-Object { $_.Sid -eq $resetPermissionSid } | Select-Object -First 1
  if ($resetPermission) {
    $permissionSourceArn = [string]$resetPermission.Condition.ArnLike.PSObject.Properties["AWS:SourceArn"].Value
    if ($resetPermission.Principal.Service -ne "apigateway.amazonaws.com" -or $permissionSourceArn -ne $resetSourceArn) {
      throw "The existing password-recovery invoke permission is not scoped to the expected API route."
    }
  }

  $routes = Invoke-AwsJson @("apigatewayv2", "get-routes", "--region", $Region, "--api-id", $ApiId, "--output", "json")
  $loginRoute = $routes.Items | Where-Object { $_.RouteKey -eq "GET /auth/login" } | Select-Object -First 1
  if (-not $loginRoute -or [string]$loginRoute.Target -notmatch '^integrations/(.+)$') {
    throw "The deployed login route does not expose a reusable Auth API integration."
  }
  $authIntegrationId = $Matches[1]
  $authTarget = "integrations/$authIntegrationId"
  $integration = Invoke-AwsJson @("apigatewayv2", "get-integration", "--region", $Region, "--api-id", $ApiId, "--integration-id", $authIntegrationId, "--output", "json")
  if ([string]$integration.IntegrationUri -ne $functionArn) {
    throw "The deployed login route does not target $FunctionName."
  }

  $resetRoute = $routes.Items | Where-Object { $_.RouteKey -eq "GET /auth/reset-password" } | Select-Object -First 1

  New-Item -ItemType Directory -Path $Stage -Force | Out-Null
  foreach ($file in $SourceFiles) {
    Copy-Item -LiteralPath (Join-Path $SourceRoot $file) -Destination $Stage
  }
  Push-Location $Stage
  try {
    & npm ci --omit=dev --ignore-scripts --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "Auth API dependency installation failed." }
  } finally {
    Pop-Location
  }
  & tar.exe -a -c -f $Bundle -C $Stage .
  if ($LASTEXITCODE -ne 0) { throw "Auth API bundle creation failed." }
  $bundleHash = (Get-FileHash -LiteralPath $Bundle -Algorithm SHA256).Hash.ToLowerInvariant()

  if (-not $ConfirmProduction) {
    Write-Host "Auth recovery release preflight passed."
    Write-Host "Function: $FunctionName"
    Write-Host "Login integration: $authIntegrationId"
    Write-Host "Reset route: $(if ($resetRoute) { 'present' } else { 'missing; will be created' })"
    Write-Host "Reset invoke permission: $(if ($resetPermission) { 'present' } else { 'missing; will be created' })"
    Write-Host "Bundle SHA-256: $bundleHash"
    Write-Host "No AWS resources were changed. Rerun with -ConfirmProduction only after the owner gives GO."
    return
  }

  Invoke-WebRequest -Uri ([string]$function.Code.Location) -OutFile $RollbackBundle -UseBasicParsing
  if (-not (Test-Path -LiteralPath $RollbackBundle -PathType Leaf)) {
    throw "The rollback bundle could not be downloaded."
  }

  & aws lambda update-function-code --region $Region --function-name $FunctionName --zip-file "fileb://$Bundle" --output json | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Auth API code deployment failed." }
  $codeUpdated = $true
  & aws lambda wait function-updated --region $Region --function-name $FunctionName
  if ($LASTEXITCODE -ne 0) { throw "Auth API code deployment did not finish." }

  if (-not $resetPermission) {
    & aws lambda add-permission --region $Region --function-name $FunctionName --statement-id $resetPermissionSid --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn $resetSourceArn --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Password recovery invoke permission creation failed." }
    $createdResetPermission = $true
  }

  if (-not $resetRoute) {
    $created = Invoke-AwsJson @("apigatewayv2", "create-route", "--region", $Region, "--api-id", $ApiId, "--route-key", "GET /auth/reset-password", "--target", $authTarget, "--output", "json")
    $createdResetRouteId = [string]$created.RouteId
  } elseif ([string]$resetRoute.Target -ne $authTarget) {
    $changedResetRouteId = [string]$resetRoute.RouteId
    $previousResetTarget = [string]$resetRoute.Target
    & aws apigatewayv2 update-route --region $Region --api-id $ApiId --route-id $changedResetRouteId --target $authTarget --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Password recovery route update failed." }
  }

  $loginLocation = Get-RedirectLocation "https://api.danzstak.com/auth/login"
  if ($loginLocation -notmatch 'prompt=login') {
    throw "The deployed login route did not require a fresh credential prompt."
  }
  $resetLocation = Get-RedirectLocation "https://api.danzstak.com/auth/reset-password"
  if ($resetLocation -notmatch '/forgotPassword') {
    throw "The deployed password recovery route did not reach Cognito recovery."
  }

  Write-Host "Auth recovery deployment passed."
  Write-Host "Function: $FunctionName"
  Write-Host "Reset route: GET /auth/reset-password"
  Write-Host "Bundle SHA-256: $bundleHash"
} catch {
  $deploymentError = $_
  if ($ConfirmProduction) {
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
      if ($createdResetRouteId) {
        & aws apigatewayv2 delete-route --region $Region --api-id $ApiId --route-id $createdResetRouteId | Out-Null
      } elseif ($changedResetRouteId -and $previousResetTarget) {
        & aws apigatewayv2 update-route --region $Region --api-id $ApiId --route-id $changedResetRouteId --target $previousResetTarget --output json | Out-Null
      }
      if ($createdResetPermission) {
        & aws lambda remove-permission --region $Region --function-name $FunctionName --statement-id $resetPermissionSid | Out-Null
      }
      if ($codeUpdated -and (Test-Path -LiteralPath $RollbackBundle -PathType Leaf)) {
        & aws lambda update-function-code --region $Region --function-name $FunctionName --zip-file "fileb://$RollbackBundle" --output json | Out-Null
        & aws lambda wait function-updated --region $Region --function-name $FunctionName
      }
    } finally {
      $ErrorActionPreference = $previousPreference
    }
  }
  throw $deploymentError
} finally {
  Remove-TemporaryPath -Path $Stage -Recurse
  Remove-TemporaryPath -Path $Bundle
  Remove-TemporaryPath -Path $RollbackBundle
}
