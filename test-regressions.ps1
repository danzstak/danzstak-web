$ErrorActionPreference = 'Stop'

# Every regression check runs, even after one fails; the suite then fails and names each failed check
# (scripts/run-checks.ps1). It used to stop at the first failure, which hid every later one until that was fixed.
Push-Location -LiteralPath $PSScriptRoot
try {
  $checks = @(Get-ChildItem -LiteralPath $PSScriptRoot -Filter 'test-*.cjs' -File | Sort-Object Name | ForEach-Object { "./$($_.Name)" })
  $checks += @('test-release-verification.ps1', 'test-site.ps1', 'test-infrastructure.ps1', 'test-run-checks.ps1') | ForEach-Object { "./$_" }
  & (Join-Path $PSScriptRoot 'scripts/run-checks.ps1') -Checks $checks
  Write-Host 'All local DanzStak regression checks passed.'
} finally {
  Pop-Location
}
