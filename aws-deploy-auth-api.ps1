$ErrorActionPreference = "Stop"

$Region = "us-west-1"
$FunctionName = "DANZSTAK-Auth-API"
$RoleName = "DANZSTAK-Auth-API-role-zjknf4ur"
$Source = Join-Path $PSScriptRoot "infrastructure\auth-api\index.mjs"
$Bundle = Join-Path $env:TEMP "danzstak-auth-api.zip"
$Policy = Join-Path $env:TEMP "danzstak-auth-api-policy.json"
$Environment = Join-Path $env:TEMP "danzstak-auth-api-environment.json"

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
        Action = @("dynamodb:BatchGetItem", "dynamodb:GetItem")
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
        Action = @("dynamodb:GetItem", "dynamodb:UpdateItem")
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
  Remove-Item -LiteralPath $Environment -Force -ErrorAction SilentlyContinue
}
