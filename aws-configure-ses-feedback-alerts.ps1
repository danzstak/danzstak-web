param(
  [string]$Region = "us-west-1",
  [string]$AlertAddress = "danzstak@gmail.com"
)

$ErrorActionPreference = "Stop"
$TopicName = "DANZSTAK-SES-Bounce-Complaint-Alerts"
$ConfigurationSet = "DanzStakTourManager"
$DestinationName = "OwnerBounceComplaintAlerts"
$DestinationFile = Join-Path $env:TEMP "danzstak-ses-feedback-alerts.json"

function Assert-Success([string]$Message) { if ($LASTEXITCODE -ne 0) { throw $Message } }

try {
  aws sts get-caller-identity --region $Region --output json | Out-Null
  Assert-Success "AWS authentication is missing or expired. Run aws login."
  $topicArn = aws sns create-topic --region $Region --name $TopicName --query TopicArn --output text
  Assert-Success "The DanzStak SES feedback topic could not be created or resolved."

  $subscriptions = aws sns list-subscriptions-by-topic --region $Region --topic-arn $topicArn --output json | ConvertFrom-Json
  $obsolete = @($subscriptions.Subscriptions | Where-Object { $_.Protocol -eq "email" -and $_.Endpoint -ne $AlertAddress })
  foreach ($subscription in $obsolete) {
    if ($subscription.SubscriptionArn -and $subscription.SubscriptionArn -ne "PendingConfirmation") {
      aws sns unsubscribe --region $Region --subscription-arn $subscription.SubscriptionArn
      Assert-Success "An obsolete SES feedback email subscription could not be removed."
    }
  }
  $current = @($subscriptions.Subscriptions | Where-Object { $_.Protocol -eq "email" -and $_.Endpoint -eq $AlertAddress })
  if ($current.Count -eq 0) {
    aws sns subscribe --region $Region --topic-arn $topicArn --protocol email --notification-endpoint $AlertAddress --return-subscription-arn --output json | Out-Null
    Assert-Success "The DanzStak Gmail feedback subscription could not be requested."
  }

  @{
    Enabled = $true
    MatchingEventTypes = @("BOUNCE", "COMPLAINT", "REJECT")
    SnsDestination = @{ TopicArn = [string]$topicArn }
  } | ConvertTo-Json -Depth 5 -Compress | Set-Content -LiteralPath $DestinationFile -Encoding ascii
  $existingDestination = aws sesv2 get-configuration-set-event-destinations --region $Region --configuration-set-name $ConfigurationSet --query "EventDestinations[?Name=='$DestinationName'].Name | [0]" --output text 2>$null
  if ($LASTEXITCODE -eq 0 -and $existingDestination -eq $DestinationName) {
    aws sesv2 update-configuration-set-event-destination --region $Region --configuration-set-name $ConfigurationSet --event-destination-name $DestinationName --event-destination "file://$DestinationFile" --output json | Out-Null
  } else {
    aws sesv2 create-configuration-set-event-destination --region $Region --configuration-set-name $ConfigurationSet --event-destination-name $DestinationName --event-destination "file://$DestinationFile" --output json | Out-Null
  }
  Assert-Success "SES bounce and complaint alert routing could not be configured."
  Write-Host "SES bounce, complaint and reject alerts now target $AlertAddress. Confirm the SNS subscription from that inbox if it is pending."
} finally {
  Remove-Item -LiteralPath $DestinationFile -Force -ErrorAction SilentlyContinue
}
