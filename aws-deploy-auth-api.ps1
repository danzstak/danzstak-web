param([switch]$EnableDeviceSmsOtp)
$ErrorActionPreference = "Stop"

$Region = "us-west-1"
$FunctionName = "DANZSTAK-Auth-API"
$RoleName = "DANZSTAK-Auth-API-role-zjknf4ur"
$Source = Join-Path $PSScriptRoot "infrastructure\auth-api\index.mjs"
$TourManagerBillingSource = Join-Path $PSScriptRoot "infrastructure\auth-api\tour-manager-billing.mjs"
$MarketplaceSource = Join-Path $PSScriptRoot "infrastructure\auth-api\marketplace.mjs"
$TicketingSource = Join-Path $PSScriptRoot "infrastructure\auth-api\ticketing.mjs"
$PhoneVerificationSource = Join-Path $PSScriptRoot "infrastructure\auth-api\personal-phone-verification.mjs"
$PhoneServiceSource = Join-Path $PSScriptRoot "infrastructure\auth-api\personal-phone-service.mjs"
$PhoneDynamoSource = Join-Path $PSScriptRoot "infrastructure\auth-api\personal-phone-dynamodb.mjs"
$Package = Join-Path $PSScriptRoot "infrastructure\auth-api\package.json"
$PackageLock = Join-Path $PSScriptRoot "infrastructure\auth-api\package-lock.json"
$Bundle = Join-Path $env:TEMP "danzstak-auth-api.zip"
$Stage = Join-Path $env:TEMP ("danzstak-auth-api-" + [guid]::NewGuid().ToString("N"))
$Policy = Join-Path $env:TEMP "danzstak-auth-api-policy.json"
$Environment = Join-Path $env:TEMP "danzstak-auth-api-environment.json"
$SesEventDestination = Join-Path $env:TEMP "danzstak-tour-manager-ses-events.json"
$ApiId = "0872gqal4m"
$AuthIntegrationId = "5pipi5a"
$ToursTable = "DANZSTAK-Tours"
$VenueDirectoryTable = "DANZSTAK-VenueDirectory"
$ReviewsTable = "DANZSTAK-Reviews"
$SessionDevicesTable = "DANZSTAK-SessionDevices"
$MarketplaceTable = "DANZSTAK-Marketplace"
$PhoneVerificationTable = "DANZSTAK-PhoneVerifications"
$PhoneVerificationSecret = "danzstak/phone-verification-secret"
$PhoneNotifyConfigurationId = "notify-14783ad0bae24a8b98063917c95a54e8"

$previousErrorPreference = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
$identityJson = aws sts get-caller-identity --region $Region --output json 2>$null
$identityExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorPreference
if ($identityExitCode -ne 0 -or [string]::IsNullOrWhiteSpace([string]$identityJson)) {
  throw "AWS authentication is missing or expired. Run 'aws login', then rerun this deployment. No production resources were changed."
}
$identity = $identityJson | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace([string]$identity.Account)) {
  throw "AWS identity could not be verified. No production resources were changed."
}

node --check $Source
if ($LASTEXITCODE -ne 0) { throw "Auth API JavaScript validation failed." }
node --check $MarketplaceSource
if ($LASTEXITCODE -ne 0) { throw "Marketplace API JavaScript validation failed." }
node --check $TicketingSource
if ($LASTEXITCODE -ne 0) { throw "Ticketing API JavaScript validation failed." }
node --check $PhoneVerificationSource
if ($LASTEXITCODE -ne 0) { throw "Phone verification JavaScript validation failed." }
node --check $PhoneServiceSource
if ($LASTEXITCODE -ne 0) { throw "Phone verification service validation failed." }
node --check $PhoneDynamoSource
if ($LASTEXITCODE -ne 0) { throw "Phone verification database validation failed." }

try {
  aws dynamodb describe-table --region $Region --table-name $ToursTable --output json 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    aws dynamodb create-table --region $Region --table-name $ToursTable --billing-mode PAY_PER_REQUEST --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=tourId,AttributeType=S --key-schema AttributeName=userId,KeyType=HASH AttributeName=tourId,KeyType=RANGE --tags Key=Application,Value=DanzStak Key=Purpose,Value=TourPlans --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Tour plans table creation failed." }
    aws dynamodb wait table-exists --region $Region --table-name $ToursTable
    if ($LASTEXITCODE -ne 0) { throw "Tour plans table did not become ready." }
  }
  $previousErrorPreference = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  aws dynamodb describe-table --region $Region --table-name $VenueDirectoryTable --output json 2>$null | Out-Null
  $venueDirectoryDescribeExit = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorPreference
  if ($venueDirectoryDescribeExit -ne 0) {
    aws dynamodb create-table --region $Region --table-name $VenueDirectoryTable --billing-mode PAY_PER_REQUEST --attribute-definitions AttributeName=venueKey,AttributeType=S --key-schema AttributeName=venueKey,KeyType=HASH --tags Key=Application,Value=DanzStak Key=Purpose,Value=ReviewedVenueDirectory --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Venue directory table creation failed." }
    aws dynamodb wait table-exists --region $Region --table-name $VenueDirectoryTable
    if ($LASTEXITCODE -ne 0) { throw "Venue directory table did not become ready." }
    aws dynamodb update-continuous-backups --region $Region --table-name $VenueDirectoryTable --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Venue directory recovery protection failed." }
  }
  $previousErrorPreference = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  aws dynamodb describe-table --region $Region --table-name $ReviewsTable --output json 2>$null | Out-Null
  $reviewsDescribeExit = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorPreference
  if ($reviewsDescribeExit -ne 0) {
    aws dynamodb create-table --region $Region --table-name $ReviewsTable --billing-mode PAY_PER_REQUEST --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE --tags Key=Application,Value=DanzStak Key=Purpose,Value=MemberReviews --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Reviews table creation failed." }
    aws dynamodb wait table-exists --region $Region --table-name $ReviewsTable
    if ($LASTEXITCODE -ne 0) { throw "Reviews table did not become ready." }
  }
  aws dynamodb update-continuous-backups --region $Region --table-name $ReviewsTable --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true --output json | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Reviews table recovery protection failed." }
  New-Item -ItemType Directory -Path $Stage -Force | Out-Null
  Copy-Item -LiteralPath $Source,$TourManagerBillingSource,$MarketplaceSource,$TicketingSource,$PhoneVerificationSource,$PhoneServiceSource,$PhoneDynamoSource,$Package,$PackageLock -Destination $Stage
  Push-Location $Stage
  try {
    npm ci --omit=dev --ignore-scripts --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "Auth API dependency installation failed." }
  } finally { Pop-Location }
  Compress-Archive -Path (Join-Path $Stage "*") -DestinationPath $Bundle -Force

  @{
    Version = "2012-10-17"
    Statement = @(
      @{
        Sid = "PostRecords"
        Effect = "Allow"
        Action = @("dynamodb:Scan", "dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem")
        Resource = "arn:aws:dynamodb:us-west-1:635288116224:table/DANZSTAK-Posts"
      },
      @{
        Sid = "FriendAudienceChecks"
        Effect = "Allow"
        Action = @("dynamodb:BatchGetItem", "dynamodb:GetItem", "dynamodb:ConditionCheckItem")
        Resource = "arn:aws:dynamodb:us-west-1:635288116224:table/DANZSTAK-Friends"
      },
      @{
        Sid = "ResolveAccountEmail"
        Effect = "Allow"
        Action = @("cognito-idp:ListUsers")
        Resource = "arn:aws:cognito-idp:us-east-1:635288116224:userpool/us-east-1_qA4B46ilc"
      },
      @{
        Sid = "DurableGroups"
        Effect = "Allow"
        Action = @("dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem", "dynamodb:Scan")
        Resource = "arn:aws:dynamodb:us-west-1:635288116224:table/DANZSTAK-GroupMembers"
      },
      @{
        Sid = "ProfileVideoSettings"
        Effect = "Allow"
        Action = @("dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:ConditionCheckItem")
        Resource = "arn:aws:dynamodb:us-west-1:635288116224:table/DanzStak-UserSettings"
      },
      @{
        Sid = "AccountSessionDevices"
        Effect = "Allow"
        Action = @("dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem", "dynamodb:UpdateItem", "dynamodb:Query")
        Resource = "arn:aws:dynamodb:us-west-1:635288116224:table/$SessionDevicesTable"
      },
      @{
        Sid = "DeletePostStoryReferences"
        Effect = "Allow"
        Action = @("dynamodb:Scan", "dynamodb:DeleteItem")
        Resource = "arn:aws:dynamodb:us-west-1:635288116224:table/DANZSTAK-Stories"
      },
      @{
        Sid = "DeleteReplacedProfileVideo"
        Effect = "Allow"
        Action = @("s3:GetObject", "s3:DeleteObject")
        Resource = "arn:aws:s3:::danzstak-call-signaling-mediabucket-*/*"
      },
      @{
        Sid = "SupportTickets"
        Effect = "Allow"
        Action = @("dynamodb:PutItem", "dynamodb:UpdateItem")
        Resource = "arn:aws:dynamodb:us-west-1:635288116224:table/DANZSTAK-SupportTickets"
      },
      @{
        Sid = "SupportMailNotification"
        Effect = "Allow"
        Action = @("ses:SendEmail")
        Resource = @(
          "arn:aws:ses:us-west-1:635288116224:identity/danzstak.com",
          "arn:aws:ses:us-west-1:635288116224:configuration-set/DanzStakTourManager"
        )
      },
      @{
        Sid = "TourRoutePlanning"
        Effect = "Allow"
        Action = @("geo-places:Geocode", "geo-places:ReverseGeocode", "geo-places:SearchText", "geo-routes:CalculateRoutes")
        Resource = "*"
      },
      @{
        Sid = "SavedTourPlans"
        Effect = "Allow"
        Action = @("dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:Query", "dynamodb:DeleteItem", "dynamodb:TransactWriteItems")
        Resource = "arn:aws:dynamodb:us-west-1:635288116224:table/DANZSTAK-Tours"
      },
      @{
        Sid = "DanzStakStripeSecrets"
        Effect = "Allow"
        Action = @("secretsmanager:GetSecretValue")
        Resource = @(
          "arn:aws:secretsmanager:us-west-1:635288116224:secret:danzstak/stripe/secret-key-*",
          "arn:aws:secretsmanager:us-west-1:635288116224:secret:danzstak/stripe/webhook-secret-*"
        )
      },
      @{
        Sid = "ReviewedVenueDirectory"
        Effect = "Allow"
        Action = @("dynamodb:Scan", "dynamodb:GetItem")
        Resource = "arn:aws:dynamodb:us-west-1:635288116224:table/DANZSTAK-VenueDirectory"
      },
      @{
        Sid = "MemberReviews"
        Effect = "Allow"
        Action = @("dynamodb:BatchGetItem", "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Query", "dynamodb:TransactWriteItems")
        Resource = "arn:aws:dynamodb:us-west-1:635288116224:table/DANZSTAK-Reviews"
      },
      @{
        Sid = "MarketplaceCatalog"
        Effect = "Allow"
        Action = @("dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem", "dynamodb:UpdateItem", "dynamodb:Query", "dynamodb:TransactWriteItems")
        Resource = "arn:aws:dynamodb:us-west-1:$($identity.Account):table/$MarketplaceTable"
      },
      @{
        Sid = "PrivatePhoneVerification"
        Effect = "Allow"
        Action = @("dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem", "dynamodb:UpdateItem", "dynamodb:TransactWriteItems")
        Resource = "arn:aws:dynamodb:us-west-1:$($identity.Account):table/$PhoneVerificationTable"
      },
      @{
        Sid = "PrivatePhoneVerificationSecret"
        Effect = "Allow"
        Action = @("secretsmanager:GetSecretValue")
        Resource = "arn:aws:secretsmanager:us-west-1:$($identity.Account):secret:$PhoneVerificationSecret-*"
      },
      @{
        Sid = "PrivatePhoneVerificationSms"
        Effect = "Allow"
        Action = @("sms-voice:SendNotifyTextMessage")
        Resource = "arn:aws:sms-voice:us-west-1:$($identity.Account):notify-configuration/$PhoneNotifyConfigurationId"
      },
      @{
        Sid = "DurableActivityPushOutbox"
        Effect = "Allow"
        Action = @("dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:TransactWriteItems")
        Resource = @(
          "arn:aws:dynamodb:us-west-1:$($identity.Account):table/DANZSTAK-EngagementNotifications",
          "arn:aws:dynamodb:us-west-1:$($identity.Account):table/DANZSTAK-ActivityPushOutbox"
        )
      }
    )
  } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $Policy -Encoding ascii

  aws iam put-role-policy `
    --region $Region `
    --role-name $RoleName `
    --policy-name DanzStakPostAuthorization `
    --policy-document "file://$Policy"
  if ($LASTEXITCODE -ne 0) { throw "Auth API authorization policy update failed." }

  $mediaBucket = aws cloudformation describe-stack-resource --region $Region --stack-name DANZSTAK-Call-Signaling --logical-resource-id MediaBucket --query 'StackResourceDetail.PhysicalResourceId' --output text
  if ($LASTEXITCODE -ne 0 -or -not $mediaBucket) { throw "DanzStak media bucket could not be resolved." }
  $activityPushOutboxTable = aws cloudformation describe-stack-resource --region $Region --stack-name DANZSTAK-Call-Signaling --logical-resource-id ActivityPushOutboxTable --query 'StackResourceDetail.PhysicalResourceId' --output text
  if ($LASTEXITCODE -ne 0 -or -not $activityPushOutboxTable) { throw "Activity push outbox could not be resolved. Deploy the reviewed signaling stack first." }
  $current = aws lambda get-function-configuration --region $Region --function-name $FunctionName --output json | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "Auth API configuration could not be read." }
  $variables = @{}
  foreach ($property in $current.Environment.Variables.PSObject.Properties) { $variables[$property.Name] = [string]$property.Value }
  $variables.MEDIA_BUCKET = [string]$mediaBucket
  $variables.ACTIVITY_PUSH_OUTBOX_TABLE = [string]$activityPushOutboxTable
  $postViewsTable = aws cloudformation describe-stacks --region $Region --stack-name DANZSTAK-Engagement --query "Stacks[0].Outputs[?OutputKey=='PostViewsTableName'].OutputValue | [0]" --output text
  if ($LASTEXITCODE -ne 0) { throw "Post view configuration could not be resolved." }
  if ($postViewsTable -and $postViewsTable -ne 'None') { $variables.POST_VIEWS_TABLE = [string]$postViewsTable }
  $variables.REVIEWS_TABLE = [string]$ReviewsTable
  $variables.MARKETPLACE_TABLE = [string]$MarketplaceTable
  $sessionDevicesTable = aws cloudformation describe-stacks --region $Region --stack-name DANZSTAK-Engagement --query "Stacks[0].Outputs[?OutputKey=='SessionDevicesTableName'].OutputValue | [0]" --output text
  if ($LASTEXITCODE -ne 0 -or -not $sessionDevicesTable -or $sessionDevicesTable -eq 'None') { throw "Session device registry configuration could not be resolved." }
  $variables.SESSION_DEVICES_TABLE = [string]$sessionDevicesTable
  $phoneVerificationTable = aws cloudformation describe-stacks --region $Region --stack-name DANZSTAK-Engagement --query "Stacks[0].Outputs[?OutputKey=='PhoneVerificationTableName'].OutputValue | [0]" --output text
  if ($LASTEXITCODE -ne 0 -or -not $phoneVerificationTable -or $phoneVerificationTable -eq 'None') { throw "Phone verification table configuration could not be resolved." }
  $variables.PHONE_VERIFICATION_TABLE = [string]$phoneVerificationTable
  $variables.PHONE_VERIFICATION_SECRET_NAME = $PhoneVerificationSecret
  $variables.PHONE_NOTIFY_CONFIGURATION_ID = $PhoneNotifyConfigurationId
  $variables.PHONE_NOTIFY_TEMPLATE_ID = "notify-code-verification-english-001"
  $notifyStatus = aws pinpoint-sms-voice-v2 describe-notify-configurations --region $Region --query "NotifyConfigurations[?NotifyConfigurationId=='$PhoneNotifyConfigurationId'].Status | [0]" --output text
  if ($LASTEXITCODE -ne 0) { throw "SYNC SMS verification provider status could not be inspected." }
  $variables.PHONE_VERIFICATION_ENABLED = if ($notifyStatus -eq 'ACTIVE') { 'true' } else { 'false' }
  # Fail closed: provider availability controls whether a text can be sent,
  # never whether an unverified device is allowed to register.
  $variables.PHONE_DEVICE_OTP_REQUIRED = if ($EnableDeviceSmsOtp) { 'true' } else { 'false' }
  @{ Variables = $variables } | ConvertTo-Json -Depth 6 -Compress | Set-Content -LiteralPath $Environment -Encoding ascii
  aws lambda update-function-configuration --region $Region --function-name $FunctionName --environment "file://$Environment" --output json | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Auth API media configuration failed." }
  aws lambda wait function-updated --region $Region --function-name $FunctionName
  if ($LASTEXITCODE -ne 0) { throw "Auth API media configuration did not finish updating." }

  aws lambda update-function-configuration --region $Region --function-name $FunctionName --timeout 30 --memory-size 256 --output json | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Auth API route-planning runtime configuration failed." }
  aws lambda wait function-updated --region $Region --function-name $FunctionName
  if ($LASTEXITCODE -ne 0) { throw "Auth API route-planning runtime configuration did not finish updating." }

  aws lambda update-function-code `
    --region $Region `
    --function-name $FunctionName `
    --zip-file "fileb://$Bundle" `
    --output json | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Auth API code deployment failed." }

  aws lambda wait function-updated --region $Region --function-name $FunctionName
  if ($LASTEXITCODE -ne 0) { throw "Auth API did not finish updating." }

  $configuration = aws lambda get-function-configuration `
    --region $Region `
    --function-name $FunctionName `
    --output json | ConvertFrom-Json
  if ($configuration.LastUpdateStatus -ne "Successful") {
    throw "Auth API deployment status is $($configuration.LastUpdateStatus)."
  }

  $sesTopicArn = aws sns create-topic --region $Region --name DANZSTAK-TourManager-SES-Events --query TopicArn --output text
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace([string]$sesTopicArn)) { throw "Tour Manager SES event topic could not be created or resolved." }
  $lambdaArn = [string]$configuration.FunctionArn
  $subscriptionArn = aws sns list-subscriptions-by-topic --region $Region --topic-arn $sesTopicArn --query "Subscriptions[?Protocol=='lambda' && Endpoint=='$lambdaArn'].SubscriptionArn | [0]" --output text
  if ($LASTEXITCODE -ne 0) { throw "Tour Manager SES event subscription could not be inspected." }
  if (-not $subscriptionArn -or $subscriptionArn -eq 'None') {
    $previousErrorPreference = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    aws lambda add-permission --region $Region --function-name $FunctionName --statement-id AllowTourManagerSesEvents --action lambda:InvokeFunction --principal sns.amazonaws.com --source-arn $sesTopicArn --output json 2>$null | Out-Null
    $permissionExit = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorPreference
    if ($permissionExit -ne 0) {
      $policyText = aws lambda get-policy --region $Region --function-name $FunctionName --query Policy --output text
      if ($LASTEXITCODE -ne 0 -or $policyText -notmatch 'AllowTourManagerSesEvents') { throw "Tour Manager SES event invoke permission failed." }
    }
    aws sns subscribe --region $Region --topic-arn $sesTopicArn --protocol lambda --notification-endpoint $lambdaArn --return-subscription-arn --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Tour Manager SES event Lambda subscription failed." }
  }
  $previousErrorPreference = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  aws sesv2 get-configuration-set --region $Region --configuration-set-name DanzStakTourManager --output json 2>$null | Out-Null
  $configurationSetExit = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorPreference
  if ($configurationSetExit -ne 0) {
    aws sesv2 create-configuration-set --region $Region --configuration-set-name DanzStakTourManager --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Tour Manager SES configuration set creation failed." }
  }
  @{
    Enabled = $true
    MatchingEventTypes = @("DELIVERY", "BOUNCE", "COMPLAINT")
    SnsDestination = @{ TopicArn = [string]$sesTopicArn }
  } | ConvertTo-Json -Depth 5 -Compress | Set-Content -LiteralPath $SesEventDestination -Encoding ascii
  $previousErrorPreference = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  aws sesv2 get-configuration-set-event-destinations --region $Region --configuration-set-name DanzStakTourManager --query "EventDestinations[?Name=='BookingDeliveryEvents'] | [0]" --output json 2>$null | Out-Null
  $eventDestinationExit = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorPreference
  if ($eventDestinationExit -ne 0) { throw "Tour Manager SES event destination could not be inspected." }
  aws sesv2 update-configuration-set-event-destination --region $Region --configuration-set-name DanzStakTourManager --event-destination-name BookingDeliveryEvents --event-destination "file://$SesEventDestination" --output json 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    aws sesv2 create-configuration-set-event-destination --region $Region --configuration-set-name DanzStakTourManager --event-destination-name BookingDeliveryEvents --event-destination "file://$SesEventDestination" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Tour Manager SES event destination configuration failed." }
  }

  $routes = aws apigatewayv2 get-routes --region $Region --api-id $ApiId --output json | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "Tour route API could not be inspected." }
  $routeId = ($routes.Items | Where-Object { $_.RouteKey -eq "POST /tour/route" } | Select-Object -First 1).RouteId
  if ([string]::IsNullOrWhiteSpace([string]$routeId)) {
    aws apigatewayv2 create-route --region $Region --api-id $ApiId --route-key "POST /tour/route" --target "integrations/$AuthIntegrationId" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Tour route API creation failed." }
  }
  foreach ($routeKey in @("POST /tour-manager/stripe/webhook", "POST /sync-network-number/stripe/webhook", "POST /tour-manager/checkout", "GET /tour-manager/credits", "GET /tour-manager/outreach", "POST /tour-manager/outreach/preflight", "POST /tour-manager/opt-out", "POST /tour-manager/reply", "POST /tour-manager/outreach/reply", "POST /tour-manager/outreach/use-date", "POST /tour-manager/outreach/use-status", "POST /tour-manager/contact-unlock/checkout", "GET /tour-manager/contact-unlocks", "POST /phone-number/checkout", "GET /phone-number/entitlement", "POST /sync-network-number/checkout", "GET /sync-network-number/entitlement", "POST /tour-manager/emails/send", "POST /venues/search", "POST /tour/manual-venue", "POST /record-stores/search", "GET /record-store-workspace", "POST /record-store-workspace", "GET /booking-pipeline", "POST /booking-pipeline", "PATCH /booking-pipeline/identity", "GET /epk", "POST /epk", "DELETE /epk", "POST /epk/qr", "POST /epk/share", "POST /epk/outreach-share", "GET /epk/outreach-share", "POST /epk/outreach/{shareId}", "GET /epk/public/{publicId}", "POST /epk/shared/{publicId}", "GET /review-targets", "GET /reviews", "POST /reviews", "PATCH /reviews/{reviewId}", "DELETE /reviews/{reviewId}", "GET /tours", "POST /tours", "DELETE /tours/{tourId}", "GET /marketplace/store", "GET /marketplace/bazaar", "GET /marketplace/bazaar/{productId}", "PUT /marketplace/store", "GET /marketplace/shop", "PUT /marketplace/shop", "GET /marketplace/shop/{memberId}", "POST /marketplace/products", "PATCH /marketplace/products/{productId}", "DELETE /marketplace/products/{productId}", "POST /marketplace/store/products", "PATCH /marketplace/store/products/{productId}", "DELETE /marketplace/store/products/{productId}", "GET /marketplace/events", "POST /marketplace/events", "GET /marketplace/events/{eventId}", "PATCH /marketplace/events/{eventId}", "POST /marketplace/events/{eventId}/tiers", "GET /auth/reset-password", "GET /auth/sessions", "DELETE /auth/sessions/{deviceId}", "POST /auth/sessions/revoke-others", "GET /auth/reauth", "POST /groups/{groupId}/everyone")) {
    $existing = ($routes.Items | Where-Object { $_.RouteKey -eq $routeKey } | Select-Object -First 1).RouteId
    if ([string]::IsNullOrWhiteSpace([string]$existing)) {
      aws apigatewayv2 create-route --region $Region --api-id $ApiId --route-key $routeKey --target "integrations/$AuthIntegrationId" --output json | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "Tour plans API route $routeKey creation failed." }
    }
  }
  foreach ($obsoleteRouteKey in @("GET /auth/mobile-login", "POST /auth/mobile-session")) {
    $obsoleteRouteId = ($routes.Items | Where-Object { $_.RouteKey -eq $obsoleteRouteKey } | Select-Object -First 1).RouteId
    if (-not [string]::IsNullOrWhiteSpace([string]$obsoleteRouteId)) {
      aws apigatewayv2 delete-route --region $Region --api-id $ApiId --route-id $obsoleteRouteId
      if ($LASTEXITCODE -ne 0) { throw "Obsolete native authentication route $obsoleteRouteKey could not be removed." }
    }
  }
  $permission = aws lambda get-policy --region $Region --function-name $FunctionName --query Policy --output text
  if ($LASTEXITCODE -ne 0) { throw "Auth API invoke permissions could not be inspected." }
  if ($permission -match "AllowNativeAuthFromApiGateway") {
    aws lambda remove-permission --region $Region --function-name $FunctionName --statement-id AllowNativeAuthFromApiGateway
    if ($LASTEXITCODE -ne 0) { throw "Obsolete native authentication API permission could not be removed." }
  }
  if ($permission -notmatch "AllowTourRouteFromApiGateway") {
    aws lambda add-permission --region $Region --function-name $FunctionName --statement-id AllowTourRouteFromApiGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:635288116224:${ApiId}/*/POST/tour/route" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Tour route API invoke permission failed." }
  }
  if ($permission -notmatch "AllowVenueSearchFromApiGateway") {
    aws lambda add-permission --region $Region --function-name $FunctionName --statement-id AllowVenueSearchFromApiGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:635288116224:${ApiId}/*/POST/venues/search" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Venue search API invoke permission failed." }
  }
  if ($permission -notmatch "AllowManualVenueFromApiGateway") {
    aws lambda add-permission --region $Region --function-name $FunctionName --statement-id AllowManualVenueFromApiGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:635288116224:${ApiId}/*/POST/tour/manual-venue" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Manual venue API invoke permission failed." }
  }
  if ($permission -notmatch "AllowRecordStoresFromApiGateway") {
    aws lambda add-permission --region $Region --function-name $FunctionName --statement-id AllowRecordStoresFromApiGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:635288116224:${ApiId}/*/POST/record-stores/search" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Record store API invoke permission failed." }
  }
  if ($permission -notmatch "AllowRecordStoreWorkspaceFromApiGateway") {
    aws lambda add-permission --region $Region --function-name $FunctionName --statement-id AllowRecordStoreWorkspaceFromApiGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:635288116224:${ApiId}/*/*/record-store-workspace" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Record-store workspace API invoke permission failed." }
  }
  if ($permission -notmatch "AllowEpkFromApiGateway") {
    aws lambda add-permission --region $Region --function-name $FunctionName --statement-id AllowEpkFromApiGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:635288116224:${ApiId}/*/*/epk*" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "EPK API invoke permission failed." }
  }
  if ($permission -notmatch "AllowTourPlansFromApiGateway") {
    aws lambda add-permission --region $Region --function-name $FunctionName --statement-id AllowTourPlansFromApiGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:635288116224:${ApiId}/*/*/tours*" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Tour plans API invoke permission failed." }
  }
  if ($permission -notmatch "AllowBookingPipelineFromApiGateway") {
    aws lambda add-permission --region $Region --function-name $FunctionName --statement-id AllowBookingPipelineFromApiGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:635288116224:${ApiId}/*/*/booking-pipeline" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Booking pipeline API invoke permission failed." }
  }
  if ($permission -notmatch "AllowReviewsFromApiGateway") {
    aws lambda add-permission --region $Region --function-name $FunctionName --statement-id AllowReviewsFromApiGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:635288116224:${ApiId}/*/*/review*" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Reviews API invoke permission failed." }
  }
  if ($permission -notmatch "AllowTourManagerBillingFromApiGateway") {
    aws lambda add-permission --region $Region --function-name $FunctionName --statement-id AllowTourManagerBillingFromApiGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:635288116224:${ApiId}/*/*/tour-manager/*" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Tour Manager billing API invoke permission failed." }
  }
  Write-Host "DanzStak Auth API authorization safeguards deployed successfully."
} finally {
  Remove-Item -LiteralPath $Bundle -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $Policy -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $Environment -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $SesEventDestination -Force -ErrorAction SilentlyContinue
  $resolvedStage = [IO.Path]::GetFullPath($Stage)
  $resolvedTemp = [IO.Path]::GetFullPath($env:TEMP).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  if ($resolvedStage.StartsWith($resolvedTemp, [StringComparison]::OrdinalIgnoreCase)) {
    Remove-Item -LiteralPath $resolvedStage -Recurse -Force -ErrorAction SilentlyContinue
  }
}
