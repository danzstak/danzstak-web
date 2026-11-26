# Keeps the Windows runner's own network from failing browser checks (CI-FLAKE, 2026-11-26).
#
# Why: docs-only PR #775 failed events-page.cjs with "targets under 44px" because assets/events-page.css never loaded:
# Chrome got net::ERR_NO_BUFFER_SPACE (WSAENOBUFS) from the runner about 90 checks into the job. Every browser a check
# opens closes its connections to the local server first, so each connection then waits in TIME_WAIT on an ephemeral
# port for about two minutes (measured: pivot-header.cjs alone leaves about 140). Windows hands out only 16,384
# ephemeral ports (49152-65535) by default, and one job opens and closes browsers for over half an hour.
#
#   .\scripts\ci-network.ps1 -Prepare   before the checks: widen the ephemeral range to 10000-65535 (55,536 ports;
#                                        the review servers on 8017 and 8132 stay below it, so no outgoing
#                                        connection can take their port)
#   .\scripts\ci-network.ps1 -Report    after the checks (always): count connections by state, so the next failure
#                                        shows whether the runner was short of ports
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
}
