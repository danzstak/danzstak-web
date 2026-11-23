$ErrorActionPreference = 'Stop'

# Behaviour of scripts/run-checks.ps1, run the way a GitHub Actions pwsh step runs it: ErrorActionPreference 'stop',
# the script dot-sourced with -Command, then `exit $LASTEXITCODE`. Before the runner existed a step listing several
# checks failed only on the last one; this proves every failure counts, even when the last check passes.
$runner = Join-Path $PSScriptRoot 'scripts/run-checks.ps1'
$pwshPath = (Get-Process -Id $PID).Path
$work = Join-Path ([System.IO.Path]::GetTempPath()) ("danzstak-run-checks-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $work | Out-Null

function Invoke-Step([string[]]$checks) {
  $quoted = ($checks | ForEach-Object { "'" + $_.Replace("'", "''") + "'" }) -join ', '
  $step = Join-Path $work 'step.ps1'
  Set-Content -LiteralPath $step -Value @(
    "`$ErrorActionPreference = 'stop'",
    "`$PSStyle.OutputRendering = 'PlainText'",
    "Set-Location -LiteralPath '$($work.Replace("'", "''"))'",
    "& '$($runner.Replace("'", "''"))' -Checks @($quoted)",
    "if ((Test-Path -LiteralPath variable:\LASTEXITCODE)) { exit `$LASTEXITCODE }"
  )
  $summary = Join-Path $work 'summary.md'
  Remove-Item -LiteralPath $summary -ErrorAction SilentlyContinue
  $env:GITHUB_STEP_SUMMARY = $summary
  $output = & $pwshPath -NoProfile -NonInteractive -Command ". '$($step.Replace("'", "''"))'" 2>&1 | Out-String
  $code = $LASTEXITCODE
  $env:GITHUB_STEP_SUMMARY = $null
  $table = if (Test-Path -LiteralPath $summary) { Get-Content -LiteralPath $summary -Raw } else { '' }
  return [pscustomobject]@{ Output = $output; Code = $code; Summary = $table }
}

function Assert-Step($step, [bool]$condition, [string]$message) {
  if (-not $condition) { throw "$message`n----- step output -----`n$($step.Output.Replace('::', '[::]'))" }
}

$savedActions = $env:GITHUB_ACTIONS
try {
  $env:GITHUB_ACTIONS = 'true'
  Set-Content -LiteralPath (Join-Path $work 'pass.cjs') -Value 'console.log("pass check ran");'
  Set-Content -LiteralPath (Join-Path $work 'fail.cjs') -Value 'console.log("fail check ran"); process.exit(3);'
  Set-Content -LiteralPath (Join-Path $work 'throws.cjs') -Value 'throw new Error("boom");'
  Set-Content -LiteralPath (Join-Path $work 'args.cjs') -Value 'process.exit(process.argv[2] === "http://127.0.0.1:8132" && process.argv[3] === "two" ? 0 : 4);'
  Set-Content -LiteralPath (Join-Path $work 'exit1.ps1') -Value 'exit 1'
  Set-Content -LiteralPath (Join-Path $work 'throws.ps1') -Value @("`$ErrorActionPreference = 'Stop'", "throw 'nope'")
  Set-Content -LiteralPath (Join-Path $work 'handled.ps1') -Value @('& node -e "process.exit(5)"', 'Write-Host "handled check ran"')
  Set-Content -LiteralPath (Join-Path $work 'ok.ps1') -Value 'Write-Host "ok check ran"'

  # Failures first and a passing check last: the old bare list would have reported success.
  $mixed = Invoke-Step @('./fail.cjs', './throws.cjs', './exit1.ps1', './throws.ps1', './missing.cjs', './args.cjs http://127.0.0.1:8132 two', './handled.ps1', './ok.ps1', './pass.cjs')
  Assert-Step $mixed ($mixed.Code -ne 0) 'a step with failing checks must fail even when its last check passes'
  foreach ($failed in @('./fail.cjs  (exit 3', './throws.cjs  (exit 1', './exit1.ps1  (exit 1', './throws.ps1  (exit 1', './missing.cjs  (exit 1')) {
    Assert-Step $mixed $mixed.Output.Contains("FAIL  $failed") "missing failure line for $failed"
  }
  foreach ($passed in @('./args.cjs http://127.0.0.1:8132 two', './handled.ps1', './ok.ps1', './pass.cjs')) {
    Assert-Step $mixed $mixed.Output.Contains("PASS  $passed") "missing pass line for $passed (arguments or later checks did not run)"
  }
  Assert-Step $mixed $mixed.Output.Contains('pass check ran') 'checks after a failure must still run'
  Assert-Step $mixed $mixed.Output.Contains('4 of 9 checks passed.') 'summary count is wrong'
  Assert-Step $mixed $mixed.Output.Contains('5 of 9 checks failed: ./fail.cjs; ./throws.cjs; ./exit1.ps1; ./throws.ps1; ./missing.cjs') 'the step must name every failed check'
  Assert-Step $mixed $mixed.Output.Contains('::error title=Check failed::./fail.cjs exited with code 3') 'failures must be annotated on GitHub Actions'
  Assert-Step $mixed $mixed.Output.Contains('::group::./pass.cjs') 'each check must get its own log group on GitHub Actions'
  Assert-Step $mixed ($mixed.Summary -match '\*\*FAIL\*\* \(exit 3\) \| `\./fail\.cjs`') 'job summary must list the failure'
  Assert-Step $mixed ($mixed.Summary -match '\| pass \| `\./pass\.cjs`') 'job summary must list the pass'

  $clean = Invoke-Step @('./pass.cjs', './ok.ps1', './args.cjs http://127.0.0.1:8132 two')
  Assert-Step $clean ($clean.Code -eq 0) 'a step whose checks all pass must succeed'
  Assert-Step $clean $clean.Output.Contains('3 of 3 checks passed.') 'passing summary count is wrong'
  Assert-Step $clean (-not $clean.Output.Contains('FAIL')) 'a passing step must not report failures'

  $env:GITHUB_ACTIONS = $null
  $local = Invoke-Step @('./pass.cjs')
  Assert-Step $local ($local.Code -eq 0 -and $local.Output.Contains('--- ./pass.cjs') -and -not $local.Output.Contains('::group::')) 'outside GitHub Actions the runner prints plain headers, not workflow commands'

  Write-Host 'Check-runner tests passed: every check runs, failures from node, .ps1 exit codes, throws and missing files fail the step even when the last check passes, and the job summary names them.'
} finally {
  $env:GITHUB_ACTIONS = $savedActions
  Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
}
