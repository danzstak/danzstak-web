$ErrorActionPreference = 'Stop'

$authApiPath = Join-Path $PSScriptRoot 'infrastructure\auth-api\index.mjs'
if (-not (Test-Path -LiteralPath $authApiPath)) { throw 'Version-controlled Auth API source is missing.' }
$authApi = Get-Content -LiteralPath $authApiPath -Raw -Encoding utf8
$productionDeploy = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'aws-deploy-production.ps1') -Raw -Encoding utf8
foreach ($releaseStep in @('DANZSTAK-Engagement', 'aws-deploy-auth-api.ps1', '$EngagementTemplate', 'test-live-security.ps1')) {
  if (-not $productionDeploy.Contains($releaseStep)) { throw "Production workflow omits required backend release step: $releaseStep" }
}
foreach ($reelPersistence in @('reel: item.reel?.BOOL === true', 'const reel = mediaType === "video" && data.reel === true', 'reel: { BOOL: true }')) {
  if (-not $authApi.Contains($reelPersistence)) { throw "Auth API does not persist uploaded-video Reel selection: $reelPersistence" }
}
foreach ($groupPersistence in @('async function listGroups(event)', 'async function createGroup(event)', 'async function deleteGroup(event)', 'data.communityStandards !== true', 'Only the group owner can delete it', 'groupId: { S: id }, joinedAt: { S: createdAt }')) {
  if (-not $authApi.Contains($groupPersistence)) { throw "Auth API durable group control is missing: $groupPersistence" }
}
foreach ($profileVideoControl in @('async function getProfileVideo(event)', 'async function setProfileVideo(event)', 'profileVideoKey', 'Invalid profile video', 'DeleteObjectCommand', 'canViewProfileMedia')) {
  if (-not $authApi.Contains($profileVideoControl)) { throw "Auth API durable profile-video control is missing: $profileVideoControl" }
}
$engagementTemplate = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'infrastructure\engagement\template.yaml') -Raw -Encoding utf8
foreach ($groupRoute in @('GET /groups', 'POST /groups', 'DELETE /groups/{groupId}', 'PATCH /secure-posts/{postId}', 'DANZSTAK-GroupMembers')) {
  if (-not $engagementTemplate.Contains($groupRoute)) { throw "Engagement stack durable group route or permission is missing: $groupRoute" }
}
foreach ($profileVideoRoute in @('GET /profile-video', 'POST /profile-video', 'ProfileVideoInvokePermission')) {
  if (-not $engagementTemplate.Contains($profileVideoRoute)) { throw "Engagement stack profile-video route is missing: $profileVideoRoute" }
}
foreach ($required in @('BatchGetItemCommand', 'item.audience?.S === "public"', 'friendEmails.has(item.userEmail?.S)', 'data.originalContentCertified !== true', 'sha256(userId).slice(0, 24)', 'Post media ownership could not be verified', 'function signedMediaUrl(', 'mediaUrl: item.mediaKey?.S ? signedMediaUrl', 'mediaUrl: signedMediaUrl(mediaKey, 3600)', '"strict-transport-security"', '"x-content-type-options"', '"x-frame-options"', 'user: userId && email ? { email } : undefined', 'async function getEngagement(event)', 'async function setReaction(event)', 'async function addComment(event)', 'async function deleteComment(event)', 'async function updateSecurePost(event)', 'commentPolicy === "off"', 'commentPolicy === "friends"', 'async function getEngagementNotifications(event)', 'async function clearEngagementNotifications(event)', 'reactions.Items || []', 'comments.Items || []', 'notices.Items || []', 'const storiesTable = "DANZSTAK-Stories"', 'linkedStories.map')) {
  if (-not $authApi.Contains($required)) { throw "Auth API post authorization safeguard is missing: $required" }
}
$authDeploy = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'aws-deploy-auth-api.ps1') -Raw -Encoding utf8
foreach ($mediaDeploymentControl in @('"s3:GetObject"', '$variables.MEDIA_BUCKET', 'describe-stack-resource', 'DeletePostStoryReferences')) {
  if (-not $authDeploy.Contains($mediaDeploymentControl)) { throw "Auth API protected-media deployment control is missing: $mediaDeploymentControl" }
}
$nodeAuthCheck = & node --check $authApiPath 2>&1
if ($LASTEXITCODE -ne 0) { throw "Auth API JavaScript syntax failed: $nodeAuthCheck" }

$engagementTemplatePath = Join-Path $PSScriptRoot 'infrastructure\engagement\template.yaml'
if (-not (Test-Path -LiteralPath $engagementTemplatePath)) { throw 'Engagement infrastructure template is missing.' }
$engagementTemplate = Get-Content -LiteralPath $engagementTemplatePath -Raw -Encoding utf8
foreach ($required in @('DANZSTAK-Reactions', 'DANZSTAK-Comments', 'DANZSTAK-EngagementNotifications', 'GET /engagement', 'POST /reactions', 'POST /comments', 'DELETE /comments/{commentId}', 'GET /engagement-notifications', 'POST /engagement-notifications/read', 'DeletionPolicy: Retain')) {
  if (-not $engagementTemplate.Contains($required)) { throw "Engagement infrastructure is missing: $required" }
}

$publisherPath = Join-Path $PSScriptRoot 'aws-publish-site.ps1'
if (-not (Test-Path -LiteralPath $publisherPath)) { throw 'Static site publisher is missing.' }
$publisher = Get-Content -LiteralPath $publisherPath -Raw -Encoding utf8
foreach ($required in @('aws cloudfront list-distributions', 'aws s3api head-bucket', 'aws s3 sync', '--delete', 'aws cloudfront create-invalidation', 'aws cloudfront wait invalidation-completed', 'live service worker does not match')) {
  if (-not $publisher.Contains($required)) { throw "Static publisher is missing: $required" }
}

$templatePath = Join-Path $PSScriptRoot 'infrastructure\call-signaling\template.yaml'
$template = Get-Content -LiteralPath $templatePath -Raw -Encoding utf8
foreach ($messageReactionControl in @('DanzStak-MessageReactions', 'MESSAGE_REACTIONS_TABLE', 'async function reactMessage(body,user)', "body.action==='reaction'", 'reactionCounts:byMessage')) {
  if (-not $template.Contains($messageReactionControl)) { throw "Persistent message reactions are missing: $messageReactionControl" }
}
$stableLogicalIds = @('SignalRoute:', 'InboxRoute:', 'AckRoute:', 'PresenceRoute:', 'DirectoryRoute:', 'GetPresenceSettingRoute:', 'SetPresenceSettingRoute:', 'GetPostSettingsRoute:', 'SetPostSettingsRoute:', 'FriendRequestRoute:', 'FriendRespondRoute:', 'GetFriendsRoute:', 'GetProfileRoute:', 'UpdateProfileRoute:', 'NotificationsRoute:', 'SendMessageRoute:', 'GetMessagesRoute:', 'DeleteMessagesRoute:', 'GetConversationsRoute:', 'GroupMembershipRoute:', 'CreateStoryRoute:', 'GetStoriesRoute:', 'DeleteStoryRoute:', 'GetNewsRoute:', 'SettingsInvokePermission:', 'FriendInvokePermission:', 'GetFriendsInvokePermission:')
foreach ($logicalId in $stableLogicalIds) {
  if (-not $template.Contains("  $logicalId")) { throw "Deployed CloudFormation logical ID changed and would replace a live route: $logicalId" }
}
if (-not $template.Contains("body.action==='view'&&mediaKey.startsWith")) {
  throw 'Raw media URL access is not restricted to the authenticated owner.'
}
foreach ($storyAudienceControl in @("audience=['public','friends','private'].includes(body.audience)", "x.audience?.S==='friends'&&friends.has(x.userEmail.S)")) {
  if (-not $template.Contains($storyAudienceControl)) { throw "Story audience enforcement is missing: $storyAudienceControl" }
}
foreach ($copyrightControl in @('body.rightsCertified!==true', 'body.originalContentCertified!==true')) {
  if (-not $template.Contains($copyrightControl)) { throw "Story/Reel copyright attestation enforcement is missing: $copyrightControl" }
}
$templateBytes = [Text.Encoding]::UTF8.GetByteCount($template)
if ($templateBytes -gt 1048576) {
  throw "CloudFormation template is $templateBytes bytes; S3-backed CloudFormation templates accept at most 1 MB."
}
$productionDeploy = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'aws-deploy-production.ps1') -Raw -Encoding utf8
foreach ($s3TemplateControl in @('describe-stack-resource', 'aws s3 cp $Template', 'aws s3 presign', '--template-url $templateUrl', '--s3-bucket $artifactBucket')) {
  if (-not $productionDeploy.Contains($s3TemplateControl)) { throw "Large-template deployment support is missing: $s3TemplateControl" }
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

foreach ($pushCapability in @(
  'DANZSTAK-PushSubscriptions',
  'KeySpec: ECC_NIST_P256',
  'KeyUsage: SIGN_VERIFY',
  'kms:GetPublicKey, kms:Sign',
  'PUSH_SUBSCRIPTIONS_TABLE',
  "key==='GET /push/key'",
  "key==='POST /push/subscribe'",
  "key==='DELETE /push/subscribe'",
  "Content-Encoding':'aes128gcm",
  "signalType==='offer'&&['phone','video'].includes(mode)",
  "notifyCall(recipientEmail,user.email,mode,callId).catch(error=>console.error('Call push failed',error))",
  "notifyMessage(recipient,user.email).catch(error=>console.error('Message push failed',error))",
  "type:'message',title:'New DanzStak message'"
)) {
  if (-not $template.Contains($pushCapability)) { throw "Background push capability is missing: $pushCapability" }
}

if (-not $template.Contains("body.action==='list')return json(200,{groupIds:[...await groupIds(user.email)]})")) {
  throw 'Cross-device group membership loading is missing.'
}
if (-not $template.Contains("hiddenPosts?.SS||[]") -or -not $template.Contains("key.endsWith(' /settings/posts')")) {
  throw 'Cross-device archived/hidden post settings are missing.'
}
if (-not $template.Contains("pinned:'pinnedPosts',saved:'savedPosts',muted:'mutedPosts'") -or
    -not $template.Contains("ExpressionAttributeNames:{'#field':field}") -or
    -not $template.Contains("pinned:item.pinnedPosts?.SS||[]") -or
    -not $template.Contains("saved:item.savedPosts?.SS||[]") -or
    -not $template.Contains("muted:item.mutedPosts?.SS||[]")) {
  throw 'Cross-device pin, save, and notification post settings are missing.'
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
  'create-invalidation --region $Region --distribution-id $distributionId --paths "/*"'
)) {
  if (-not $cloudFrontScript.Contains($requiredCacheControl)) {
    throw "CloudFront deployment is missing bounded cache control: $requiredCacheControl"
  }
}

$amplifyHeaders = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'customHttp.yml') -Raw -Encoding utf8
foreach ($requiredHeader in @(
  'Strict-Transport-Security',
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Referrer-Policy',
  'Permissions-Policy'
)) {
  if (-not $amplifyHeaders.Contains($requiredHeader)) {
    throw "Amplify Hosting security header is missing: $requiredHeader"
  }
}

$publishScript = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'aws-publish-site.ps1') -Raw -Encoding utf8
foreach ($requiredAmplifyCheck in @(
  'aws amplify list-apps',
  'aws amplify list-domain-associations',
  'aws amplify list-jobs',
  '$latest.commitId -eq $localCommit',
  '$latest.status -eq "SUCCEED"'
)) {
  if (-not $publishScript.Contains($requiredAmplifyCheck)) {
    throw "Amplify release verification is missing: $requiredAmplifyCheck"
  }
}
if (-not $publishScript.Contains('aws cloudfront list-distributions --region $Region')) {
  throw 'Static deployment depends on an ambient AWS default region'
}
if (-not $cloudFrontScript.Contains('aws cloudfront list-distributions --region $Region')) {
  throw 'CloudFront hardening depends on an ambient AWS default region'
}

Write-Host "Infrastructure checks passed ($templateBytes-byte template; embedded Lambda syntax valid)."
