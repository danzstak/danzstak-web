$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$failures = [System.Collections.Generic.List[string]]::new()

function Add-Failure([string]$Message) {
  $failures.Add($Message)
}

$htmlFiles = Get-ChildItem -LiteralPath $root -Filter '*.html' -File
foreach ($file in $htmlFiles) {
  $html = Get-Content -LiteralPath $file.FullName -Raw -Encoding utf8

  foreach ($pagePolicy in @('Content-Security-Policy', '<meta name="referrer"', "base-uri 'none'", 'upgrade-insecure-requests')) {
    if (-not $html.Contains($pagePolicy)) { Add-Failure "$($file.Name): required browser security policy is missing: $pagePolicy" }
  }
  $requiredFrameAncestors = if ($file.Name -eq 'messages.html') { "frame-ancestors 'self'" } else { "frame-ancestors 'none'" }
  if (-not $html.Contains($requiredFrameAncestors)) { Add-Failure "$($file.Name): required framing policy is missing: $requiredFrameAncestors" }

  $ids = [regex]::Matches($html, '\bid\s*=\s*["'']([^"'']+)["'']', 'IgnoreCase') |
    ForEach-Object { $_.Groups[1].Value }
  $ids | Group-Object | Where-Object Count -gt 1 | ForEach-Object {
    Add-Failure "$($file.Name): duplicate id '$($_.Name)'"
  }

  $references = [regex]::Matches($html, '\b(?:href|src)\s*=\s*["'']([^"''#?]+)', 'IgnoreCase')
  foreach ($match in $references) {
    $reference = $match.Groups[1].Value
    if ($reference -match '^(?:https?:|data:|blob:|mailto:|tel:|javascript:|/)') { continue }
    $target = Join-Path $file.DirectoryName $reference
    if (-not (Test-Path -LiteralPath $target)) {
      Add-Failure "$($file.Name): missing local reference '$reference'"
    }
  }
}

$homeMarkup = Get-Content -LiteralPath (Join-Path $root 'index.html') -Raw -Encoding utf8
if (-not $homeMarkup.Contains('.hero-logo{display:block;width:min(720px,100%)')) {
  Add-Failure 'Homepage: hero logo can overflow its padded mobile container'
}

$feedPath = Join-Path $root 'feed.html'
$feed = Get-Content -LiteralPath $feedPath -Raw -Encoding utf8
if (-not $feed.Contains('JSON.stringify({ content, audience, mediaKey: storyTicket.mediaKey')) { Add-Failure 'Stories do not inherit the selected post audience' }
foreach ($copyrightSubmission in @('originalContentCertified: document.getElementById("originalContentCertification")?.checked === true', 'originalContentCertified: true')) {
  if (-not $feed.Contains($copyrightSubmission)) { Add-Failure "Posting flow omits copyright attestation: $copyrightSubmission" }
}
foreach ($drawerAccessibility in @('aria-controls="messageDrawer"', 'aria-expanded="false"', 'drawer.setAttribute("role", "dialog")', 'event.key === "Escape"', 'launcher.setAttribute("aria-expanded", "true")')) {
  if (-not $feed.Contains($drawerAccessibility)) { Add-Failure "Messages: accessible drawer behavior is missing: $drawerAccessibility" }
}
$mediaOrigin = 'https://danzstak-call-signaling-mediabucket-abx9qfpinhje.s3.us-west-1.amazonaws.com'
foreach ($page in @('feed.html', 'profile.html', 'messages.html')) {
  $markup = Get-Content -LiteralPath (Join-Path $root $page) -Raw -Encoding utf8
  if (-not $markup.Contains($mediaOrigin)) { Add-Failure "${page}: signed AWS media origin is blocked by CSP" }
}
if ($feed -notmatch "connect-src[^;]+$([regex]::Escape($mediaOrigin))") { Add-Failure 'feed.html: signed S3 uploads are blocked by connect-src' }
$feedEnhancements = Get-Content -LiteralPath (Join-Path $root 'assets\feed-enhancements.js') -Raw -Encoding utf8
if (-not $feedEnhancements.Contains('rightsCertified: true')) { Add-Failure 'External Reel submissions omit rights attestation' }
$pushClient = Get-Content -LiteralPath (Join-Path $root 'assets\push-notifications.js') -Raw -Encoding utf8
foreach ($pushClientControl in @('registration.pushManager.subscribe', 'applicationServerKey', '"/push/key"', '"/push/subscribe"', 'window.danzstakEnablePush')) {
  if (-not $pushClient.Contains($pushClientControl)) { Add-Failure "Messages: background call subscription is missing: $pushClientControl" }
}
$chatScript = Get-Content -LiteralPath (Join-Path $root 'assets\chat.js') -Raw -Encoding utf8
if (-not $chatScript.Contains('await window.danzstakEnablePush()')) { Add-Failure 'Messages: Enable ringing is disconnected from durable Web Push setup' }
if (-not $feedEnhancements.Contains('await window.danzstakEnablePush()')) { Add-Failure 'Settings: Call and message alerts is disconnected from durable Web Push setup' }
if (-not $feedEnhancements.Contains('darkCheckbox.setAttribute("aria-label", "Use dark mode")')) { Add-Failure 'Settings: Dark mode control has no accessible name' }
$feedEnhancementCss = Get-Content -LiteralPath (Join-Path $root 'assets\feed-enhancements.css') -Raw -Encoding utf8
if (-not $feedEnhancementCss.Contains('.composer-actions #publishBtn{grid-column:3;grid-row:2') -or -not $feedEnhancementCss.Contains('.composer-actions #publishBtn{grid-column:3!important;grid-row:2!important') -or -not $feedEnhancementCss.Contains('.reels-option{grid-column:2!important;grid-row:2!important')) {
  Add-Failure 'Composer: Story and Post controls can overlap instead of occupying separate rows'
}
foreach ($eventBehavior in @('Event audience', 'Publishing event', '/secure-posts', 'Event published to DanzStak', 'window.loadPosts')) {
  if (-not $feedEnhancements.Contains($eventBehavior)) { Add-Failure "Events: durable feed publishing is missing: $eventBehavior" }
}
foreach ($eventListingBehavior in @('Published events', 'published-event-card', 'View in Feed', 'scrollIntoView')) {
  if (-not $feedEnhancements.Contains($eventListingBehavior)) { Add-Failure "Events: published-event listing is missing: $eventListingBehavior" }
}
foreach ($groupRolloutBehavior in @('Checking group service', 'Create Group (updating)', 'createButton.disabled = false')) {
  if (-not $feedEnhancements.Contains($groupRolloutBehavior)) { Add-Failure "Groups: staged backend rollout behavior is missing: $groupRolloutBehavior" }
}
if ($feedEnhancements.Contains('Event saved locally:') -or $feedEnhancements.Contains('Draft saved privately in this browser')) {
  Add-Failure 'Navigation still exposes browser-only Messages or Events behavior'
}
foreach ($required in @('/engagement?postId=', '/reactions', '/comments', 'loadEngagement(post)', 'saveComment(post, event.target)', '/engagement-notifications/read')) {
  if (-not $feedEnhancements.Contains($required)) { Add-Failure "Durable feed engagement is missing: $required" }
}
foreach ($reelRequirement in @('id="shareToReels"', 'reel: mediaType === "video" && shareToReels.checked', 'danzstak:posts-loaded')) {
  if (-not $feed.Contains($reelRequirement)) { Add-Failure "Uploaded-video Reels workflow is missing: $reelRequirement" }
}
foreach ($reelRequirement in @('post.reel === true', 'loadInternalReels', 'reel.internal')) {
  if (-not $feedEnhancements.Contains($reelRequirement)) { Add-Failure "Internal Reels rendering is missing: $reelRequirement" }
}
$chatScript = Get-Content -LiteralPath (Join-Path $root 'assets\chat.js') -Raw -Encoding utf8
$chatStyles = Get-Content -LiteralPath (Join-Path $root 'assets\chat.css') -Raw -Encoding utf8
$incomingCalls = Get-Content -LiteralPath (Join-Path $root 'assets\incoming-calls.js') -Raw -Encoding utf8
if (-not $chatScript.Contains('if(await handleEvent(event))handled.push(event.eventId)') -or $chatScript.Contains('filter(event=>event.signalType!=="offer")')) {
  Add-Failure 'Calls: chat may acknowledge signals it did not handle'
}
if ($incomingCalls.Contains('const disposable =') -or -not $incomingCalls.Contains('document.getElementById("messageDrawer")')) {
  Add-Failure 'Calls: background watcher may steal active chat signals'
}
foreach ($callBehavior in @('setCallMode(kind)', 'showCallConversation()', 'setCallMode("")')) {
  if (-not $chatScript.Contains($callBehavior)) { Add-Failure "Calls: missing call layout state behavior: $callBehavior" }
}
foreach ($callLayout in @('body[data-call-mode="phone"] .video-grid', 'body[data-call-mode="phone"] #toggleCamera', 'body[data-call-mode="video"] .video-grid', '.receiver-hangup[hidden]')) {
  if (-not $chatStyles.Contains($callLayout)) { Add-Failure "Calls: missing phone/video layout rule: $callLayout" }
}
if (-not $feed.Contains('event.data?.type === "danzstak-call-mode"') -or -not $feed.Contains('.message-drawer.is-video-call')) {
  Add-Failure 'Calls: the message drawer does not expand exclusively for video calls'
}
if (-not $incomingCalls.Contains('answer.focus()') -or -not $incomingCalls.Contains('event.key === "Escape"') -or -not $incomingCalls.Contains('previousFocus?.focus()')) {
  Add-Failure 'Calls: global incoming-call dialog does not manage keyboard focus'
}
$inlineScripts = [regex]::Matches(
  $feed,
  '<script(?![^>]+src=)[^>]*>([\s\S]*?)</script>',
  [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
)
if ($inlineScripts.Count -ne 1) {
  Add-Failure "feed.html: expected one inline application script, found $($inlineScripts.Count)"
} else {
  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    $hash = [Convert]::ToBase64String(
      $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($inlineScripts[0].Groups[1].Value))
    )
  } finally {
    $sha.Dispose()
  }
  if ($feed -notmatch [regex]::Escape("'sha256-$hash'")) {
    Add-Failure 'feed.html: CSP does not authorize the current inline application script hash'
  }
  if ($feed -match "script-src[^;]*'unsafe-inline'") {
    Add-Failure "feed.html: script-src still permits 'unsafe-inline'"
  }
}

$requiredStoryUploadSteps = @(
  'const storyTicketResponse = await fetch("https://api.danzstak.com/stories"',
  'const storyUploadResponse = await fetch(storyTicket.uploadUrl',
  'dedicatedMedia: true',
  'alert("Your post was saved, but the Story could not be published.")'
)
foreach ($step in $requiredStoryUploadSteps) {
  if (-not $feed.Contains($step)) {
    Add-Failure "feed.html: dedicated Story media upload step is missing: $step"
  }
}
foreach ($storyViewerBehavior in @('aria-labelledby", "storyViewerCaption"', 'media.muted = true', 'storyViewerPreviousFocus?.focus({ preventScroll: true })', 'viewer.querySelector(".story-viewer-close").focus()')) {
  if (-not $feed.Contains($storyViewerBehavior)) { Add-Failure "Stories: accessible autoplay viewer behavior is missing: $storyViewerBehavior" }
}
if (-not $feed.Contains('function openStoryViewer(story)') -or
    -not $feed.Contains('setInterval(loadStories, 45 * 60 * 1000)') -or
    -not $feed.Contains('video.autoplay = true;') -or
    -not $feed.Contains('viewer.showModal();')) {
  Add-Failure 'Stories: media viewer, autoplay, or signed-URL refresh is incomplete'
}

$serviceWorker = Get-Content -LiteralPath (Join-Path $root 'service-worker.js') -Raw -Encoding utf8
if ($serviceWorker -notmatch 'const CACHE = "danzstak-shell-v\d+";' -or
    $serviceWorker -notmatch 'skipWaiting\(\)' -or
    $serviceWorker -notmatch 'clients\.claim\(\)') {
  Add-Failure 'service-worker.js: installed-app cache update activation is incomplete'
}
$installHandler = [regex]::Match($serviceWorker, 'self\.addEventListener\("install",[\s\S]*?\n\}\);').Value
if ($installHandler -match 'skipWaiting\(') { Add-Failure 'PWA: a background update can interrupt an active post or call without consent' }
foreach ($updateBehavior in @('cache.put(url.pathname, copy)', 'caches.match(url.pathname)', 'event.data?.type === "SKIP_WAITING"')) {
  if (-not $serviceWorker.Contains($updateBehavior)) { Add-Failure "PWA: safe update behavior is missing: $updateBehavior" }
}

$pwaJs = Get-Content -LiteralPath (Join-Path $root 'assets\pwa.js') -Raw -Encoding utf8
$serviceWorkerJs = Get-Content -LiteralPath (Join-Path $root 'service-worker.js') -Raw -Encoding utf8
foreach ($callNotificationBehavior in @('payload.type === "call"', 'action: "answer"', 'action: "dismiss"', 'event.action === "dismiss"')) {
  if (-not $serviceWorkerJs.Contains($callNotificationBehavior)) { Add-Failure "PWA: call notification behavior is missing: $callNotificationBehavior" }
}
if (-not $pwaJs.Contains('const installStateKey = "danzstak_app_installed"') -or
    -not $pwaJs.Contains('localStorage.setItem(installStateKey, "1")') -or
    -not $pwaJs.Contains('localStorage.removeItem(installStateKey)')) {
  Add-Failure 'PWA: completed installation is not remembered or cannot recover after uninstall'
}
foreach ($updatePromptBehavior in @('registration.waiting', 'registration.addEventListener("updatefound"', 'waitingWorker?.postMessage({ type: "SKIP_WAITING" })')) {
  if (-not $pwaJs.Contains($updatePromptBehavior)) { Add-Failure "PWA: visible update lifecycle is missing: $updatePromptBehavior" }
}

$sessionCleanupJs = Get-Content -LiteralPath (Join-Path $root 'assets\session-cleanup.js') -Raw -Encoding utf8
$directMessagesJs = Get-Content -LiteralPath (Join-Path $root 'assets\direct-messages.js') -Raw -Encoding utf8
if (-not $directMessagesJs.Contains('currentEmail = String(profile.email || profile.username || "").toLowerCase()')) {
  Add-Failure 'Messages: current account identity is not used to distinguish sent and received messages'
}
foreach ($messagePollingBehavior in @('distanceFromBottom', 'followNewest', 'document.hidden && !reset', 'visibilitychange')) {
  if (-not $directMessagesJs.Contains($messagePollingBehavior)) { Add-Failure "Messages: respectful live polling behavior is missing: $messagePollingBehavior" }
}
foreach ($contactFailureBehavior in @('async function directFetch(', 'controller.abort()', 'Contacts are temporarily unavailable. Retrying automatically')) {
  if (-not $directMessagesJs.Contains($contactFailureBehavior)) { Add-Failure "Messages: bounded contact loading behavior is missing: $contactFailureBehavior" }
}
if (-not $feed.Contains('filter(user => user.online === true)') -or -not $feed.Contains('No friends are online right now.')) {
  Add-Failure 'Online Users: the right panel can show offline contacts as online-directory results'
}
$sessionActivityJs = Get-Content -LiteralPath (Join-Path $root 'assets\session-activity.js') -Raw -Encoding utf8
$profileEditorJs = Get-Content -LiteralPath (Join-Path $root 'assets\profile-editor.js') -Raw -Encoding utf8
foreach ($protectedProfileMedia in @('if (stored.mediaUrl)', 'stored.mediaKey && !viewingOtherProfile')) {
  if (-not $profileEditorJs.Contains($protectedProfileMedia)) { Add-Failure "Profiles: media authorization safeguard is missing: $protectedProfileMedia" }
}
foreach ($settingsBehavior in @('danzstak_reduce_motion', 'danzstak_data_saver', 'Signs out after 2h without activity', '"Account", logout')) {
  if (-not $feedEnhancements.Contains($settingsBehavior)) { Add-Failure "Settings: persistent control is missing: $settingsBehavior" }
}
$logoutJs = Get-Content -LiteralPath (Join-Path $root 'assets\logout.js') -Raw -Encoding utf8
if (-not $logoutJs.Contains('event.target.closest("[data-logout]")')) { Add-Failure 'Logout: dynamically rendered account controls are not handled' }
foreach ($profileVideoBehavior in @('/profile-video', 'uploadCloudMedia(file)', 'Remove Profile Video', 'action: "view"', 'revealProfileVideoControls()')) {
  if (-not $profileEditorJs.Contains($profileVideoBehavior)) { Add-Failure "Profiles: durable profile video behavior is missing: $profileVideoBehavior" }
}
$logoutJs = Get-Content -LiteralPath (Join-Path $root 'assets\logout.js') -Raw -Encoding utf8
$homeJs = Get-Content -LiteralPath (Join-Path $root 'assets\home.js') -Raw -Encoding utf8
foreach ($privateKey in @('danzstak_dev_sections', 'danzstak-post-preferences', 'danzstak-hidden-posts', 'danzstak_chat_read', 'danzstak_profile_draft', 'danzstak_profile_media', 'danzstak_last_activity')) {
  if (-not $sessionCleanupJs.Contains($privateKey)) { Add-Failure "Logout cleanup omits account-local data: $privateKey" }
}
if ($sessionActivityJs.Contains('if (document.hidden || presenceUpdating) return;') -or
    -not $sessionActivityJs.Contains('Date.now() - lastActivity >= idleTimeout || presenceUpdating')) {
  Add-Failure 'Presence: background tabs can expire an otherwise active signed-in user'
}
foreach ($idleBehavior in @('const activityKey = "danzstak_last_activity"', 'setTimeout(logoutIfIdle', 'keepalive: true', 'addEventListener("storage"')) {
  if (-not $sessionActivityJs.Contains($idleBehavior)) { Add-Failure "Sessions: exact two-hour cross-tab idle logout is missing: $idleBehavior" }
}
foreach ($profileFeature in @('loadProfilePosts(false)', 'loadProfilePosts(true)', 'loadProfileFriends()', 'profile-friend-card', 'profile-post-card')) {
  if (-not $profileEditorJs.Contains($profileFeature)) { Add-Failure "Profile tabs are not functional: $profileFeature" }
}
foreach ($accessibilityFeature in @('tabs.setAttribute("role", "tablist")', 'button.setAttribute("aria-selected"', 'ArrowLeft', 'ArrowRight')) {
  if (-not $profileEditorJs.Contains($accessibilityFeature)) { Add-Failure "Profile tab keyboard accessibility is missing: $accessibilityFeature" }
}

$profileJs = Get-Content -LiteralPath (Join-Path $root 'assets\profile.js') -Raw -Encoding utf8
if (-not $profileJs.Contains('requestedUser ? "Private" : (email || "Not available")') -or
    -not $profileJs.Contains('avatar.classList.remove("has-photo")') -or
    -not $profileJs.Contains('cover.classList.remove("has-photo")') -or
    -not $profileEditorJs.Contains('if (!viewingOtherProfile) {')) {
  Add-Failure 'Profiles: another member can inherit local profile media or expose their email'
}
if (-not $feed.Contains('authorLabel.href = isOwner === true ? "profile.html" : "profile.html?user=" + encodeURIComponent(authorEmail);')) {
  Add-Failure 'Profiles: an owner post routes the author back to a non-editable other-user profile'
}
if (-not $logoutJs.Contains('window.danzstakClearAccountData?.()') -or
    -not $homeJs.Contains('window.danzstakClearAccountData?.()')) {
  Add-Failure 'Logout does not clear account-local browser data on every page'
}

$chatCss = Get-Content -LiteralPath (Join-Path $root 'assets\chat.css') -Raw -Encoding utf8
$softUiCss = Get-Content -LiteralPath (Join-Path $root 'assets\soft-ui.css') -Raw -Encoding utf8
if (-not $chatCss.Contains('.embedded-messages .conversation-choices{display:none!important}')) {
  Add-Failure 'chat.css: embedded message drawer exposes the oversized conversation chooser'
}
if ($softUiCss -notmatch 'a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible' -or
    $softUiCss -notmatch '@media\(prefers-reduced-motion:reduce\).*\*::before' ) {
  Add-Failure 'soft-ui.css: keyboard focus or reduced-motion accessibility support is incomplete'
}

$termsText = Get-Content -LiteralPath (Join-Path $root 'terms.html') -Raw -Encoding utf8
$privacyText = Get-Content -LiteralPath (Join-Path $root 'privacy.html') -Raw -Encoding utf8
if ($termsText -match 'invite codes|call codes' -or $privacyText -match 'invite codes|call codes') {
  Add-Failure 'Legal pages still describe the retired call-code workflow'
}
if (-not $chatCss.Contains('.conversation-header[hidden]{display:none!important}')) {
  Add-Failure 'chat.css: hidden conversation header exposes call controls before selecting a contact'
}

$messagesHtml = Get-Content -LiteralPath (Join-Path $root 'messages.html') -Raw -Encoding utf8
$chatJs = Get-Content -LiteralPath (Join-Path $root 'assets\chat.js') -Raw -Encoding utf8
$directMessagesJs = Get-Content -LiteralPath (Join-Path $root 'assets\direct-messages.js') -Raw -Encoding utf8
$feedEnhancementsJs = Get-Content -LiteralPath (Join-Path $root 'assets\feed-enhancements.js') -Raw -Encoding utf8
if ([regex]::Matches($feedEnhancementsJs, '(?m)^function isLocalHost\(\)').Count -ne 1) {
  Add-Failure 'feed-enhancements.js must expose one top-level isLocalHost helper'
}
if ($messagesHtml -notmatch 'id="receiverHangUp"[^>]+hidden' -or
    -not $chatJs.Contains('els.receiverHangup.hidden=false') -or
    -not $chatJs.Contains('els.receiverHangup.hidden=true')) {
  Add-Failure 'Call controls: receiver Hang Up visibility is not tied to active call state'
}
if (-not $chatJs.Contains('if(await handleEvent(event))handled.push(event.eventId)') -or
    -not $chatJs.Contains('eventIds:[offer.eventId]') -or
    -not $chatJs.Contains('if(pending?.eventId===event.eventId)return false;')) {
  Add-Failure 'Calls: incoming offers are acknowledged before receiver action or ring repeatedly'
}
if (-not $messagesHtml.Contains('role="dialog" aria-modal="true" aria-labelledby="incomingLabel"') -or -not $chatJs.Contains('els.accept.focus()') -or -not $chatJs.Contains('event.key==="Escape"')) {
  Add-Failure 'Calls: message-page incoming-call dialog is not keyboard accessible'
}
if (-not $feedEnhancementsJs.Contains('body: JSON.stringify({ content: post.querySelector(".post-content")?.textContent.trim() || "Shared media", audience: audiences[next] })') -or
    -not $feedEnhancementsJs.Contains('["Edit post", "Who can comment?", "Edit privacy"].includes')) {
  Add-Failure 'Post menu: privacy persistence or non-owner control filtering is incomplete'
}
if (-not $feedEnhancementsJs.Contains('https://api.danzstak.com/settings/posts') -or
    -not $feedEnhancementsJs.Contains('option("Move to archive", "Hide this post from your account."')) {
  Add-Failure 'Post menu: archived and hidden posts are not persisted to the account'
}
if (-not $feedEnhancementsJs.Contains('const remoteNames = { pinned: "pinned", saved: "saved", notificationsOff: "muted" }') -or
    -not $feedEnhancementsJs.Contains('preference: remoteNames[name], enabled') -or
    -not $feedEnhancementsJs.Contains('if (title === "Delete post") button.classList.add("post-option-danger")')) {
  Add-Failure 'Post menu: pin, save, mute, or destructive-action persistence is incomplete'
}
if (-not $feedEnhancementsJs.Contains('body: JSON.stringify({ commentPolicy: policies[next] })') -or
    -not $feed.Contains('post.commentPolicy') -or
    -not $feed.Contains('commentPolicy = "everyone"')) {
  Add-Failure 'Post menu: server-backed comment policy is not restored or saved'
}
if (-not $feedEnhancementsJs.Contains('readSections().Settings?.notifications === false') -or
    -not $feedEnhancementsJs.Contains('Show activity notification badges on this device')) {
  Add-Failure 'Settings: the activity notification preference is misleading or not enforced'
}
if (-not $feedEnhancementsJs.Contains('const people = new Map(directory.map') -or
    -not $feedEnhancementsJs.Contains('avatar.className = "notification-avatar"') -or
    -not $feedEnhancementsJs.Contains('if (featureHeading.textContent === "Notifications") renderWorkspace("Notifications")')) {
  Add-Failure 'Notifications: member identity or post-read refresh is incomplete'
}
if (-not $feedEnhancementsJs.Contains('function postPermalink(post)') -or
    -not $feedEnhancementsJs.Contains('navigator.clipboard.writeText(postPermalink(post))') -or
    -not $feed.Contains('document.getElementById(decodeURIComponent(location.hash.slice(1)))')) {
  Add-Failure 'Post sharing: stable post-specific links or delayed anchor focus are missing'
}
if (-not $feed.Contains('article.dataset.audience = ["public", "friends", "private"].includes(audience) ? audience : "public";') -or
    -not $feedEnhancementsJs.Contains('Only Public posts can be shared outside DanzStak.') -or
    -not $feedEnhancementsJs.Contains('post.dataset.audience = audiences[next];')) {
  Add-Failure 'Post sharing: non-public content can leak through external sharing or stale privacy state'
}
if (-not $feedEnhancementsJs.Contains('localStorage.getItem("danzstak_dark_mode") === "1"') -or
    -not $feedEnhancementsJs.Contains('document.documentElement.lang = localStorage.getItem("danzstak_language") || "en"')) {
  Add-Failure 'Settings: saved dark-mode or language preferences are not restored after navigation'
}
$reactionStart = $feedEnhancementsJs.IndexOf('function addReactionButton(post)')
$ownerFilter = $feedEnhancementsJs.IndexOf('if (!owner)')
if ($ownerFilter -lt 0 -or $reactionStart -lt 0 -or $ownerFilter -gt $reactionStart) {
  Add-Failure 'Post controls: the non-owner filter is missing or executes inside reaction setup'
}
if (-not $directMessagesJs.Contains('if (!document.body.classList.contains("is-conversation-open")) return;') -or
    -not $directMessagesJs.Contains('/messages?read=1&contact=')) {
  Add-Failure 'Messaging: background or minimized chats can incorrectly clear unread state'
}
if (-not $directMessagesJs.Contains('message.myReaction === emoji ? "Remove " : "React with "') -or
    -not $directMessagesJs.Contains('call.setAttribute("aria-label", call.title)') -or
    -not $directMessagesJs.Contains('button.setAttribute("aria-label", "Insert " + emoji)')) {
  Add-Failure 'Messaging: dynamic emoji or call controls lack accessible names'
}
foreach ($reactionBehavior in @('async function saveMessageReaction(', 'action: "reaction"', 'updateMessageReactionBadge(existing, message)', 'message.reactionCounts')) {
  if (-not $directMessagesJs.Contains($reactionBehavior)) { Add-Failure "Messaging: durable message reaction behavior is missing: $reactionBehavior" }
}
if (-not $directMessagesJs.Contains('event.source === window.parent') -or
    -not $feed.Contains('event.source !== drawer.querySelector("iframe")?.contentWindow')) {
  Add-Failure 'Messaging: cross-window events are not bound to the expected parent and iframe'
}
if (-not $directMessagesJs.Contains('type: "danzstak-chat-read"') -or -not $feed.Contains('event.data?.type === "danzstak-chat-read"')) {
  Add-Failure 'Notifications: reading an embedded chat does not refresh the unread count'
}
foreach ($partialNotificationBehavior in @('notificationSourceCounts', 'if (succeeded) updateNotificationCount', 'if (!response?.ok && !engagementResponse?.ok)')) {
  if (-not $feedEnhancementsJs.Contains($partialNotificationBehavior)) { Add-Failure "Notifications: partial API failure handling is missing: $partialNotificationBehavior" }
}
if (-not $directMessagesJs.Contains('Promise.allSettled([') -or
    -not $directMessagesJs.Contains('if (!email || (!existing && !member.sharedGroup)) continue;') -or
    -not $directMessagesJs.Contains('online: member.online === true')) {
  Add-Failure 'Messaging: partial API failures or friend presence can empty or stale the chat list'
}
if (-not $feed.Contains('const [friendsResult, directoryResult] = await Promise.allSettled([') -or
    -not $feed.Contains('if (!friendsResponse?.ok) throw new Error("Friends could not be loaded");')) {
  Add-Failure 'Feed friends: a presence failure can still hide accepted friends'
}
if (-not $directMessagesJs.Contains('const chatFilters =') -or -not $directMessagesJs.Contains('item.setAttribute("aria-selected"') -or -not $directMessagesJs.Contains('ArrowRight')) {
  Add-Failure 'Chat filter tabs do not support accessible selection and arrow-key navigation'
}
if (-not $feedEnhancements.Contains('notificationAnnouncer.setAttribute("aria-live", "polite")') -or -not $feedEnhancements.Contains('lastNotificationCount')) {
  Add-Failure 'Notification count changes are not announced accessibly'
}
foreach ($groupFeature in @('fetch("https://api.danzstak.com/groups"', 'communityStandards: true', 'method: "DELETE"', 'customGroups = cloud')) {
  if (-not $feedEnhancements.Contains($groupFeature)) { Add-Failure "Groups are not durable across devices: $groupFeature" }
}
foreach ($workspaceRouting in @('const workspaceRoutes = new Map(', 'history.pushState({ workspace: canonicalName }', 'addEventListener("popstate", restoreWorkspaceRoute)', 'restoreWorkspaceRoute();')) {
  if (-not $feedEnhancements.Contains($workspaceRouting)) { Add-Failure "Feed workspaces do not support refresh and Back/Forward navigation: $workspaceRouting" }
}
foreach ($workspaceAccessibility in @('control.setAttribute("aria-current", "page")', 'featureHeading.tabIndex = -1', 'featureHeading.focus({ preventScroll: true })')) {
  if (-not $feedEnhancements.Contains($workspaceAccessibility)) { Add-Failure "Feed workspaces do not announce navigation accessibly: $workspaceAccessibility" }
}
foreach ($reelPlaybackBehavior in @('const reelPlaybackObserver = new IntersectionObserver', 'entry.intersectionRatio >= 0.6', 'reelPlaybackObserver.observe(video)', 'document.hidden || video.dataset.inView !== "true"')) {
  if (-not $feedEnhancements.Contains($reelPlaybackBehavior)) { Add-Failure "Reels do not pause off-screen or while the app is hidden: $reelPlaybackBehavior" }
}
if ($feed.Contains('window.location.assign("./")') -or
    -not $feed.Contains('history.replaceState(null, "", location.pathname);')) {
  Add-Failure 'Feed navigation: Home still round-trips through the public landing page'
}
if (-not $feed.Contains('async function fetchWithDeadline') -or
    -not $feed.Contains('fetchWithDeadline("https://api.danzstak.com/calls/directory"') -or
    -not $chatJs.Contains('timer=setTimeout(()=>controller.abort(),10000)')) {
  Add-Failure 'Presence: feed or chat can remain stuck indefinitely on a stalled API request'
}

$deprecated = Get-ChildItem -LiteralPath $root -Recurse -File |
  Where-Object {
    $_.FullName -notlike "$root\.git\*" -and
    $_.FullName -ne $PSCommandPath
  } |
  Select-String -SimpleMatch 'feed-secure-test' -List
if ($deprecated) {
  $deprecated | ForEach-Object { Add-Failure "$($_.Path): deprecated test-feed reference remains" }
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Add-Failure 'Node.js is required for JavaScript syntax checks'
} else {
  foreach ($script in Get-ChildItem -LiteralPath (Join-Path $root 'assets') -Filter '*.js' -File) {
    & $node.Source --check $script.FullName
    if ($LASTEXITCODE -ne 0) { Add-Failure "$($script.Name): JavaScript syntax check failed" }
  }
  if ($inlineScripts.Count -eq 1) {
    $inlineScripts[0].Groups[1].Value | & $node.Source --check -
    if ($LASTEXITCODE -ne 0) { Add-Failure 'feed.html: inline JavaScript syntax check failed' }
  }
}

if ($failures.Count -gt 0) {
  $failures | ForEach-Object { Write-Error $_ }
  exit 1
}

Write-Host "Site smoke tests passed ($($htmlFiles.Count) pages checked)."
