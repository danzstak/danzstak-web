$ErrorActionPreference = "Stop"

$Region = "us-west-1"
$StackName = "danzstak-call-signaling"
$Template = Join-Path $PSScriptRoot "infrastructure\call-signaling\template.yaml"

Write-Host "Verifying AWS identity..."
$identity = aws sts get-caller-identity --region $Region --output json | ConvertFrom-Json
if (-not $identity.Account) { throw "AWS credentials are unavailable." }
Write-Host "Deploying DanzStak account $($identity.Account) in $Region."

Write-Host "Validating the social API template..."
aws cloudformation validate-template --region $Region --template-body "file://$Template" | Out-Null

Write-Host "Updating the DanzStak social API..."
aws cloudformation deploy `
  --region $Region `
  --stack-name $StackName `
  --template-file $Template `
  --capabilities CAPABILITY_NAMED_IAM `
  --no-fail-on-empty-changeset

Write-Host "Reapplying production API safeguards..."
& (Join-Path $PSScriptRoot "aws-configure-production.ps1")

Write-Host "Applying CloudFront security response headers..."
& (Join-Path $PSScriptRoot "aws-harden-cloudfront.ps1")

Write-Host "DanzStak production deployment completed."
