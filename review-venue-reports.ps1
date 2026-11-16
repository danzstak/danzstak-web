param(
  [ValidateSet("List", "ConfirmClosed", "Reopen", "Dismiss")]
  [string]$Action = "List",
  [string]$VenueKey,
  [string]$ReportId
)
# Owner review of member venue reports (task 07): "This club closed" and "Changed booker".
# List shows pending reports. ConfirmClosed hides the venue for everyone; Reopen clears wrong closed reports;
# Dismiss closes one report without changing the venue. New booker contacts are never applied automatically:
# verify them on the venue's own public site before adding them to the reviewed directory.

$ErrorActionPreference = "Stop"
$Region = "us-west-1"
$Table = "DANZSTAK-Tours"
$TempFiles = @()

function New-JsonFile($Value) {
  $path = Join-Path $env:TEMP ("danzstak-venue-report-" + [guid]::NewGuid().ToString("N") + ".json")
  $Value | ConvertTo-Json -Depth 12 -Compress | Set-Content -LiteralPath $path -Encoding ascii
  $script:TempFiles += $path
  return $path
}

try {
  $now = (Get-Date).ToUniversalTime().ToString("o")
  if ($Action -eq "List") {
    $values = New-JsonFile @{ ":owner" = @{ S = "BOOKING#VENUE_REPORT" }; ":pending" = @{ S = "pending" } }
    $names = New-JsonFile @{ "#status" = "status" }
    $result = aws dynamodb query --region $Region --table-name $Table --key-condition-expression "userId = :owner" --filter-expression "#status = :pending" --expression-attribute-values "file://$values" --expression-attribute-names "file://$names" --output json | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw "Venue reports could not be read." }
    $result.Items | ForEach-Object {
      [pscustomobject]@{ ReportId = $_.tourId.S; Venue = $_.venueName.S; VenueKey = $_.venueKey.S; Kind = $_.kind.S; NewEmail = $_.contactEmail.S; NewPage = $_.contactUrl.S; Note = $_.note.S; Reported = $_.createdAt.S }
    } | Sort-Object Reported | Format-Table -AutoSize
    return
  }

  if ($Action -eq "Dismiss") {
    if ([string]::IsNullOrWhiteSpace($ReportId)) { throw "Provide the exact ReportId from List." }
    $key = New-JsonFile @{ userId = @{ S = "BOOKING#VENUE_REPORT" }; tourId = @{ S = $ReportId } }
    $values = New-JsonFile @{ ":done" = @{ S = "dismissed" }; ":at" = @{ S = $now } }
    aws dynamodb update-item --region $Region --table-name $Table --key "file://$key" --update-expression "SET #status = :done, reviewedAt = :at" --condition-expression "attribute_exists(userId)" --expression-attribute-names '{\"#status\":\"status\"}' --expression-attribute-values "file://$values" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Report could not be dismissed." }
    Write-Host "Dismissed $ReportId."
    return
  }

  if ([string]::IsNullOrWhiteSpace($VenueKey) -or $VenueKey -notmatch '^[a-zA-Z0-9_.:-]{6,240}$') { throw "Provide the exact VenueKey from List." }
  $key = New-JsonFile @{ userId = @{ S = "BOOKING#VENUE_SIGNAL" }; tourId = @{ S = $VenueKey } }
  if ($Action -eq "ConfirmClosed") {
    $values = New-JsonFile @{ ":status" = @{ S = "closed" }; ":at" = @{ S = $now } }
    aws dynamodb update-item --region $Region --table-name $Table --key "file://$key" --update-expression "SET ownerStatus = :status, ownerReviewedAt = :at" --expression-attribute-values "file://$values" | Out-Null
  } else {
    # Reopen clears the closed flag and the old reports; new reports count from zero.
    $values = New-JsonFile @{ ":at" = @{ S = $now } }
    aws dynamodb update-item --region $Region --table-name $Table --key "file://$key" --update-expression "SET ownerReviewedAt = :at REMOVE ownerStatus, closedReports, closedReportedAt" --expression-attribute-values "file://$values" | Out-Null
  }
  if ($LASTEXITCODE -ne 0) { throw "Venue status could not be saved." }
  Write-Host "$VenueKey updated ($Action). Dismiss its reports once handled."
} finally {
  foreach ($file in $TempFiles) { Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue }
}
