$ErrorActionPreference = "Stop"

$Region = "us-west-1"
$FunctionName = "DANZSTAK-Auth-API"
$RoleName = "DANZSTAK-Auth-API-role-zjknf4ur"
$Source = Join-Path $PSScriptRoot "infrastructure\auth-api\index.mjs"
$Package = Join-Path $PSScriptRoot "infrastructure\auth-api\package.json"
$Bundle = Join-Path $env:TEMP "danzstak-auth-api.zip"
$Stage = Join-Path $env:TEMP ("danzstak-auth-api-" + [guid]::NewGuid().ToString("N"))
$Policy = Join-Path $env:TEMP "danzstak-auth-api-policy.json"
$Environment = Join-Path $env:TEMP "danzstak-auth-api-environment.json"
$ApiId = "0872gqal4m"
$AuthIntegrationId = "5pipi5a"
$ToursTable = "DANZSTAK-Tours"

node --check $Source
if ($LASTEXITCODE -ne 0) { throw "Auth API JavaScript validation failed." }

try {
  aws dynamodb describe-table --region $Region --table-name $ToursTable --output json 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    aws dynamodb create-table --region $Region --table-name $ToursTable --billing-mode PAY_PER_REQUEST --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=tourId,AttributeType=S --key-schema AttributeName=userId,KeyType=HASH AttributeName=tourId,KeyType=RANGE --tags Key=Application,Value=DanzStak Key=Purpose,Value=TourPlans --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Tour plans table creation failed." }
    aws dynamodb wait table-exists --region $Region --table-name $ToursTable
    if ($LASTEXITCODE -ne 0) { throw "Tour plans table did not become ready." }
  }
  New-Item -ItemType Directory -Path $Stage -Force | Out-Null
  Copy-Item -LiteralPath $Source,$Package -Destination $Stage
  Push-Location $Stage
  try {
    npm install --omit=dev --ignore-scripts --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "Auth API dependency installation failed." }
  } finally { Pop-Location }
  Compress-Archive -Path (Join-Path $Stage "*") -DestinationPath $Bundle -Force

  @{
    Version = "2012-10-17"
    Statement = @(
      @{
        Sid = "PostRecords"
        Effect = "Allow"
        Action = @("dynamodb:Scan", "dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem")
        Resource = "arn:aws:dynamodb:us-west-1:635288116224:table/DANZSTAK-Posts"
      },
      @{
        Sid = "FriendAudienceChecks"
        Effect = "Allow"
        Action = @("dynamodb:BatchGetItem", "dynamodb:GetItem", "dynamodb:ConditionCheckItem")
        Resource = "arn:aws:dynamodb:us-west-1:635288116224:table/DANZSTAK-Friends"
      },
      @{
        Sid = "ResolveAccountEmail"
        Effect = "Allow"
        Action = @("cognito-idp:ListUsers")
        Resource = "arn:aws:cognito-idp:us-east-1:635288116224:userpool/us-east-1_qA4B46ilc"
      },
      @{
        Sid = "DurableGroups"
        Effect = "Allow"
        Action = @("dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem", "dynamodb:Scan")
        Resource = "arn:aws:dynamodb:us-west-1:635288116224:table/DANZSTAK-GroupMembers"
      },
      @{
        Sid = "ProfileVideoSettings"
        Effect = "Allow"
        Action = @("dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:ConditionCheckItem")
        Resource = "arn:aws:dynamodb:us-west-1:635288116224:table/DanzStak-UserSettings"
      },
      @{
        Sid = "DeletePostStoryReferences"
        Effect = "Allow"
        Action = @("dynamodb:Scan", "dynamodb:DeleteItem")
        Resource = "arn:aws:dynamodb:us-west-1:635288116224:table/DANZSTAK-Stories"
      },
      @{
        Sid = "DeleteReplacedProfileVideo"
        Effect = "Allow"
        Action = @("s3:GetObject", "s3:DeleteObject")
        Resource = "arn:aws:s3:::danzstak-call-signaling-mediabucket-*/*"
      },
      @{
        Sid = "SupportTickets"
        Effect = "Allow"
        Action = @("dynamodb:PutItem", "dynamodb:UpdateItem")
        Resource = "arn:aws:dynamodb:us-west-1:635288116224:table/DANZSTAK-SupportTickets"
      },
      @{
        Sid = "SupportMailNotification"
        Effect = "Allow"
        Action = @("ses:SendEmail")
        Resource = "arn:aws:ses:us-west-1:635288116224:identity/danzstak.com"
      },
      @{
        Sid = "TourRoutePlanning"
        Effect = "Allow"
        Action = @("geo-places:Geocode", "geo-places:SearchText", "geo-routes:CalculateRoutes")
        Resource = "*"
      },
      @{
        Sid = "SavedTourPlans"
        Effect = "Allow"
        Action = @("dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:Query", "dynamodb:DeleteItem")
        Resource = "arn:aws:dynamodb:us-west-1:635288116224:table/DANZSTAK-Tours"
      }
    )
  } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $Policy -Encoding ascii

  aws iam put-role-policy `
    --region $Region `
    --role-name $RoleName `
    --policy-name DanzStakPostAuthorization `
    --policy-document "file://$Policy"
  if ($LASTEXITCODE -ne 0) { throw "Auth API authorization policy update failed." }

  $mediaBucket = aws cloudformation describe-stack-resource --region $Region --stack-name DANZSTAK-Call-Signaling --logical-resource-id MediaBucket --query 'StackResourceDetail.PhysicalResourceId' --output text
  if ($LASTEXITCODE -ne 0 -or -not $mediaBucket) { throw "DanzStak media bucket could not be resolved." }
  $current = aws lambda get-function-configuration --region $Region --function-name $FunctionName --output json | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "Auth API configuration could not be read." }
  $variables = @{}
  foreach ($property in $current.Environment.Variables.PSObject.Properties) { $variables[$property.Name] = [string]$property.Value }
  $variables.MEDIA_BUCKET = [string]$mediaBucket
  $postViewsTable = aws cloudformation describe-stacks --region $Region --stack-name DANZSTAK-Engagement --query "Stacks[0].Outputs[?OutputKey=='PostViewsTableName'].OutputValue | [0]" --output text
  if ($LASTEXITCODE -ne 0) { throw "Post view configuration could not be resolved." }
  if ($postViewsTable -and $postViewsTable -ne 'None') { $variables.POST_VIEWS_TABLE = [string]$postViewsTable }
  @{ Variables = $variables } | ConvertTo-Json -Depth 6 -Compress | Set-Content -LiteralPath $Environment -Encoding ascii
  aws lambda update-function-configuration --region $Region --function-name $FunctionName --environment "file://$Environment" --output json | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Auth API media configuration failed." }
  aws lambda wait function-updated --region $Region --function-name $FunctionName
  if ($LASTEXITCODE -ne 0) { throw "Auth API media configuration did not finish updating." }

  aws lambda update-function-configuration --region $Region --function-name $FunctionName --timeout 30 --memory-size 256 --output json | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Auth API route-planning runtime configuration failed." }
  aws lambda wait function-updated --region $Region --function-name $FunctionName
  if ($LASTEXITCODE -ne 0) { throw "Auth API route-planning runtime configuration did not finish updating." }

  aws lambda update-function-code `
    --region $Region `
    --function-name $FunctionName `
    --zip-file "fileb://$Bundle" `
    --output json | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Auth API code deployment failed." }

  aws lambda wait function-updated --region $Region --function-name $FunctionName
  if ($LASTEXITCODE -ne 0) { throw "Auth API did not finish updating." }

  $configuration = aws lambda get-function-configuration `
    --region $Region `
    --function-name $FunctionName `
    --output json | ConvertFrom-Json
  if ($configuration.LastUpdateStatus -ne "Successful") {
    throw "Auth API deployment status is $($configuration.LastUpdateStatus)."
  }

  $routes = aws apigatewayv2 get-routes --region $Region --api-id $ApiId --output json | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "Tour route API could not be inspected." }
  $routeId = ($routes.Items | Where-Object { $_.RouteKey -eq "POST /tour/route" } | Select-Object -First 1).RouteId
  if ([string]::IsNullOrWhiteSpace([string]$routeId)) {
    aws apigatewayv2 create-route --region $Region --api-id $ApiId --route-key "POST /tour/route" --target "integrations/$AuthIntegrationId" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Tour route API creation failed." }
  }
  foreach ($routeKey in @("POST /tour/manual-venue", "GET /booking-pipeline", "POST /booking-pipeline", "GET /tours", "POST /tours", "DELETE /tours/{tourId}", "GET /auth/mobile-login", "POST /auth/mobile-session", "POST /groups/{groupId}/everyone")) {
    $existing = ($routes.Items | Where-Object { $_.RouteKey -eq $routeKey } | Select-Object -First 1).RouteId
    if ([string]::IsNullOrWhiteSpace([string]$existing)) {
      aws apigatewayv2 create-route --region $Region --api-id $ApiId --route-key $routeKey --target "integrations/$AuthIntegrationId" --output json | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "Tour plans API route $routeKey creation failed." }
    }
  }
  $permission = aws lambda get-policy --region $Region --function-name $FunctionName --query Policy --output text
  if ($LASTEXITCODE -ne 0) { throw "Auth API invoke permissions could not be inspected." }
  if ($permission -notmatch "AllowTourRouteFromApiGateway") {
    aws lambda add-permission --region $Region --function-name $FunctionName --statement-id AllowTourRouteFromApiGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:635288116224:${ApiId}/*/POST/tour/route" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Tour route API invoke permission failed." }
  }
  if ($permission -notmatch "AllowManualVenueFromApiGateway") {
    aws lambda add-permission --region $Region --function-name $FunctionName --statement-id AllowManualVenueFromApiGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:635288116224:${ApiId}/*/POST/tour/manual-venue" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Manual venue API invoke permission failed." }
  }
  if ($permission -notmatch "AllowTourPlansFromApiGateway") {
    aws lambda add-permission --region $Region --function-name $FunctionName --statement-id AllowTourPlansFromApiGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:635288116224:${ApiId}/*/*/tours*" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Tour plans API invoke permission failed." }
  }
  if ($permission -notmatch "AllowBookingPipelineFromApiGateway") {
    aws lambda add-permission --region $Region --function-name $FunctionName --statement-id AllowBookingPipelineFromApiGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:635288116224:${ApiId}/*/*/booking-pipeline" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Booking pipeline API invoke permission failed." }
  }
  if ($permission -notmatch "AllowNativeAuthFromApiGateway") {
    aws lambda add-permission --region $Region --function-name $FunctionName --statement-id AllowNativeAuthFromApiGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:635288116224:${ApiId}/*/*/auth/mobile-*" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Native authentication API invoke permission failed." }
  }
  Write-Host "DanzStak Auth API authorization safeguards deployed successfully."
} finally {
  Remove-Item -LiteralPath $Bundle -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $Policy -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $Environment -Force -ErrorAction SilentlyContinue
  $resolvedStage = [IO.Path]::GetFullPath($Stage)
  $resolvedTemp = [IO.Path]::GetFullPath($env:TEMP).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  if ($resolvedStage.StartsWith($resolvedTemp, [StringComparison]::OrdinalIgnoreCase)) {
    Remove-Item -LiteralPath $resolvedStage -Recurse -Force -ErrorAction SilentlyContinue
  }
}
