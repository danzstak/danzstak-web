$ErrorActionPreference = 'Stop'

$templatePath = Join-Path $PSScriptRoot 'infrastructure\call-signaling\template.yaml'
$template = Get-Content -LiteralPath $templatePath -Raw -Encoding utf8
$templateBytes = [Text.Encoding]::UTF8.GetByteCount($template)
if ($templateBytes -gt 51200) {
  throw "CloudFormation template is $templateBytes bytes; inline validation accepts at most 51200 bytes."
}

$lines = Get-Content -LiteralPath $templatePath -Encoding utf8
$zipLine = $lines | Select-String '^        ZipFile: \|$' | Select-Object -First 1
if (-not $zipLine) { throw 'Embedded Lambda ZipFile block was not found.' }

$codeLines = [System.Collections.Generic.List[string]]::new()
for ($index = $zipLine.LineNumber; $index -lt $lines.Count; $index++) {
  $line = $lines[$index]
  if ($line -notmatch '^          ') { break }
  $codeLines.Add($line.Substring(10))
}
if ($codeLines.Count -eq 0) { throw 'Embedded Lambda ZipFile block is empty.' }

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw 'Node.js is required for the embedded Lambda syntax check.' }
$codeLines -join "`n" | & $node.Source --check -
if ($LASTEXITCODE -ne 0) { throw 'Embedded Lambda JavaScript syntax check failed.' }

$requiredMessagingProtections = @(
  "hiddenBefore = :deleted",
  ".filter(x=>x.createdAt.S>hiddenBefore)",
  ".filter(x=>x.preview?.S)",
  "conversationUpdate(recipient,user.email)"
)
foreach ($protection in $requiredMessagingProtections) {
  if (-not $template.Contains($protection)) {
    throw "Messaging privacy protection is missing: $protection"
  }
}

Write-Host "Infrastructure checks passed ($templateBytes-byte template; embedded Lambda syntax valid)."
