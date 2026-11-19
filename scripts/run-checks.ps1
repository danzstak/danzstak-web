# Runs every check in the list, keeps going after a failure, then fails if any check failed.
#
# Why: a pwsh `run:` block that lists several commands only fails on the LAST command's exit code, so in
# review.yml every check except the last one in each block went unenforced (release-train run 44503523581 was
# green with nine failing browser checks). Use this for any step that runs more than one check:
#
#   .\scripts\run-checks.ps1 -Checks @(
#     '.\browser-checks\account-security.cjs'
#     '.\browser-checks\booking-sync.cjs http://127.0.0.1:8132'
#     '.\test-site.ps1'
#   )
#
# Each entry is a script path plus optional arguments separated by spaces. .cjs/.mjs/.js run with node; .ps1 runs
# in its own pwsh process (exit N -> N, an uncaught throw -> 1, normal end -> 0), so a stale $LASTEXITCODE or a
# throw inside one script can neither pass nor stop the others. Output of each check is folded into a log group;
# every failure is also an ::error annotation and a line in the job summary. Outside GitHub Actions it prints plain
# headers instead of workflow commands. Behaviour is covered by test-run-checks.ps1 (regression suite).
param(
  [Parameter(Mandatory = $true)]
  [string[]]$Checks
)

$ErrorActionPreference = 'Continue'
$onActions = $env:GITHUB_ACTIONS -eq 'true'
$pwshPath = (Get-Process -Id $PID).Path
$results = [System.Collections.Generic.List[object]]::new()

foreach ($check in $Checks) {
  $parts = @(-split $check)
  if ($parts.Count -eq 0) { continue }
  $script = $parts[0]
  $arguments = @($parts | Select-Object -Skip 1)
  $started = Get-Date
  if ($onActions) { Write-Host "::group::$check" } else { Write-Host "--- $check" }
  $global:LASTEXITCODE = 0
  try {
    if (-not (Test-Path -LiteralPath $script -PathType Leaf)) { throw "Check file not found: $script" }
    if ($script -like '*.ps1') {
      & $pwshPath -NoProfile -NonInteractive -File $script @arguments
    } else {
      & node $script @arguments
    }
    $code = $LASTEXITCODE
  } catch {
    Write-Host $_
    $code = 1
  }
  if ($onActions) { Write-Host '::endgroup::' }
  $seconds = [math]::Round(((Get-Date) - $started).TotalSeconds)
  if ($code -eq 0) {
    Write-Host "PASS  $check  (${seconds}s)"
  } else {
    if ($onActions) { Write-Host "::error title=Check failed::$check exited with code $code" }
    Write-Host "FAIL  $check  (exit $code, ${seconds}s)"
  }
  $results.Add([pscustomobject]@{ Check = $check; Code = $code; Seconds = $seconds })
}

$failed = @($results | Where-Object { $_.Code -ne 0 })
Write-Host ''
Write-Host "$($results.Count - $failed.Count) of $($results.Count) checks passed."

if ($env:GITHUB_STEP_SUMMARY) {
  $lines = @("### $($results.Count - $failed.Count) of $($results.Count) checks passed", '', '| Result | Check | Time |', '|---|---|---|')
  foreach ($result in $results) {
    $mark = if ($result.Code -eq 0) { 'pass' } else { "**FAIL** (exit $($result.Code))" }
    $lines += "| $mark | ``$($result.Check)`` | $($result.Seconds)s |"
  }
  $lines += ''
  Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY -Value $lines
}

if ($failed.Count -gt 0) {
  throw "$($failed.Count) of $($results.Count) checks failed: $(($failed | ForEach-Object { $_.Check }) -join '; ')"
}
