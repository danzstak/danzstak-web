$ErrorActionPreference = "Stop"

$Region = "us-west-1"
$FunctionName = "DANZSTAK-Auth-API"
$RoleName = "DANZSTAK-Auth-API-role-zjknf4ur"
$Source = Join-Path $PSScriptRoot "infrastructure\auth-api\index.mjs"
$Bundle = Join-Path $env:TEMP "danzstak-auth-api.zip"
$Policy = Join-Path $env:TEMP "danzstak-auth-api-policy.json"

node --check $Source
if ($LASTEXITCODE -ne 0) { throw "Auth API JavaScript validation failed." }

try {
  Compress-Archive -LiteralPath $Source -DestinationPath $Bundle -Force

  @{
    Version = "2012-10-17"
    Statement = @(
      @{
        Sid = "PostRecords"
        Effect = "Allow"
        Action = @("dynamodb:Scan", "dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:DeleteItem")
        Resource = "arn:aws:dynamodb:us-west-1:635288116224:table/DANZSTAK-Posts"
      },
      @{
        Sid = "FriendAudienceChecks"
        Effect = "Allow"
        Action = @("dynamodb:BatchGetItem")
        Resource = "arn:aws:dynamodb:us-west-1:635288116224:table/DANZSTAK-Friends"
      },
      @{
        Sid = "ResolveAccountEmail"
        Effect = "Allow"
        Action = @("cognito-idp:ListUsers")
        Resource = "arn:aws:cognito-idp:us-east-1:635288116224:userpool/us-east-1_qA4B46ilc"
      }
    )
  } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $Policy -Encoding ascii

  aws iam put-role-policy `
    --region $Region `
    --role-name $RoleName `
    --policy-name DanzStakPostAuthorization `
    --policy-document "file://$Policy"
  if ($LASTEXITCODE -ne 0) { throw "Auth API authorization policy update failed." }

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
  Write-Host "DanzStak Auth API authorization safeguards deployed successfully."
} finally {
  Remove-Item -LiteralPath $Bundle -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $Policy -Force -ErrorAction SilentlyContinue
}
