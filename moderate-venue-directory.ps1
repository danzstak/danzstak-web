param(
  [ValidateSet("List", "Approve", "Reject")]
  [string]$Action = "List",
  [string]$TicketId
)

$ErrorActionPreference = "Stop"
$Region = "us-west-1"
$ReviewTable = "DANZSTAK-SupportTickets"
$DirectoryTable = "DANZSTAK-VenueDirectory"
$TempFiles = @()

function New-JsonFile($Value) {
  $path = Join-Path $env:TEMP ("danzstak-venue-" + [guid]::NewGuid().ToString("N") + ".json")
  $Value | ConvertTo-Json -Depth 12 -Compress | Set-Content -LiteralPath $path -Encoding ascii
  $script:TempFiles += $path
  return $path
}

try {
  if ($Action -eq "List") {
    $listNamesFile = New-JsonFile @{ "#status" = "status" }
    $listValuesFile = New-JsonFile @{ ":category" = @{ S = "venue-directory" }; ":status" = @{ S = "pending-review" } }
    $result = aws dynamodb scan --region $Region --table-name $ReviewTable --filter-expression "category = :category AND #status = :status" --expression-attribute-names "file://$listNamesFile" --expression-attribute-values "file://$listValuesFile" --output json | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw "Venue review queue could not be read." }
    $rows = foreach ($item in $result.Items) {
      $venue = $item.message.S | ConvertFrom-Json
      [pscustomobject]@{ TicketId = $item.ticketId.S; Name = $venue.name; Address = $venue.address; Website = $venue.website; Email = $venue.email; Phone = $venue.phone; Submitted = $item.createdAt.S }
    }
    $rows | Sort-Object Submitted | Format-Table -AutoSize
    return
  }

  if ([string]::IsNullOrWhiteSpace($TicketId) -or $TicketId -notmatch '^venue-[a-f0-9]{20}-[a-f0-9]{8}$') { throw "Provide the exact venue review TicketId." }
  $keyFile = New-JsonFile @{ ticketId = @{ S = $TicketId } }
  $record = aws dynamodb get-item --region $Region --table-name $ReviewTable --key "file://$keyFile" --consistent-read --output json | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0 -or -not $record.Item) { throw "Venue review ticket was not found." }
  if ($record.Item.category.S -ne "venue-directory" -or -not $record.Item.publicVenueCertified.BOOL) { throw "This is not a certified public-venue review ticket." }

  $status = if ($Action -eq "Approve") { "approved" } else { "rejected" }
  if ($Action -eq "Approve") {
    $venue = $record.Item.message.S | ConvertFrom-Json
    if (-not $venue.venueKey -or -not $venue.name -or -not $venue.address -or $venue.position.Count -ne 2) { throw "Venue review data is incomplete." }
    $item = @{
      venueKey = @{ S = [string]$venue.venueKey }; name = @{ S = [string]$venue.name }; address = @{ S = [string]$venue.address }
      locality = @{ S = [string]$venue.locality }; longitude = @{ N = [string]$venue.position[0] }; latitude = @{ N = [string]$venue.position[1] }
      categories = @{ SS = @("Member-verified public live music venue") }; status = @{ S = "approved" }
      createdAt = @{ S = [string]$record.Item.createdAt.S }; approvedAt = @{ S = [DateTime]::UtcNow.ToString("o") }; sourceTicketId = @{ S = $TicketId }
    }
    if ($venue.website) { $item.website = @{ S = [string]$venue.website } }
    if ($venue.email) { $item.email = @{ S = [string]$venue.email } }
    if ($venue.phone) { $item.phone = @{ S = [string]$venue.phone } }
    $itemFile = New-JsonFile $item
    $putValuesFile = New-JsonFile @{ ":ticket" = @{ S = $TicketId } }
    aws dynamodb put-item --region $Region --table-name $DirectoryTable --item "file://$itemFile" --condition-expression "attribute_not_exists(venueKey) OR sourceTicketId = :ticket" --expression-attribute-values "file://$putValuesFile" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Approved venue could not be saved." }
  }

  $valuesFile = New-JsonFile @{ ":status" = @{ S = $status }; ":reviewed" = @{ S = [DateTime]::UtcNow.ToString("o") }; ":pending" = @{ S = "pending-review" } }
  $statusNamesFile = New-JsonFile @{ "#status" = "status" }
  aws dynamodb update-item --region $Region --table-name $ReviewTable --key "file://$keyFile" --update-expression "SET #status = :status, reviewedAt = :reviewed" --condition-expression "#status = :pending" --expression-attribute-names "file://$statusNamesFile" --expression-attribute-values "file://$valuesFile" --output json | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Venue review status could not be updated." }
  Write-Host "$TicketId is now $status."
} finally {
  foreach ($path in $TempFiles) { Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue }
}
