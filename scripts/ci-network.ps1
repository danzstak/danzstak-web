# Keeps the Windows runner's own network from failing browser checks (CI-FLAKE, 2026-11-26).
#
# Why: docs-only PR #775 failed events-page.cjs with "targets under 44px" because assets/events-page.css never loaded:
# Chrome got net::ERR_NO_BUFFER_SPACE (WSAENOBUFS) from the runner about 90 checks into a 35-minute job. WSAENOBUFS
# means Windows had no socket buffer or port left for a new connection. Every closed browser connection waits in
# TIME_WAIT on an ephemeral port, and Windows gives 16,384 of them by default, so the range is widened as a guard.
# Measured on PR #778's first run, though, only ~300 connections were in TIME_WAIT at the end of a job, so ports
# alone don't explain it; the report below also counts what can exhaust socket buffers instead: browser and node
# processes left running, their handles, and the kernel's non-paged pool. The next failure shows which it was.
#
#   .\scripts\ci-network.ps1 -Prepare   before the checks: widen the ephemeral range to 10000-65535 (55,536 ports;
#                                        the review servers on 8017 and 8132 stay below it, so no outgoing
#                                        connection can take their port)
#   .\scripts\ci-network.ps1 -Report    after the checks (always): connections by state, leftover browser/node
#                                        processes and handles, non-paged pool
param(
  [switch]$Prepare,
  [switch]$Report
)

$ErrorActionPreference = 'Stop'
if (-not $IsWindows) { Write-Host 'ci-network.ps1: not Windows, nothing to do.'; exit 0 }

if ($Prepare) {
  # Takes effect at once for new connections; GitHub's Windows runners run as an administrator.
  & netsh int ipv4 set dynamicport tcp start=10000 num=55536 | Out-Host
  if ($LASTEXITCODE -ne 0) { throw 'Could not widen the ephemeral TCP port range.' }
  & netsh int ipv6 set dynamicport tcp start=10000 num=55536 | Out-Host
  if ($LASTEXITCODE -ne 0) { throw 'Could not widen the ephemeral TCP port range (IPv6).' }
  $range = (& netsh int ipv4 show dynamicport tcp) -join ' '
  if ($range -notmatch 'Number of Ports\s*:\s*55536') { throw "The ephemeral TCP port range did not widen: $range" }
  Write-Host "Ephemeral TCP ports: $range"
}

if ($Report) {
  $connections = @(Get-NetTCPConnection -ErrorAction SilentlyContinue)
  Write-Host "TCP connections on the runner: $($connections.Count)"
  $connections | Group-Object State | Sort-Object Count -Descending | ForEach-Object { Write-Host ("  {0,-12} {1}" -f $_.Name, $_.Count) }
  (& netsh int ipv4 show dynamicport tcp) | Out-Host
  $left = @(Get-Process -Name msedge, chrome, chromium, headless_shell, node -ErrorAction SilentlyContinue)
  Write-Host "Browser and node processes still running: $($left.Count) (handles: $(($left | Measure-Object HandleCount -Sum).Sum))"
  $left | Group-Object ProcessName | ForEach-Object { Write-Host ("  {0,-14} {1}" -f $_.Name, $_.Count) }
  try {
    $pool = (Get-Counter '\Memory\Pool Nonpaged Bytes' -ErrorAction Stop).CounterSamples[0].CookedValue
    Write-Host ("Kernel non-paged pool: {0:N0} MB" -f ($pool / 1MB))
  } catch { Write-Host "Kernel non-paged pool: not readable here" }
}
