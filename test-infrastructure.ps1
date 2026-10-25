$ErrorActionPreference = 'Stop'

$templatePath = Join-Path $PSScriptRoot 'infrastructure\call-signaling\template.yaml'
$template = Get-Content -LiteralPath $templatePath -Raw -Encoding utf8
$templateBytes = [Text.Encoding]::UTF8.GetByteCount($template)
if ($templateBytes -gt 51200) {
  throw "CloudFormation template is $templateBytes bytes; inline validation accepts at most 51200 bytes."
}

$lines = Get-Content -LiteralPath $templatePath -Encoding utf8
$zipLine = $lines | Select-String '^        ZipFile: \|$' | Select-Object -First 1
if (-not $zipLine) { throw 'Embedded Lambda ZipFile block was not found.' }

$codeLines = [System.Collections.Generic.List[string]]::new()
for ($index = $zipLine.LineNumber; $index -lt $lines.Count; $index++) {
  $line = $lines[$index]
  if ($line -notmatch '^          ') { break }
  $codeLines.Add($line.Substring(10))
}
if ($codeLines.Count -eq 0) { throw 'Embedded Lambda ZipFile block is empty.' }

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw 'Node.js is required for the embedded Lambda syntax check.' }
$codeLines -join "`n" | & $node.Source --check -
if ($LASTEXITCODE -ne 0) { throw 'Embedded Lambda JavaScript syntax check failed.' }

$requiredMessagingProtections = @(
  "hiddenBefore = :deleted",
  ".filter(x=>x.createdAt.S>hiddenBefore)",
  ".filter(x=>x.preview?.S)",
  "conversationUpdate(recipient,user.email,1)"
)
foreach ($protection in $requiredMessagingProtections) {
  if (-not $template.Contains($protection)) {
    throw "Messaging privacy protection is missing: $protection"
  }
}

$requiredUnreadMessaging = @(
  "conversationUpdate(user.email,recipient,0)",
  "UpdateExpression:'SET unread = :n'",
  "event.queryStringParameters?.read==='1'",
  "unread:Number(x.unread?.N||0)",
  "type:'message'"
)
foreach ($protection in $requiredUnreadMessaging) {
  if (-not $template.Contains($protection)) {
    throw "Unread-message behavior is missing: $protection"
  }
}

$requiredReelProtections = @(
  "body.action==='reel'",
  "url.protocol!=='https:'",
  "x.kind?.S==='reel'",
  "isOwner:x.userEmail.S===user.email"
)
foreach ($protection in $requiredReelProtections) {
  if (-not $template.Contains($protection)) {
    throw "Reel persistence protection is missing: $protection"
  }
}

$requiredStoryDeletionProtections = @(
  "dedicated:{BOOL:body.dedicatedMedia===true}",
  "const mediaKey=found.Item.mediaKey?.S",
  "mediaKey&&found.Item.dedicated?.BOOL",
  'mediaKey.startsWith(`users/${ownerPrefix(user)}/`)',
  "new DeleteObjectCommand({Bucket:process.env.MEDIA_BUCKET,Key:mediaKey})"
)
foreach ($protection in $requiredStoryDeletionProtections) {
  if (-not $template.Contains($protection)) {
    throw "Story media deletion protection is missing: $protection"
  }
}

$profileUpdate = [regex]::Match($template, 'async function updateProfile[\s\S]*?async function notifications').Value
if (-not $profileUpdate.Contains('oldMedia.push(old)') -or
    -not $profileUpdate.Contains('await Promise.all(oldMedia.map') -or
    $profileUpdate.IndexOf('await Promise.all(oldMedia.map') -lt $profileUpdate.IndexOf('new UpdateItemCommand')) {
  throw 'Profile media must be replaced in DynamoDB before the old S3 objects are deleted.'
}

$requiredDataPermissions = @(
  'Action: [dynamodb:PutItem, dynamodb:Query, dynamodb:Scan, dynamodb:DeleteItem]',
  'Action: [dynamodb:PutItem, dynamodb:UpdateItem, dynamodb:Query, dynamodb:DeleteItem]',
  'Action: [dynamodb:GetItem, dynamodb:PutItem, dynamodb:UpdateItem]'
)
foreach ($permission in $requiredDataPermissions) {
  if (-not $template.Contains($permission)) {
    throw "Required DynamoDB permission is missing: $permission"
  }
}

if (-not $template.Contains("body.action==='list')return json(200,{groupIds:[...await groupIds(user.email)]})")) {
  throw 'Cross-device group membership loading is missing.'
}
if (-not $template.Contains("hiddenPosts?.SS||[]") -or -not $template.Contains("key.endsWith(' /settings/posts')")) {
  throw 'Cross-device archived/hidden post settings are missing.'
}

foreach ($scriptName in @('aws-deploy-production.ps1', 'aws-configure-production.ps1', 'aws-harden-cloudfront.ps1')) {
  $scriptText = Get-Content -LiteralPath (Join-Path $PSScriptRoot $scriptName) -Raw -Encoding utf8
  if (-not $scriptText.Contains('$LASTEXITCODE -ne 0')) {
    throw "$scriptName does not stop after a failed AWS CLI command."
  }
}

$cloudFrontScript = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'aws-harden-cloudfront.ps1') -Raw -Encoding utf8
foreach ($requiredCacheControl in @(
  '$CachePolicyName = "DanzStak-Frequent-Revalidation"',
  'MaxTTL = 300',
  'MinTTL = 0',
  'create-invalidation --distribution-id $distributionId --paths "/*"'
)) {
  if (-not $cloudFrontScript.Contains($requiredCacheControl)) {
    Add-Failure "CloudFront deployment is missing bounded cache control: $requiredCacheControl"
  }
}

Write-Host "Infrastructure checks passed ($templateBytes-byte template; embedded Lambda syntax valid)."
