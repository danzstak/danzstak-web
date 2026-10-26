param([string]$Region = 'us-west-1')
$ErrorActionPreference = 'Stop'
$recoveryAccount = aws sts get-caller-identity --region $Region --query Account --output text
if ($LASTEXITCODE -ne 0 -or $recoveryAccount -ne '635288116224') { throw 'Recovery checks require the configured DanzStak production account.' }
$recoveryTables = @('DANZSTAK-Posts')
foreach ($recoveryStack in @('DANZSTAK-Call-Signaling','DANZSTAK-Engagement')) {
  $recoveryResources = aws cloudformation list-stack-resources --region $Region --stack-name $recoveryStack --query "StackResourceSummaries[?ResourceType=='AWS::DynamoDB::Table'].PhysicalResourceId" --output json | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "Could not list tables for $recoveryStack" }
  $recoveryTables += $recoveryResources | Where-Object { $_ -notin @('DANZSTAK-CallSignals','DANZSTAK-Presence') }
}
$recoveryTables = @($recoveryTables | Sort-Object -Unique)
foreach ($recoveryTable in $recoveryTables) {
  $recoveryState = aws dynamodb describe-continuous-backups --region $Region --table-name $recoveryTable --query ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus --output text
  if ($LASTEXITCODE -ne 0 -or $recoveryState -ne 'ENABLED') { throw "$recoveryTable point-in-time recovery is not enabled." }
}
Write-Host "Live data recovery checks passed ($($recoveryTables.Count) durable tables protected). No restore or data write was performed."
