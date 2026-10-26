param([string]$Region = 'us-west-1')
$ErrorActionPreference = 'Stop'
$recoveryAccount = aws sts get-caller-identity --region $Region --query Account --output text
if ($LASTEXITCODE -ne 0 -or $recoveryAccount -ne '635288116224') { throw 'DanzStak recovery settings require the configured production account.' }
# Other durable tables are protected by their CloudFormation templates.
$recoveryTable = 'DANZSTAK-Posts'
$recoveryStatus = aws dynamodb describe-continuous-backups --region $Region --table-name $recoveryTable --query ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus --output text
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect post recovery settings.' }
if ($recoveryStatus -ne 'ENABLED') {
  aws dynamodb update-continuous-backups --region $Region --table-name $recoveryTable --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true --output json | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Post point-in-time recovery could not be enabled.' }
}
$recoveryStatus = aws dynamodb describe-continuous-backups --region $Region --table-name $recoveryTable --query ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus --output text
if ($LASTEXITCODE -ne 0 -or $recoveryStatus -ne 'ENABLED') { throw 'Post recovery protection has not reached ENABLED.' }
Write-Host 'Post point-in-time recovery is enabled. Existing data was not restored or replaced.'
