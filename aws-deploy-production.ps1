$ErrorActionPreference = "Stop"

$Region = "us-west-1"
$StackName = "DANZSTAK-Call-Signaling"
$Template = Join-Path $PSScriptRoot "infrastructure\call-signaling\template.yaml"
$EngagementStackName = "DANZSTAK-Engagement"
$EngagementTemplate = Join-Path $PSScriptRoot "infrastructure\engagement\template.yaml"

Write-Host "Verifying AWS identity..."
$identity = aws sts get-caller-identity --region $Region --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "AWS identity verification failed." }
if (-not $identity.Account) { throw "AWS credentials are unavailable." }
Write-Host "Deploying DanzStak account $($identity.Account) in $Region."

Write-Host "Validating the social API template..."
aws cloudformation validate-template --region $Region --template-body "file://$Template" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "CloudFormation validation failed; production was not changed." }
aws cloudformation validate-template --region $Region --template-body "file://$EngagementTemplate" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Engagement CloudFormation validation failed; production was not changed." }

Write-Host "Updating the DanzStak social API..."
aws cloudformation deploy `
  --region $Region `
  --stack-name $StackName `
  --template-file $Template `
  --capabilities CAPABILITY_NAMED_IAM `
  --no-fail-on-empty-changeset
if ($LASTEXITCODE -ne 0) { throw "CloudFormation deployment failed; production configuration steps were not run." }

Write-Host "Updating reactions, comments, notifications, and durable group routes..."
aws cloudformation deploy `
  --region $Region `
  --stack-name $EngagementStackName `
  --template-file $EngagementTemplate `
  --capabilities CAPABILITY_NAMED_IAM `
  --no-fail-on-empty-changeset
if ($LASTEXITCODE -ne 0) { throw "Engagement deployment failed; Lambda code was not changed." }

Write-Host "Deploying the tested Auth API code and least-privilege permissions..."
& (Join-Path $PSScriptRoot "aws-deploy-auth-api.ps1")
if ($LASTEXITCODE -ne 0) { throw "Auth API deployment failed." }

Write-Host "Reapplying production API safeguards..."
& (Join-Path $PSScriptRoot "aws-configure-production.ps1")

Write-Host "Publishing the tested static website release..."
& (Join-Path $PSScriptRoot "aws-publish-site.ps1")

Write-Host "Applying and verifying hosting security response headers..."
& (Join-Path $PSScriptRoot "aws-harden-cloudfront.ps1")

Write-Host "Running post-deployment public security verification..."
& (Join-Path $PSScriptRoot "test-live-security.ps1") -ExpectGroups -ExpectProfileVideo

Write-Host "DanzStak production deployment completed."
