$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$failures = [System.Collections.Generic.List[string]]::new()

function Add-Failure([string]$Message) {
  $failures.Add($Message)
}

$htmlFiles = Get-ChildItem -LiteralPath $root -Filter '*.html' -File
foreach ($file in $htmlFiles) {
  $html = Get-Content -LiteralPath $file.FullName -Raw -Encoding utf8

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

$feedPath = Join-Path $root 'feed.html'
$feed = Get-Content -LiteralPath $feedPath -Raw -Encoding utf8
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

$serviceWorker = Get-Content -LiteralPath (Join-Path $root 'service-worker.js') -Raw -Encoding utf8
if ($serviceWorker -notmatch 'const CACHE = "danzstak-shell-v\d+";' -or
    $serviceWorker -notmatch 'skipWaiting\(\)' -or
    $serviceWorker -notmatch 'clients\.claim\(\)') {
  Add-Failure 'service-worker.js: installed-app cache update activation is incomplete'
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
if ($messagesHtml -notmatch 'id="receiverHangUp"[^>]+hidden' -or
    -not $chatJs.Contains('els.receiverHangup.hidden=false') -or
    -not $chatJs.Contains('els.receiverHangup.hidden=true')) {
  Add-Failure 'Call controls: receiver Hang Up visibility is not tied to active call state'
}
if (-not $feedEnhancementsJs.Contains('body: JSON.stringify({ content: post.querySelector(".post-content")?.textContent.trim() || "Shared media", audience: audiences[next] })') -or
    -not $feedEnhancementsJs.Contains('["Edit post", "Who can comment?", "Edit privacy"].includes')) {
  Add-Failure 'Post menu: privacy persistence or non-owner control filtering is incomplete'
}
if (-not $feedEnhancementsJs.Contains('https://api.danzstak.com/settings/posts') -or
    -not $feedEnhancementsJs.Contains('option("Move to archive", "Hide this post from your account."')) {
  Add-Failure 'Post menu: archived and hidden posts are not persisted to the account'
}
if (-not $directMessagesJs.Contains('if (!document.body.classList.contains("is-conversation-open")) return;') -or
    -not $directMessagesJs.Contains('/messages?read=1&contact=')) {
  Add-Failure 'Messaging: background or minimized chats can incorrectly clear unread state'
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
