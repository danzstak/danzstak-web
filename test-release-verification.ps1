$ErrorActionPreference = 'Stop'
$parseErrors = $null
$tokens = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'aws-publish-site.ps1'), [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw 'Publisher PowerShell syntax is invalid.' }
$definition = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Wait-ForPublishedWorker' }, $true)
Invoke-Expression $definition.Extent.Text
function Start-Sleep { param($Seconds) }
function Invoke-WebRequest {
  param($Uri, $Headers, [switch]$UseBasicParsing, $TimeoutSec)
  $script:workerChecks++
  $next = $script:workerResponses.Dequeue()
  if ($next -eq 'network-error') { throw 'Temporary connection failure' }
  return @{ Content = $next }
}
function Set-TestResponses($Values) {
  $script:workerChecks = 0
  $script:workerResponses = [System.Collections.Generic.Queue[string]]::new()
  foreach ($value in $Values) { $script:workerResponses.Enqueue($value) }
}
Set-TestResponses @('old-release', 'danzstak-shell-v175')
Wait-ForPublishedWorker -Url 'https://example.test/service-worker.js' -ExpectedCache 'danzstak-shell-v175' -MaxAttempts 3 -RetrySeconds 0
if ($script:workerChecks -ne 2) { throw 'Propagation delay was not retried.' }
Set-TestResponses @('network-error', 'danzstak-shell-v175')
Wait-ForPublishedWorker -Url 'https://example.test/service-worker.js' -ExpectedCache 'danzstak-shell-v175' -MaxAttempts 3 -RetrySeconds 0
if ($script:workerChecks -ne 2) { throw 'Temporary network error was not retried.' }
Set-TestResponses @('old-release', 'old-release', 'old-release')
$failed = $false
try { Wait-ForPublishedWorker -Url 'https://example.test/service-worker.js' -ExpectedCache 'danzstak-shell-v175' -MaxAttempts 3 -RetrySeconds 0 }
catch { $failed = $true }
if (-not $failed -or $script:workerChecks -ne 3) { throw 'A permanently wrong release must fail within the configured limit.' }
Write-Host 'Release verification checks passed: propagation delay, network recovery, and bounded failure.'
