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
foreach ($groupAuthorizationControl in @('const defaultGroupIds = new Set(', 'async function groupExists(groupId)', 'Key: { userEmail: { S: `GROUP#${groupId}` }, groupId: { S: "META" } }', 'for (const groupId of sharedGroups) if (await groupExists(groupId)) return true')) {
  if (-not $authApi.Contains($groupAuthorizationControl)) { throw "Auth API accepts unverified group authorization: $groupAuthorizationControl" }
}
foreach ($profileVideoControl in @('async function getProfileVideo(event)', 'async function setProfileVideo(event)', 'profileVideoKey', 'Invalid profile video', 'DeleteObjectCommand', 'canViewProfileMedia')) {
  if (-not $authApi.Contains($profileVideoControl)) { throw "Auth API durable profile-video control is missing: $profileVideoControl" }
}
foreach ($legalControl in @('async function acceptLegalTerms(event)', 'async function startSignup(event)', 'type: { S: "legal_pending" }', 'sha256("legal-account:" + user.sub)', 'path === "/auth/legal-acceptance"')) {
  if (-not $authApi.Contains($legalControl)) { throw "Server-enforced signup consent is missing: $legalControl" }
}
foreach ($notificationHistoryControl in @('read: { BOOL: false }', 'unread: item.read?.BOOL !== true', 'new UpdateItemCommand({ TableName: engagementNotificationsTable')) {
  if (-not $authApi.Contains($notificationHistoryControl)) { throw "Persistent notification history is missing: $notificationHistoryControl" }
}
foreach ($notificationReliabilityControl in @('ProjectionExpression: "mutedPosts"', 'mutedPosts?.SS?.includes(post.postId.S)', 'const items = await queryAll({ TableName: engagementNotificationsTable', '.sort((a, b) => b.createdAt.localeCompare(a.createdAt))', '.slice(0, 100)')) {
  if (-not $authApi.Contains($notificationReliabilityControl)) { throw "Notification reliability control is missing: $notificationReliabilityControl" }
}
if ($authApi.Contains('TableName: engagementNotificationsTable, KeyConditionExpression: "userEmail = :u", ExpressionAttributeValues: { ":u": { S: userEmail } }, Limit: 50')) { throw 'Engagement notifications still stop at an arbitrary first page' }
$engagementTemplate = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'infrastructure\engagement\template.yaml') -Raw -Encoding utf8
foreach ($groupRoute in @('GET /groups', 'POST /groups', 'DELETE /groups/{groupId}', 'PATCH /secure-posts/{postId}', 'DANZSTAK-GroupMembers')) {
  if (-not $engagementTemplate.Contains($groupRoute)) { throw "Engagement stack durable group route or permission is missing: $groupRoute" }
}
foreach ($profileVideoRoute in @('GET /profile-video', 'POST /profile-video', 'ProfileVideoInvokePermission')) {
  if (-not $engagementTemplate.Contains($profileVideoRoute)) { throw "Engagement stack profile-video route is missing: $profileVideoRoute" }
}
foreach ($legalRoute in @('POST /auth/legal-acceptance', 'LegalAcceptanceInvokePermission')) {
  if (-not $engagementTemplate.Contains($legalRoute)) { throw "Signup consent route is missing: $legalRoute" }
}
foreach ($required in @('BatchGetItemCommand', 'item.audience?.S === "public"', 'friendEmails.has(item.userEmail?.S)', 'data.originalContentCertified !== true', 'sha256(userEmail).slice(0, 24)', 'sha256(accountEmail).slice(0, 24)', 'Post media ownership could not be verified', 'function signedMediaUrl(', 'mediaUrl: item.mediaKey?.S ? signedMediaUrl', 'mediaUrl: signedMediaUrl(mediaKey, 3600)', '"strict-transport-security"', '"x-content-type-options"', '"x-frame-options"', 'user: userId && email ? { email } : undefined', 'async function getEngagement(event)', 'async function setReaction(event)', 'async function addComment(event)', 'async function deleteComment(event)', 'async function updateSecurePost(event)', 'commentPolicy === "off"', 'commentPolicy === "friends"', 'async function getEngagementNotifications(event)', 'async function clearEngagementNotifications(event)', 'reactions.map', 'comments.map', 'notices.filter', 'const storiesTable = "DANZSTAK-Stories"', 'linkedStories.map')) {
  if (-not $authApi.Contains($required)) { throw "Auth API post authorization safeguard is missing: $required" }
}
foreach ($feedPaginationControl in @('async function scanAll(request, maximumItems = 5000)', 'page.LastEvaluatedKey', 'await scanAll({ TableName: postsTable', 'async function batchGetFriendships(viewerEmail, friendEmails)', 'offset += 100', 'result.UnprocessedKeys?.[friendsTable]?.Keys')) {
  if (-not $authApi.Contains($feedPaginationControl)) { throw "Feed pagination or complete friendship authorization is missing: $feedPaginationControl" }
}
foreach ($completeCleanupControl in @('async function queryAll(request, maximumItems = 5000)', 'const members = await scanAll({ TableName: groupsTable', 'const memberships = await scanAll({', 'queryAll({ TableName: reactionsTable', 'queryAll({ TableName: commentsTable', 'linkedStories = await scanAll({', 'const items = await queryAll({ TableName: engagementNotificationsTable')) {
  if (-not $authApi.Contains($completeCleanupControl)) { throw "Engagement, profile authorization, or deletion cleanup stops at one DynamoDB page: $completeCleanupControl" }
}
foreach ($authoritativeDeleteControl in @('async function runCleanup(tasks, attempts = 3)', 'await Promise.allSettled(batch.map(task => task()))', 'const cleanupPending = await runCleanup(cleanupTasks)', 'JSON.stringify({ deleted: true, cleanupPending })')) {
  if (-not $authApi.Contains($authoritativeDeleteControl)) { throw "Post deletion can reappear or abandon cleanup without retries: $authoritativeDeleteControl" }
}
$postDeletion = [regex]::Match($authApi, 'async function deleteSecurePost[\s\S]*?async function updateSecurePost').Value
if ($postDeletion.IndexOf('TableName: postsTable, Key: { postId: { S: postId } }') -lt 0 -or
    $postDeletion.IndexOf('const cleanupPending = await runCleanup(cleanupTasks)') -lt $postDeletion.LastIndexOf('TableName: postsTable, Key: { postId: { S: postId } }')) {
  throw 'Post deletion must remove the primary database record before dependent media and engagement cleanup.'
}
foreach ($retiredCleanupLimit in @('TableName: groupsTable, FilterExpression: "groupId = :id", ExpressionAttributeValues: { ":id": { S: id } }, ProjectionExpression: "userEmail, groupId", Limit: 500', 'TableName: reactionsTable, KeyConditionExpression: "postId = :p", ExpressionAttributeValues: { ":p": { S: postId } }, Limit: 100')) {
  if ($authApi.Contains($retiredCleanupLimit)) { throw "A deletion or engagement path still uses a partial DynamoDB page: $retiredCleanupLimit" }
}
if ($authApi.Contains('new ScanCommand({ TableName: postsTable, Limit: 100')) {
  throw 'Feed still reads an arbitrary first 100 posts instead of paginating DynamoDB'
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
foreach ($required in @('DANZSTAK-Reactions', 'DANZSTAK-Comments', 'DANZSTAK-EngagementNotifications', 'GET /engagement', 'POST /reactions', 'POST /comments', 'DELETE /comments/{commentId}', 'GET /engagement-notifications', 'POST /engagement-notifications/read', 'DeletionPolicy: Retain', 'dynamodb:UpdateItem')) {
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

if (-not $template.Contains('expiresAt:{N:String(now()+7200)}')) {
  throw 'Presence records do not remain available for the full two-hour signed-in activity window'
}
if ($template.Contains('expiresAt:{N:String(now()+180)}')) {
  throw 'Presence still expires after three minutes when a browser suspends background JavaScript'
}
foreach ($paginationControl in @('async function scanAll(input,maximumItems=5000)', 'async function queryAll(input,maximumItems=5000)', 'page.LastEvaluatedKey', 'scanAll({TableName:process.env.PRESENCE_TABLE', 'queryAll({TableName:process.env.FRIENDS_TABLE', 'scanAll({TableName:process.env.STORIES_TABLE', 'async function groupIds(email){const items=await queryAll')) {
  if (-not $template.Contains($paginationControl)) { throw "Stories, presence, or contact pagination is incomplete: $paginationControl" }
}
foreach ($socialListPagination in @('async function getFriends(user){const items=await queryAll', 'async function notifications(user){const [friends,chats]=await Promise.all([queryAll', 'async function getConversations(user){const items=await queryAll', 'async function mapLimit(items,limit,work)', 'const friends=await mapLimit(items,10', 'const conversations=await mapLimit(items.filter')) {
  if (-not $template.Contains($socialListPagination)) { throw "Friends, Notifications, or saved conversations can stop at one DynamoDB page: $socialListPagination" }
}
if (-not $template.Contains("hiddenBefore = :deleted, unread = :zero") -or -not $template.Contains("':zero':{N:'0'}")) {
  throw 'Deleting a conversation does not clear its unread notification state'
}
foreach ($retiredLimit in @('TableName:process.env.PRESENCE_TABLE,FilterExpression:''expiresAt > :n'',ExpressionAttributeValues:{'':n'':{N:String(now())}},Limit:100', 'TableName:process.env.STORIES_TABLE,FilterExpression:''expiresAt > :n'',ExpressionAttributeValues:{'':n'':{N:String(now())}},Limit:100', 'TableName:process.env.GROUPS_TABLE,Limit:250')) {
  if ($template.Contains($retiredLimit)) { throw "A growing social directory still uses a single DynamoDB page: $retiredLimit" }
}
foreach ($logoutPresenceBehavior in @('const presenceTable = "DANZSTAK-Presence"', 'const userId = await getAuthenticatedUser(event);', 'TableName: presenceTable', 'Presence cleanup failed during logout')) {
  if (-not $authApi.Contains($logoutPresenceBehavior)) { throw "Logout does not authoritatively clear presence: $logoutPresenceBehavior" }
}
if (-not $engagementTemplate.Contains('Resource: arn:aws:dynamodb:us-west-1:635288116224:table/DANZSTAK-Presence')) { throw 'Auth API lacks permission to clear presence during logout' }
if (-not $engagementTemplate.Contains('Resource: arn:aws:dynamodb:us-west-1:635288116224:table/DanzStak-UserSettings')) { throw 'Auth API lacks permission to enforce muted post notifications' }
if (-not $template.Contains("body.action==='view'&&mediaKey.startsWith")) {
  throw 'Raw media URL access is not restricted to the authenticated owner.'
}
foreach ($storyAudienceControl in @("audience=['public','friends','private'].includes(body.audience)", "x.audience?.S==='friends'&&friends.has(x.userEmail.S)")) {
  if (-not $template.Contains($storyAudienceControl)) { throw "Story audience enforcement is missing: $storyAudienceControl" }
}
$storyDeletion = [regex]::Match($template, 'async function deleteStory[\s\S]*?async function refreshSession').Value
if ($storyDeletion.IndexOf('new DeleteItemCommand({TableName:process.env.STORIES_TABLE') -lt 0 -or
    $storyDeletion.IndexOf('for(let attempt=0;attempt<3;attempt++)') -lt $storyDeletion.IndexOf('new DeleteItemCommand({TableName:process.env.STORIES_TABLE')) {
  throw 'Story deletion must remove the database record before retrying dedicated-media cleanup.'
}
foreach ($accountPreferenceControl in @('darkMode = :d', 'reduceMotion = :r', 'dataSaver = :s', "body.language!=='en'")) {
  if (-not $template.Contains($accountPreferenceControl)) { throw "Account settings persistence is missing: $accountPreferenceControl" }
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

foreach ($messageHistoryControl in @(
  "event.queryStringParameters?.before",
  "Valid message cursor required",
  "ExclusiveStartKey:{conversationId:{S:id},messageId:{S:before}}",
  "nextCursor=page.LastEvaluatedKey",
  "return json(200,{messages,nextCursor})"
)) {
  if (-not $template.Contains($messageHistoryControl)) {
    throw "Saved message history pagination is missing: $messageHistoryControl"
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
  'Action: [dynamodb:GetItem, dynamodb:PutItem, dynamodb:Query, dynamodb:Scan, dynamodb:DeleteItem]',
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
if (-not $template.Contains("FilterExpression:'expiresAt > :n'") -or -not $template.Contains("':n':{N:String(now())}")) {
  throw 'Call inbox can return expired signaling records before DynamoDB TTL cleanup.'
}
foreach ($callInboxControl in @('async function inbox(user){const items=await queryAll', 'ScanIndexForward:true,ConsistentRead:true},20)', 'return json(200,{events:items.map')) {
  if (-not $template.Contains($callInboxControl)) { throw "Call inbox can lose live events behind expired TTL records: $callInboxControl" }
}
if ($template.Contains("FilterExpression:'expiresAt > :n',ExpressionAttributeValues:{':r':{S:user.email},':n':{N:String(now())}},Limit:20")) {
  throw 'Call inbox still applies DynamoDB Limit before filtering expired events.'
}
foreach ($orphanMediaControl in @("body.action==='discard'", 'requestedMediaKey.startsWith(`users/${ownerPrefix(user)}/`)', "return json(200,{discarded:true})")) {
  if (-not $template.Contains($orphanMediaControl)) { throw "Failed uploads cannot be securely discarded: $orphanMediaControl" }
}

if (-not $template.Contains("if(body.action==='list'){")) {
  throw 'Cross-device group membership loading is missing.'
}
foreach ($groupAuthorizationControl in @(
  "const defaultGroupIds=new Set(",
  'async function groupExists(groupId)',
  'async function sharesValidGroup(a,b)',
  "if(!(await groupExists(groupId)))return json(404,{error:'Group not found'})",
  'sharedGroup:await sharesValidGroup(myGroups,theirs)',
  'Action: [dynamodb:GetItem, dynamodb:PutItem, dynamodb:Query, dynamodb:Scan, dynamodb:DeleteItem]'
)) {
  if (-not $template.Contains($groupAuthorizationControl)) { throw "Messaging/calling accepts unverified group authorization: $groupAuthorizationControl" }
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

foreach ($friendSecurityControl in @(
  "Pending friend request not found",
  "mine.Item?.status?.S!=='incoming'",
  "theirs.Item?.status?.S!=='outgoing'",
  "alreadyFriends:true",
  "Respond to the incoming request",
  "notifyFriendRequest(target,user.email)",
  "url:'/feed.html#notifications'",
  "...links.map(x=>x.friendEmail.S)"
)) {
  if (-not $template.Contains($friendSecurityControl)) { throw "Friend requests lack secure durable notification behavior: $friendSecurityControl" }
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
foreach ($framingPolicy in @("pattern: '/messages.html'", "value: 'SAMEORIGIN'", "pattern: '/feed.html'", "value: 'DENY'")) {
  if (-not $amplifyHeaders.Contains($framingPolicy)) { throw "Amplify route-specific framing policy is missing: $framingPolicy" }
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
