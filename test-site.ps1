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
if (-not $homeMarkup.Contains('.hero-logo{display:block;width:min(520px,100%)')) {
  Add-Failure 'Homepage: hero logo can overflow its padded mobile container'
}

$supportMarkup = Get-Content -LiteralPath (Join-Path $root 'support.html') -Raw -Encoding utf8
$supportClient = Get-Content -LiteralPath (Join-Path $root 'assets\support.js') -Raw -Encoding utf8
foreach ($supportControl in @('support@danzstak.com', 'Do not include passwords', 'id="supportForm"', 'maxlength="5000"')) {
  if (-not $supportMarkup.Contains($supportControl)) { Add-Failure "Support: secure member form is missing: $supportControl" }
}
foreach ($supportClientControl in @('credentials:"include"', 'https://api.danzstak.com/support-tickets', 'response.status===401')) {
  if (-not $supportClient.Contains($supportClientControl)) { Add-Failure "Support: authenticated request handling is missing: $supportClientControl" }
}

$bookingMarkup = Get-Content -LiteralPath (Join-Path $root 'booking.html') -Raw -Encoding utf8
$bookingClient = Get-Content -LiteralPath (Join-Path $root 'assets\booking-agent.js') -Raw -Encoding utf8
foreach ($bookingControl in @('DanzStak Booking Agent', 'Book the band. Map the run.', 'clubs usually book about two months out.', 'Festivals can book 18 months out.', 'Punk Couch Tour', 'Holiday Inn Tour', 'id="driverName"', 'No driver, no departure', 'public venue contacts', 'Bands join by invitation')) {
  if (-not $bookingMarkup.Contains($bookingControl)) { Add-Failure "Booking Agent: required planning control is missing: $bookingControl" }
}
foreach ($bookingClientControl in @('Send me out and bring me home', 'Band or artist', 'First show / leave home', 'Back home', 'route-map', 'My saved tours')) {
  if (-not $bookingClient.Contains($bookingClientControl)) { Add-Failure "Booking Agent: required home-loop control is missing: $bookingClientControl" }
}
if (-not (Get-Content -LiteralPath (Join-Path $root 'assets\booking-agent-driver.css') -Raw -Encoding utf8).Contains('@media(max-width:520px){.booking-lead{padding:16px 18px}')) {
  Add-Failure 'Booking Agent: narrow-phone hero and navigation sizing is missing'
}
$bookingDriverCss = Get-Content -LiteralPath (Join-Path $root 'assets\booking-agent-driver.css') -Raw -Encoding utf8
if (-not $bookingDriverCss.Contains('@media(max-width:680px){.primary-route{position:static}')) {
  Add-Failure 'Booking Agent: mobile route action can overlap form fields'
}
foreach ($tourEstimateControl in @('miles/mpg*number("fuelPrice")', 'number("rentalRate")*days', 'Daily mileage is aggressive', 'navigator.geolocation.getCurrentPosition', 'window.print()')) {
  if (-not $bookingClient.Contains($tourEstimateControl)) { Add-Failure "Tour Manager: estimate or driver safeguard is missing: $tourEstimateControl" }
}

$feedPath = Join-Path $root 'feed.html'
$feed = Get-Content -LiteralPath $feedPath -Raw -Encoding utf8
if (-not $feed.Contains("frame-src 'self' https://www.youtube-nocookie.com")) {
  Add-Failure 'Messages: the feed CSP blocks the same-origin embedded chat drawer'
}
foreach ($uploadCleanupControl in @('async function discardUploadedMedia(mediaKey)', 'await discardUploadedMedia(uploadedStoryKey)', 'await discardUploadedMedia(uploadedPostKey)')) {
  if (-not $feed.Contains($uploadCleanupControl)) { Add-Failure "Media: failed publication leaves an orphaned upload: $uploadCleanupControl" }
}
foreach ($storyAccessibilityControl in @('open.className = "story-open"', 'open.setAttribute("aria-label", "Open Story from "', 'open.addEventListener("click", () => openStoryViewer(story))')) {
  if (-not $feed.Contains($storyAccessibilityControl)) { Add-Failure "Stories: open and delete controls are not separately accessible: $storyAccessibilityControl" }
}
if (-not $feed.Contains('JSON.stringify({ content, audience, mediaKey: storyTicket.mediaKey')) { Add-Failure 'Stories do not inherit the selected post audience' }
foreach ($copyrightSubmission in @('originalContentCertified: true')) {
  if (-not $feed.Contains($copyrightSubmission)) { Add-Failure "Posting flow omits copyright attestation: $copyrightSubmission" }
}
foreach ($preUploadCertification in @('if (!certification?.checked)', 'certification?.focus()', 'Do you certify that you created this Story')) {
  if (-not $feed.Contains($preUploadCertification)) { Add-Failure "Copyright: upload can begin before explicit certification: $preUploadCertification" }
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
foreach ($dedicatedStoryControl in @('aria-label="Add a photo or video to Your Story"', 'createStoryInput.accept = "image/jpeg', 'dedicatedMedia: true', 'originalContentCertified: true', 'await loadStories()')) {
  if (-not $feed.Contains($dedicatedStoryControl)) { Add-Failure "Stories: dedicated Your Story upload is incomplete: $dedicatedStoryControl" }
}
$feedEnhancements = Get-Content -LiteralPath (Join-Path $root 'assets\feed-enhancements.js') -Raw -Encoding utf8
if ($feedEnhancements.Contains('Reel saved on this device until cloud sync is available.') -or
    -not $feedEnhancements.Contains('if (!response.ok || !result.reel) throw new Error')) {
  Add-Failure 'Reels: failed cloud publication is still presented as a saved Reel'
}
if (-not $feedEnhancements.Contains('rightsCertified: true')) { Add-Failure 'External Reel submissions omit rights attestation' }
$pushClient = Get-Content -LiteralPath (Join-Path $root 'assets\push-notifications.js') -Raw -Encoding utf8
$logoutJs = Get-Content -LiteralPath (Join-Path $root 'assets\logout.js') -Raw -Encoding utf8
$homeJs = Get-Content -LiteralPath (Join-Path $root 'assets\home.js') -Raw -Encoding utf8
foreach ($pushClientControl in @('registration.pushManager.subscribe', 'applicationServerKey', '"/push/key"', '"/push/subscribe"', 'window.danzstakEnablePush')) {
  if (-not $pushClient.Contains($pushClientControl)) { Add-Failure "Messages: background call subscription is missing: $pushClientControl" }
}
$sessionCleanupForPush = Get-Content -LiteralPath (Join-Path $root 'assets\session-cleanup.js') -Raw -Encoding utf8
foreach ($pushLogoutControl in @('window.danzstakDisablePush = async () =>', 'method: "DELETE"', 'await subscription.unsubscribe()', 'await window.danzstakDisablePush?.()', 'controller.abort()', 'Promise.race([')) {
  if (-not ($sessionCleanupForPush + $logoutJs + $homeJs).Contains($pushLogoutControl)) { Add-Failure "Logout: this device can remain subscribed to the previous account: $pushLogoutControl" }
}
foreach ($pushCleanupPage in @('index.html', 'feed.html', 'profile.html', 'messages.html')) {
  $pushCleanupMarkup = Get-Content -LiteralPath (Join-Path $root $pushCleanupPage) -Raw -Encoding utf8
  if (-not $pushCleanupMarkup.Contains('assets/session-cleanup.js?v=')) { Add-Failure "${pushCleanupPage}: account device cleanup is not loaded" }
}
$chatScript = Get-Content -LiteralPath (Join-Path $root 'assets\chat.js') -Raw -Encoding utf8
if (-not $chatScript.Contains('await window.danzstakEnablePush()')) { Add-Failure 'Messages: Enable ringing is disconnected from durable Web Push setup' }
if (-not $feedEnhancements.Contains('await window.danzstakEnablePush()')) { Add-Failure 'Settings: Call and message alerts is disconnected from durable Web Push setup' }
if (-not $feedEnhancements.Contains('darkCheckbox.setAttribute("aria-label", "Use dark mode")')) { Add-Failure 'Settings: Dark mode control has no accessible name' }
foreach ($safeSettingsLoad in @('button.textContent = "Loading Settings', 'button.dataset.mode = "retry"', 'Retry before changing privacy preferences.', 'if (!response.ok) throw new Error("Account settings could not be loaded.")')) {
  if (-not $feedEnhancements.Contains($safeSettingsLoad)) { Add-Failure "Settings: a failed preference load can overwrite account privacy: $safeSettingsLoad" }
}
$feedEnhancementCss = Get-Content -LiteralPath (Join-Path $root 'assets\feed-enhancements.css') -Raw -Encoding utf8
foreach ($displayPage in @('feed.html', 'profile.html', 'messages.html')) {
  $displayMarkup = Get-Content -LiteralPath (Join-Path $root $displayPage) -Raw -Encoding utf8
  if (-not $displayMarkup.Contains('assets/display-preferences.js?v=')) { Add-Failure "${displayPage}: saved display preferences are not restored before rendering" }
}
$displayPreferences = Get-Content -LiteralPath (Join-Path $root 'assets\display-preferences.js') -Raw -Encoding utf8
foreach ($preference in @('danzstak_dark_mode', 'danzstak_reduce_motion', 'danzstak_language')) {
  if (-not $displayPreferences.Contains($preference)) { Add-Failure "Display preferences: shared bootstrap omits $preference" }
}
$profileStyles = Get-Content -LiteralPath (Join-Path $root 'assets\profile-editor.css') -Raw -Encoding utf8
$chatStylesForPreferences = Get-Content -LiteralPath (Join-Path $root 'assets\chat.css') -Raw -Encoding utf8
foreach ($styleSet in @($feedEnhancementCss, $profileStyles, $chatStylesForPreferences)) {
  if (-not $styleSet.Contains('.dark-mode') -or -not $styleSet.Contains('.reduce-motion')) { Add-Failure 'Display preferences: a core page lacks dark-mode or reduced-motion coverage' }
}
if ($feedEnhancementCss -match '\.story-share-control input\{position:absolute') { Add-Failure 'Composer: checkbox placement still relies on an absolute offset' }
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
foreach ($reelRequirement in @('id="shareToReels"', 'reel: mediaType === "video" && publishToReels', 'danzstak:posts-loaded')) {
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
if ($incomingCalls.Contains('const disposable =') -or -not $chatScript.Contains('embeddedMode=messageParams.get("embedded")==="1"')) {
  Add-Failure 'Calls: embedded chat and background watcher do not have distinct signal ownership'
}
foreach ($backgroundCallControl in @('window.openMessageDrawer(event.senderEmail, true, event.callId)', 'answerCall = false', 'target.searchParams.set("answer", "1")', 'if(!embeddedMode||autoAnswer)poll()')) {
  if (-not ($incomingCalls + $feed + $chatScript).Contains($backgroundCallControl)) { Add-Failure "Calls: hidden message drawer can suppress or misroute incoming calls: $backgroundCallControl" }
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
    $canonicalInlineScript = $inlineScripts[0].Groups[1].Value -replace "`r`n?", "`n"
    $hash = [Convert]::ToBase64String(
      $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($canonicalInlineScript))
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
    -not $feed.Contains('video.autoplay = localStorage.getItem("danzstak_data_saver") !== "1";') -or
    -not $feed.Contains('viewer.showModal();')) {
  Add-Failure 'Stories: media viewer, autoplay, or signed-URL refresh is incomplete'
}

$serviceWorker = Get-Content -LiteralPath (Join-Path $root 'service-worker.js') -Raw -Encoding utf8
if (-not $serviceWorker.Contains('/assets/display-preferences.js')) { Add-Failure 'PWA: shared display preferences are unavailable offline' }
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
foreach ($callNotificationBehavior in @('payload.type === "call"', 'action: "answer"', 'action: "dismiss"', 'event.action === "dismiss"', 'event.action === "answer" && event.notification.data?.type === "call"', 'destinationUrl.searchParams.set("answer", "1")')) {
  if (-not $serviceWorkerJs.Contains($callNotificationBehavior)) { Add-Failure "PWA: call notification behavior is missing: $callNotificationBehavior" }
}
if (-not $serviceWorkerJs.Contains('candidate.pathname + candidate.search + candidate.hash')) { Add-Failure 'PWA: same-origin notification destinations lose their workspace route' }
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
foreach ($messageHistoryBehavior in @('let nextMessageCursor = ""', 'function renderEarlierMessagesButton()', 'async function loadEarlierMessages()', '"&before=" + encodeURIComponent(cursor)', 'messageList.prepend(fragment)', 'Load earlier messages')) {
  if (-not $directMessagesJs.Contains($messageHistoryBehavior)) { Add-Failure "Messages: saved history cannot load beyond the newest page: $messageHistoryBehavior" }
}
foreach ($messageIdentityBehavior in @('let activeContactName = "Contact"', 'activeContactName = conversation.name || "Contact"', '(mine ? "You" : activeContactName)')) {
  if (-not $directMessagesJs.Contains($messageIdentityBehavior)) { Add-Failure "Messages: visible message metadata can expose contact email instead of the profile name: $messageIdentityBehavior" }
}
foreach ($chatPresenceBehavior in @('conversation-avatar-wrap', 'conversation.online === true', 'conversation-online-dot', 'aria-label", "Online')) {
  if (-not ($directMessagesJs + $chatStyles).Contains($chatPresenceBehavior)) { Add-Failure "Messages: online friends lack a visible accessible presence marker: $chatPresenceBehavior" }
}
foreach ($contactFailureBehavior in @('async function directFetch(', 'controller.abort()', 'Contacts are temporarily unavailable. Retrying automatically')) {
  if (-not $directMessagesJs.Contains($contactFailureBehavior)) { Add-Failure "Messages: bounded contact loading behavior is missing: $contactFailureBehavior" }
}
foreach ($onlineContactNavigation in @('name.href = "profile.html?member=" + encodeURIComponent(memberId)', 'action.addEventListener("click", () => openMessageDrawer(user.email))', 'user.friendStatus === "friends" || user.sharedGroup')) {
  if (-not $feed.Contains($onlineContactNavigation)) { Add-Failure "Online contacts: profile or embedded-message navigation is incomplete: $onlineContactNavigation" }
}
if (-not $feed.Contains('filter(user => user.online === true)') -or -not $feed.Contains('No users are online right now.')) {
  Add-Failure 'Online Users: the right panel can show offline contacts as online-directory results'
}
$sessionActivityJs = Get-Content -LiteralPath (Join-Path $root 'assets\session-activity.js') -Raw -Encoding utf8
$profileEditorJs = Get-Content -LiteralPath (Join-Path $root 'assets\profile-editor.js') -Raw -Encoding utf8
if (-not $profileEditorJs.Contains('purpose: "profile"') -or $profileEditorJs.Contains('await discardCloudMedia(')) {
  Add-Failure 'Profile media must use permanent uploads and retain files after ambiguous save failures'
}
$pushNotificationsJs = Get-Content -LiteralPath (Join-Path $root 'assets\push-notifications.js') -Raw -Encoding utf8
foreach ($pushPromptControl in @('Never miss a DanzStak call', 'setTimeout(showPermissionPrompt, 12000)', 'danzstak_push_prompt_dismissed', 'new URLSearchParams(location.search).get("embedded")')) {
  if (-not $pushNotificationsJs.Contains($pushPromptControl)) { Add-Failure "Push alerts: permission prompt behavior is missing: $pushPromptControl" }
}
foreach ($pushPromptPage in @('feed.html', 'profile.html', 'messages.html')) {
  $pushMarkup = Get-Content -LiteralPath (Join-Path $root $pushPromptPage) -Raw -Encoding utf8
  if (-not $pushMarkup.Contains('assets/push-notifications.js?v=')) { Add-Failure "${pushPromptPage}: background alert setup is not loaded" }
  if (-not $pushMarkup.Contains('assets/incoming-calls.css?v=')) { Add-Failure "${pushPromptPage}: background alert prompt styling is not loaded" }
}
$profileMarkup = Get-Content -LiteralPath (Join-Path $root 'profile.html') -Raw -Encoding utf8
foreach ($profileShell in @('background:#f0f2f5', 'class="header-actions"', 'href="messages.html">Messages</a>', 'aria-label="Account navigation"')) {
  if (-not $profileMarkup.Contains($profileShell)) { Add-Failure "Profiles: familiar responsive navigation shell is missing: $profileShell" }
}
foreach ($notificationHistoryUi in @('notice.unread !== false', 'row.classList.toggle("is-read"', 'notificationSourceCounts.engagement = 0')) {
  if (-not $feedEnhancements.Contains($notificationHistoryUi)) { Add-Failure "Notifications: read history behavior is missing: $notificationHistoryUi" }
}
foreach ($protectedProfileMedia in @('if (stored.mediaUrl)', 'stored.mediaKey && !viewingOtherProfile')) {
  if (-not $profileEditorJs.Contains($protectedProfileMedia)) { Add-Failure "Profiles: media authorization safeguard is missing: $protectedProfileMedia" }
}
foreach ($settingsBehavior in @('danzstak_reduce_motion', 'danzstak_data_saver', 'Stay signed in until you sign out', '"Account", logout', 'Settings saved to your DanzStak account.', 'darkMode: darkCheckbox.checked', 'language: language.value')) {
  if (-not $feedEnhancements.Contains($settingsBehavior)) { Add-Failure "Settings: persistent control is missing: $settingsBehavior" }
}
foreach ($dataSaverBehavior in @('function applyDataSaver(enabled)', '!document.hidden && !dataSaverEnabled()', 'video.autoplay = !dataSaverEnabled()', 'load.textContent = "Load " + reel.platform + " video"', 'load.replaceWith(createFrame())')) {
  if (-not $feedEnhancements.Contains($dataSaverBehavior)) { Add-Failure "Settings: Data saver does not control active Story or Reel media: $dataSaverBehavior" }
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
if ($sessionActivityJs.Contains('logoutIfIdle') -or $sessionActivityJs.Contains('/auth/logout')) { Add-Failure 'Sessions: inactivity still signs users out' }
if (-not $sessionActivityJs.Contains('/auth/refresh')) { Add-Failure 'Sessions: persistent session refresh is missing' }
foreach ($profileFeature in @('loadProfilePosts(false)', 'loadProfilePosts(true)', 'loadProfileFriends()', 'profile-friend-card', 'profile-post-card')) {
  if (-not $profileEditorJs.Contains($profileFeature)) { Add-Failure "Profile tabs are not functional: $profileFeature" }
}
foreach ($accessibilityFeature in @('tabs.setAttribute("role", "tablist")', 'button.setAttribute("aria-selected"', 'ArrowLeft', 'ArrowRight')) {
  if (-not $profileEditorJs.Contains($accessibilityFeature)) { Add-Failure "Profile tab keyboard accessibility is missing: $accessibilityFeature" }
}
foreach ($profilePresenceFeature in @(
  'const [friendsResult, directoryResult] = await Promise.allSettled([',
  'user.online === true',
  'profile-friend-presence online',
  'status.setAttribute("aria-label", status.title)'
)) {
  if (-not ($profileEditorJs + $profileStyles).Contains($profilePresenceFeature)) {
    Add-Failure "Profile friends lack resilient accessible online status: $profilePresenceFeature"
  }
}

$profileJs = Get-Content -LiteralPath (Join-Path $root 'assets\profile.js') -Raw -Encoding utf8
if (-not $profileJs.Contains('isOther ? "Private" : (email || "Not available")') -or
    -not $profileJs.Contains('avatar.classList.remove("has-photo")') -or
    -not $profileJs.Contains('cover.classList.remove("has-photo")') -or
    -not $profileEditorJs.Contains('if (!viewingOtherProfile) {')) {
  Add-Failure 'Profiles: another member can inherit local profile media or expose their email'
}
if (-not $feed.Contains('authorLabel.href = isOwner === true ? "profile.html" : "profile.html?member=" + encodeURIComponent(authorMemberId);')) {
  Add-Failure 'Profiles: an owner post routes the author back to a non-editable other-user profile'
}
foreach ($privateProfileLinkSource in @($feed, $feedEnhancements, $profileEditorJs, (Get-Content -LiteralPath (Join-Path $root 'assets\people-search.js') -Raw -Encoding utf8))) {
  if ($privateProfileLinkSource.Contains('profile.html?user=')) { Add-Failure 'Profiles: a public profile link exposes a member email address' }
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
$homeJs = Get-Content -LiteralPath (Join-Path $root 'assets\home.js') -Raw -Encoding utf8
foreach ($legalSignupControl in @('/auth/legal-acceptance', 'termsAccepted: true', 'privacyAcknowledged: true', 'credentials: "include"')) {
  if (-not $homeJs.Contains($legalSignupControl)) { Add-Failure "Signup: legal acceptance is not saved server-side before Cognito signup: $legalSignupControl" }
}
if (-not $chatCss.Contains('.conversation-header[hidden]{display:none!important}')) {
  Add-Failure 'chat.css: hidden conversation header exposes call controls before selecting a contact'
}

$messagesHtml = Get-Content -LiteralPath (Join-Path $root 'messages.html') -Raw -Encoding utf8
$chatJs = Get-Content -LiteralPath (Join-Path $root 'assets\chat.js') -Raw -Encoding utf8
$incomingCallsJs = Get-Content -LiteralPath (Join-Path $root 'assets\incoming-calls.js') -Raw -Encoding utf8
foreach ($callLifecycleControl in @('callTimer=setTimeout', 'No answer from ', 'clearTimeout(callTimer)')) {
  if (-not $chatJs.Contains($callLifecycleControl)) { Add-Failure "Calls: unanswered-call timeout is missing: $callLifecycleControl" }
}
foreach ($globalCallControl in @('event.signalType === "hangup" && event.callId === current.callId', 'await acknowledge(current.eventId)', 'await acknowledge(ended.eventId)')) {
  if (-not $incomingCallsJs.Contains($globalCallControl)) { Add-Failure "Calls: canceled global incoming call is not cleared: $globalCallControl" }
}
if ($incomingCallsJs.Contains('if (drawer && !drawer.hidden) return;') -or
    -not $chatJs.Contains('embeddedMode=messageParams.get("embedded")==="1"') -or
    -not $chatJs.Contains('if(!embeddedMode||autoAnswer)poll()') -or
    -not $chatJs.Contains('if(!embeddedMode||autoAnswer||peer||pending)poll()')) {
  Add-Failure 'Calls: an open embedded conversation can hide incoming calls or compete with the parent call watcher'
}
$correctPublishingStatus = 'Publishing' + [char]0x2026
if (-not $feed.Contains($correctPublishingStatus)) {
  Add-Failure 'Stories: publishing status contains corrupted text encoding'
}
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
foreach ($deletedChatControl in @('function closeConversation(', 'shownMessages.clear()', 'danzstak-chat-view", open: false', 'closeConversation({ focusList: true })')) {
  if (-not $directMessagesJs.Contains($deletedChatControl)) { Add-Failure "Messaging: deleting or closing a chat leaves stale conversation state: $deletedChatControl" }
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
foreach ($postMenuAccessibility in @('menu.setAttribute("role", "menu")', 'button.setAttribute("role", "menuitem")', 'toggle.setAttribute("aria-controls", menu.id)', 'toggle.setAttribute("aria-haspopup", "menu")', 'event.key === "Escape"', '"ArrowDown", "ArrowUp", "Home", "End"', '.post-options-menu:not([hidden])')) {
  if (-not $feedEnhancementsJs.Contains($postMenuAccessibility)) { Add-Failure "Post menu: keyboard or assistive-technology behavior is missing: $postMenuAccessibility" }
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
    -not $feedEnhancementsJs.Contains('if ((featurePanel.dataset?.workspaceName || featureHeading.textContent) === "Notifications") renderWorkspace("Notifications")')) {
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
if (-not $feedEnhancementsJs.Contains('readDevicePreference("danzstak_dark_mode") === "1"') -or
    -not $feedEnhancementsJs.Contains('document.documentElement.lang = readDevicePreference("danzstak_language") || "en"')) {
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
    -not (Get-Content (Join-Path $root 'assets/text-emojis.js') -Raw).Contains("button.setAttribute('aria-label','Insert '+emoji)")) {
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
foreach ($savedChatBehavior in @('let activeCanContact = false', 'conversation.canContact !== false', 'data.canContact !== false', 'Saved chat. Become friends or join the same group', 'call.disabled = conversation.canContact === false')) {
  if (-not $directMessagesJs.Contains($savedChatBehavior)) { Add-Failure "Messages: saved history or disabled contact actions are incomplete: $savedChatBehavior" }
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
foreach ($groupFeature in @('fetch("https://api.danzstak.com/groups"', 'communityStandards: true', 'method: "DELETE"', 'const migration = await migrateLocalGroups(customGroups, cloud)', 'saved.CustomGroups = migration.pending')) {
  if (-not $feedEnhancements.Contains($groupFeature)) { Add-Failure "Groups are not durable across devices: $groupFeature" }
}
foreach ($workspaceRouting in @('const workspaceRoutes = new Map(', 'history.pushState({ workspace: canonicalName }', 'addEventListener("popstate", restoreWorkspaceRoute)', 'restoreWorkspaceRoute();')) {
  if (-not $feedEnhancements.Contains($workspaceRouting)) { Add-Failure "Feed workspaces do not support refresh and Back/Forward navigation: $workspaceRouting" }
}
foreach ($workspaceAccessibility in @('control.setAttribute("aria-current", "page")', 'featureHeading.tabIndex = -1', 'featureHeading.focus({ preventScroll: true })')) {
  if (-not $feedEnhancements.Contains($workspaceAccessibility)) { Add-Failure "Feed workspaces do not announce navigation accessibly: $workspaceAccessibility" }
}
foreach ($workspaceDestination in @('href="#friends"', 'href="#photos"', 'href="#videos"', 'href="#events"', 'href="#settings"')) {
  if (-not $feed.Contains($workspaceDestination)) { Add-Failure "Feed workspace has no durable navigation destination: $workspaceDestination" }
}
if ($feed.Contains('This DanzStak section is being prepared.') -or $feed.Contains('const featureCopy =')) {
  Add-Failure 'Feed workspaces still run the retired placeholder click handler before the functional router'
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
foreach ($editHistoryBehavior in @('article.dataset.editHistory = JSON.stringify', 'post.editHistory', 'post.dataset.editHistory || "[]"', 'data.editHistory', 'new Date(item.editedAt).toLocaleString()')) {
  if (-not ($feed + $feedEnhancementsJs).Contains($editHistoryBehavior)) { Add-Failure "Post edit history is not durable across refreshes: $editHistoryBehavior" }
}
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
