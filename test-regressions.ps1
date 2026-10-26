$ErrorActionPreference = 'Stop'

Push-Location -LiteralPath $PSScriptRoot
try {
  foreach ($test in (Get-ChildItem -LiteralPath $PSScriptRoot -Filter 'test-*.cjs' -File | Sort-Object Name)) {
    Write-Host "Running $($test.Name)..."
    & node $test.FullName
    if ($LASTEXITCODE -ne 0) { throw "Regression failed: $($test.Name)" }
  }

  foreach ($name in @('test-release-verification.ps1', 'test-site.ps1', 'test-infrastructure.ps1')) {
    Write-Host "Running $name..."
    & (Join-Path $PSScriptRoot $name)
    if ($LASTEXITCODE -ne 0) { throw "Regression failed: $name" }
  }
  Write-Host 'All local DanzStak regression checks passed.'
} finally {
  Pop-Location
}
