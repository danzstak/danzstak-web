# Review browser checks must never reach the live DanzStak API (L1, 2026-11-23).
#
# The Auth API's access logs (turned on for L1) showed bursts of 401s on GET /profiles, /phone-verification,
# /calls/devices and /settings/sync-prefs with no /auth/session or /auth/refresh: the same picture as the Washington
# tester's failure. They came from these review jobs. A check that mocks only part of the API (or none of it, like
# ringback-loudness.cjs) let a page loaded from 127.0.0.1 call https://api.danzstak.com for real. That fakes the failure
# we're looking for in the live logs and sends test traffic to the members' API.
#
# This points api.danzstak.com at an address nothing answers on, on the CI runner only. A check's page.route() mocks
# still answer first (Playwright fulfils them before any DNS lookup), so only the calls a check didn't mock fail, the way
# they already do in a session that can't reach the API. The live-check workflow is separate and is not touched.
$ErrorActionPreference = 'Stop'

$names = @('api.danzstak.com')
if ($IsWindows) {
  $hostsFile = Join-Path $env:SystemRoot 'System32\drivers\etc\hosts'
} else {
  $hostsFile = '/etc/hosts'
}

$entries = foreach ($name in $names) { "0.0.0.0 $name"; ":: $name" }
$block = @('', '# DanzStak review checks: never call the live API (scripts/block-live-api.ps1)') + $entries
Add-Content -LiteralPath $hostsFile -Value $block
if ($IsWindows) { Clear-DnsClientCache }

# Prove it: every name must now resolve only to the dead addresses (or not at all).
foreach ($name in $names) {
  $probe = "require('dns').lookup('$name',{all:true},(e,a)=>{if(e){console.log('$name does not resolve ('+e.code+')');return}" +
    "const live=a.filter(x=>x.address!=='0.0.0.0'&&x.address!=='::');" +
    "if(live.length){console.error('$name still resolves to '+live.map(x=>x.address).join(', '));process.exit(1)}" +
    "console.log('$name -> '+a.map(x=>x.address).join(', ')+' (blocked)')})"
  node -e $probe
  if ($LASTEXITCODE -ne 0) { throw "The live API is still reachable from the review checks: $name" }
}
