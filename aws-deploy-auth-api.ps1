param([switch]$EnableDeviceSmsOtp, [switch]$DryRun)
$ErrorActionPreference = "Stop"
# Unattended (D0, GitHub deploy.yml) and in CloudShell alike: no pager, no progress bars, no prompts. Any failure throws,
# so `pwsh -File` exits non-zero. -DryRun reads the live setup and prints what a real run would change ("PLAN ..."),
# then exits without changing anything; every change below goes through Invoke-Change or sits in an
# `if (-not $DryRun)` block (test-deploy-workflow.cjs checks this).
$env:AWS_PAGER = ""
$ProgressPreference = "SilentlyContinue"
$script:PlannedChanges = [System.Collections.Generic.List[string]]::new()
function Invoke-Change {
  param([Parameter(Mandatory = $true)][string]$Description, [Parameter(Mandatory = $true)][scriptblock]$Action)
  if ($DryRun) {
    $script:PlannedChanges.Add($Description)
    Write-Host "PLAN  $Description"
    return
  }
  & $Action
}
function Get-StatementMap($Document) {
  $map = @{}
  foreach ($statement in @($Document.Statement)) {
    $actions = (@($statement.Action) | Sort-Object) -join ","
    $resources = (@($statement.Resource) | Sort-Object) -join ","
    $map[[string]$statement.Sid] = "$($statement.Effect)|$actions|$resources"
  }
  return $map
}

$Region = "us-west-1"
$FunctionName = "DANZSTAK-Auth-API"
$RoleName = "DANZSTAK-Auth-API-role-zjknf4ur"
$Source = Join-Path $PSScriptRoot "infrastructure\auth-api\index.mjs"
$TourManagerBillingSource = Join-Path $PSScriptRoot "infrastructure\auth-api\tour-manager-billing.mjs"
$BookingPipelineSource = Join-Path $PSScriptRoot "infrastructure\auth-api\booking-pipeline.mjs"
$MarketplaceSource = Join-Path $PSScriptRoot "infrastructure\auth-api\marketplace.mjs"
$TicketingSource = Join-Path $PSScriptRoot "infrastructure\auth-api\ticketing.mjs"
$PhoneVerificationSource = Join-Path $PSScriptRoot "infrastructure\auth-api\personal-phone-verification.mjs"
$PhoneServiceSource = Join-Path $PSScriptRoot "infrastructure\auth-api\personal-phone-service.mjs"
$PhoneDynamoSource = Join-Path $PSScriptRoot "infrastructure\auth-api\personal-phone-dynamodb.mjs"
$Package = Join-Path $PSScriptRoot "infrastructure\auth-api\package.json"
$PackageLock = Join-Path $PSScriptRoot "infrastructure\auth-api\package-lock.json"
# Windows sets TEMP; CloudShell (Linux) doesn't, so fall back to the system's temp folder (/tmp there).
$TempRoot = if ($env:TEMP) { $env:TEMP } else { [IO.Path]::GetTempPath() }
$Bundle = Join-Path $TempRoot "danzstak-auth-api.zip"
$Stage = Join-Path $TempRoot ("danzstak-auth-api-" + [guid]::NewGuid().ToString("N"))
$Policy = Join-Path $TempRoot "danzstak-auth-api-policy.json"
$Environment = Join-Path $TempRoot "danzstak-auth-api-environment.json"
$SesEventDestination = Join-Path $TempRoot "danzstak-tour-manager-ses-events.json"
$AccessLogSettingsFile = Join-Path $TempRoot "danzstak-auth-api-access-log.json"
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
  if ($LASTEXITCODE -ne 0) { Invoke-Change "Create DynamoDB table $ToursTable" {
    aws dynamodb create-table --region $Region --table-name $ToursTable --billing-mode PAY_PER_REQUEST --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=tourId,AttributeType=S --key-schema AttributeName=userId,KeyType=HASH AttributeName=tourId,KeyType=RANGE --tags Key=Application,Value=DanzStak Key=Purpose,Value=TourPlans --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Tour plans table creation failed." }
    aws dynamodb wait table-exists --region $Region --table-name $ToursTable
    if ($LASTEXITCODE -ne 0) { throw "Tour plans table did not become ready." }
  } }
  $previousErrorPreference = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  aws dynamodb describe-table --region $Region --table-name $VenueDirectoryTable --output json 2>$null | Out-Null
  $venueDirectoryDescribeExit = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorPreference
  if ($venueDirectoryDescribeExit -ne 0) { Invoke-Change "Create DynamoDB table $VenueDirectoryTable (with recovery protection)" {
    aws dynamodb create-table --region $Region --table-name $VenueDirectoryTable --billing-mode PAY_PER_REQUEST --attribute-definitions AttributeName=venueKey,AttributeType=S --key-schema AttributeName=venueKey,KeyType=HASH --tags Key=Application,Value=DanzStak Key=Purpose,Value=ReviewedVenueDirectory --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Venue directory table creation failed." }
    aws dynamodb wait table-exists --region $Region --table-name $VenueDirectoryTable
    if ($LASTEXITCODE -ne 0) { throw "Venue directory table did not become ready." }
    aws dynamodb update-continuous-backups --region $Region --table-name $VenueDirectoryTable --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Venue directory recovery protection failed." }
  } }
  $previousErrorPreference = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  aws dynamodb describe-table --region $Region --table-name $ReviewsTable --output json 2>$null | Out-Null
  $reviewsDescribeExit = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorPreference
  if ($reviewsDescribeExit -ne 0) { Invoke-Change "Create DynamoDB table $ReviewsTable" {
    aws dynamodb create-table --region $Region --table-name $ReviewsTable --billing-mode PAY_PER_REQUEST --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE --tags Key=Application,Value=DanzStak Key=Purpose,Value=MemberReviews --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Reviews table creation failed." }
    aws dynamodb wait table-exists --region $Region --table-name $ReviewsTable
    if ($LASTEXITCODE -ne 0) { throw "Reviews table did not become ready." }
  } }
  $reviewsRecovery = "DISABLED"
  if ($DryRun -and $reviewsDescribeExit -eq 0) {
    $reviewsRecovery = aws dynamodb describe-continuous-backups --region $Region --table-name $ReviewsTable --query 'ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus' --output text
    if ($LASTEXITCODE -ne 0) { throw "Reviews table recovery protection could not be read." }
  }
  if (-not $DryRun -or $reviewsRecovery -ne "ENABLED") { Invoke-Change "Turn on point-in-time recovery for $ReviewsTable" {
    aws dynamodb update-continuous-backups --region $Region --table-name $ReviewsTable --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Reviews table recovery protection failed." }
  } }
  New-Item -ItemType Directory -Path $Stage -Force | Out-Null
  # Every API module ships: a fixed list silently dropped payouts.mjs, ticket-orders.mjs and link-preview.mjs before.
  $ApiModules = Get-ChildItem -LiteralPath (Split-Path -Parent $Source) -Filter "*.mjs" -File | ForEach-Object { $_.FullName }
  Copy-Item -LiteralPath (@($ApiModules) + @($Package, $PackageLock)) -Destination $Stage
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
        Sid = "PostDailies"
        Effect = "Allow"
        Action = @("dynamodb:PutItem")
        Resource = "arn:aws:dynamodb:us-west-1:635288116224:table/DANZSTAK-Stories"
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
          "arn:aws:ses:us-west-1:635288116224:configuration-set/DanzStakTourManager",
          "arn:aws:ses:us-east-1:635288116224:identity/danzstak.com",
          "arn:aws:ses:us-east-1:635288116224:identity/support@danzstak.com",
          "arn:aws:ses:us-east-1:635288116224:configuration-set/DanzStakTourManager"
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
        # UpdateItem: venue freshness signals. Scan: club database counts (owner 2026-11-16). ConditionCheckItem: the
        # booking-email send checks the suppression list and opt-out token inside its transaction (L1, 2026-11-19).
        Action = @("dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:Query", "dynamodb:DeleteItem", "dynamodb:TransactWriteItems", "dynamodb:ConditionCheckItem", "dynamodb:UpdateItem", "dynamodb:Scan")
        Resource = "arn:aws:dynamodb:us-west-1:635288116224:table/DANZSTAK-Tours"
      },
      @{
        Sid = "DanzStakStripeSecrets"
        Effect = "Allow"
        Action = @("secretsmanager:GetSecretValue")
        Resource = @(
          "arn:aws:secretsmanager:us-west-1:635288116224:secret:danzstak/stripe/secret-key-*",
          "arn:aws:secretsmanager:us-west-1:635288116224:secret:danzstak/stripe/webhook-secret-*",
          "arn:aws:secretsmanager:us-west-1:635288116224:secret:danzstak/stripe/sync-network-webhook-secret-*",
          "arn:aws:secretsmanager:us-west-1:635288116224:secret:danzstak/stripe/live-secret-key-*",
          "arn:aws:secretsmanager:us-west-1:635288116224:secret:danzstak/stripe/live-webhook-secret-*",
          "arn:aws:secretsmanager:us-west-1:635288116224:secret:danzstak/stripe/live-sync-network-webhook-secret-*"
        )
      },
      @{
        Sid = "ReviewedVenueDirectory"
        Effect = "Allow"
        # UpdateItem: the club database keeps every club a search finds (owner 2026-11-16).
        Action = @("dynamodb:Scan", "dynamodb:GetItem", "dynamodb:UpdateItem")
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
        # ConditionCheckItem: the 10-accounts-per-number claim is checked inside the send transaction. Without it every
        # "Text me a code" failed (L1, 2026-11-19); test-iam-condition-checks.cjs keeps every ConditionCheck table granted.
        Action = @("dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem", "dynamodb:UpdateItem", "dynamodb:TransactWriteItems", "dynamodb:ConditionCheckItem")
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

  # The role's inline policies share one 10,240-character quota, and with the others this one outgrew it (deploy
  # 2026-11-20: LimitExceeded on PutRolePolicy). It is a managed policy now, with its own 6,144-character quota (about
  # 5,200 used): created, or given a new default version, then attached, and only then is the old inline copy removed,
  # so access never lapses. The Dailies permission (T0-A1) moved into it, so the role keeps the same number of
  # attached policies.
  $accessPolicyName = "DanzStakAuthApiAccess"
  $accessPolicyArn = "arn:aws:iam::$($identity.Account):policy/$accessPolicyName"
  $existingPolicyJson = aws iam get-policy --policy-arn $accessPolicyArn --output json 2>$null
  $policyExists = $LASTEXITCODE -eq 0
  $global:LASTEXITCODE = 0
  if ($DryRun) {
    $wanted = Get-StatementMap (Get-Content -LiteralPath $Policy -Raw | ConvertFrom-Json)
    if (-not $policyExists) {
      Invoke-Change "Create managed policy $accessPolicyName ($($wanted.Count) statements)" {}
    } else {
      $defaultVersion = ($existingPolicyJson | ConvertFrom-Json).Policy.DefaultVersionId
      $liveDocument = (aws iam get-policy-version --policy-arn $accessPolicyArn --version-id $defaultVersion --output json | ConvertFrom-Json).PolicyVersion.Document
      if ($LASTEXITCODE -ne 0) { throw "Auth API access policy could not be read." }
      $live = Get-StatementMap $liveDocument
      $added = @($wanted.Keys | Where-Object { -not $live.ContainsKey($_) } | Sort-Object)
      $removed = @($live.Keys | Where-Object { -not $wanted.ContainsKey($_) } | Sort-Object)
      $changed = @($wanted.Keys | Where-Object { $live.ContainsKey($_) -and $live[$_] -ne $wanted[$_] } | Sort-Object)
      if ($added.Count + $removed.Count + $changed.Count -gt 0) {
        Invoke-Change "Update managed policy $accessPolicyName (added: $($added -join ', '); removed: $($removed -join ', '); changed: $($changed -join ', '))" {}
      }
    }
    $attachedArns = @(aws iam list-attached-role-policies --role-name $RoleName --query 'AttachedPolicies[].PolicyArn' --output json | ConvertFrom-Json)
    if ($LASTEXITCODE -ne 0) { throw "Auth API role policies could not be read." }
    if ($attachedArns -notcontains $accessPolicyArn) { Invoke-Change "Attach $accessPolicyName to the Auth API role" {} }
    if ($attachedArns -contains "arn:aws:iam::$($identity.Account):policy/DanzStakPostDailies") { Invoke-Change "Detach DanzStakPostDailies from the Auth API role" {} }
    $inlineNames = @(aws iam list-role-policies --role-name $RoleName --query 'PolicyNames' --output json | ConvertFrom-Json)
    if ($LASTEXITCODE -ne 0) { throw "Auth API role inline policies could not be read." }
    if ($inlineNames -contains "DanzStakPostAuthorization") { Invoke-Change "Delete the old inline policy DanzStakPostAuthorization" {} }
  }
  if (-not $DryRun) {
    if (-not $policyExists) {
      aws iam create-policy --policy-name $accessPolicyName --policy-document "file://$Policy" --output json | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "Auth API access policy could not be created." }
    } else {
      # A managed policy keeps at most 5 versions: the oldest non-default one goes before the new default is added.
      $versions = aws iam list-policy-versions --policy-arn $accessPolicyArn --output json | ConvertFrom-Json
      if ($LASTEXITCODE -ne 0) { throw "Auth API access policy versions could not be read." }
      $older = @($versions.Versions | Where-Object { -not $_.IsDefaultVersion } | Sort-Object CreateDate)
      if (@($versions.Versions).Count -ge 5 -and $older.Count -gt 0) {
        aws iam delete-policy-version --policy-arn $accessPolicyArn --version-id $older[0].VersionId
        if ($LASTEXITCODE -ne 0) { throw "An old Auth API access policy version could not be removed." }
      }
      aws iam create-policy-version --policy-arn $accessPolicyArn --policy-document "file://$Policy" --set-as-default --output json | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "Auth API access policy update failed." }
    }
    aws iam attach-role-policy --role-name $RoleName --policy-arn $accessPolicyArn
    if ($LASTEXITCODE -ne 0) { throw "Auth API access policy could not be attached to the Auth API role." }
    # Now covered by the managed policy: the old inline copy and the separate Dailies policy come off (a later run finds
    # them gone, which is fine).
    aws iam delete-role-policy --role-name $RoleName --policy-name DanzStakPostAuthorization 2>$null
    aws iam detach-role-policy --role-name $RoleName --policy-arn "arn:aws:iam::$($identity.Account):policy/DanzStakPostDailies" 2>$null
    $global:LASTEXITCODE = 0
  }

  # Task 38 / C1: Mix posts and The Roll through the CDN. Once the call-signaling stack has the CDN, the Auth API may read
  # only the signing-key secret and invalidate only the media distribution: its own managed policy (DanzStakMediaCdn),
  # because DanzStakAuthApiAccess is close to its size quota.
  $mediaCdnDomain = aws cloudformation describe-stacks --region $Region --stack-name DANZSTAK-Call-Signaling --query "Stacks[0].Outputs[?OutputKey=='MediaCdnDomain'].OutputValue | [0]" --output text
  if ($LASTEXITCODE -ne 0) { throw "Media CDN domain could not be read." }
  $mediaCdnDistribution = aws cloudformation describe-stacks --region $Region --stack-name DANZSTAK-Call-Signaling --query "Stacks[0].Outputs[?OutputKey=='MediaCdnDistributionId'].OutputValue | [0]" --output text
  if ($LASTEXITCODE -ne 0) { throw "Media CDN distribution could not be read." }
  $mediaCdnServe = aws cloudformation describe-stacks --region $Region --stack-name DANZSTAK-Call-Signaling --query "Stacks[0].Parameters[?ParameterKey=='MediaCdnServe'].ParameterValue | [0]" --output text
  if ($LASTEXITCODE -ne 0) { throw "Media CDN switch could not be read." }
  $mediaCdnReady = ($mediaCdnDomain -match '^[a-z0-9]+\.cloudfront\.net$') -and ($mediaCdnDistribution -match '^E[A-Z0-9]+$')
  if ($mediaCdnReady) {
    $cdnPolicyName = "DanzStakMediaCdn"
    $cdnPolicyArn = "arn:aws:iam::$($identity.Account):policy/$cdnPolicyName"
    $cdnPolicy = Join-Path $TempRoot "danzstak-media-cdn-policy.json"
    @{
      Version = "2012-10-17"
      Statement = @(
        @{ Sid = "MediaCdnSigningKey"; Effect = "Allow"; Action = @("secretsmanager:GetSecretValue"); Resource = "arn:aws:secretsmanager:us-west-1:$($identity.Account):secret:danzstak/cloudfront/media-signing-key-*" },
        @{ Sid = "MediaCdnInvalidate"; Effect = "Allow"; Action = @("cloudfront:CreateInvalidation"); Resource = "arn:aws:cloudfront::$($identity.Account):distribution/$mediaCdnDistribution" }
      )
    } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $cdnPolicy -Encoding ascii
    aws iam get-policy --policy-arn $cdnPolicyArn --output json 2>$null | Out-Null
    $cdnPolicyExists = $LASTEXITCODE -eq 0
    $global:LASTEXITCODE = 0
    if (-not $cdnPolicyExists) { Invoke-Change "Create managed policy $cdnPolicyName (read the CDN signing key, invalidate $mediaCdnDistribution)" {
      aws iam create-policy --policy-name $cdnPolicyName --policy-document "file://$cdnPolicy" --output json | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "Media CDN policy could not be created." }
    } }
    $cdnAttached = @(aws iam list-attached-role-policies --role-name $RoleName --query 'AttachedPolicies[].PolicyArn' --output json | ConvertFrom-Json)
    if ($LASTEXITCODE -ne 0) { throw "Auth API role policies could not be read." }
    if ($cdnAttached -notcontains $cdnPolicyArn) { Invoke-Change "Attach $cdnPolicyName to the Auth API role" {
      aws iam attach-role-policy --role-name $RoleName --policy-arn $cdnPolicyArn
      if ($LASTEXITCODE -ne 0) { throw "Media CDN policy could not be attached to the Auth API role." }
    } }
    Remove-Item -LiteralPath $cdnPolicy -Force -ErrorAction SilentlyContinue
  }

  # D0-4 (owner 2026-11-21/22): the AI EPK, AI profile and AI shop read pages with Claude Haiku 4.5 on Amazon Bedrock,
  # billed on the DanzStak AWS account. Its own managed policy (DanzStakBedrockInvoke): only bedrock:InvokeModel (the
  # permission the Converse API uses) on the Haiku 4.5 cross-region inference profile and the foundation model it routes
  # to. Writing stays on the Anthropic API (DanzStakAnthropicKeyRead) until AWS opens Sonnet on Bedrock for this account;
  # flipping AI_WRITE_PROVIDER=bedrock then also needs the Sonnet profile added here. Updated in place when it changes.
  $bedrockPolicyName = "DanzStakBedrockInvoke"
  $bedrockPolicyArn = "arn:aws:iam::$($identity.Account):policy/$bedrockPolicyName"
  $bedrockPolicy = Join-Path $TempRoot "danzstak-bedrock-invoke-policy.json"
  @{
    Version = "2012-10-17"
    Statement = @(
      @{ Sid = "HaikuInferenceProfile"; Effect = "Allow"; Action = @("bedrock:InvokeModel"); Resource = "arn:aws:bedrock:${Region}:$($identity.Account):inference-profile/us.anthropic.claude-haiku-4-5-20251001-v1:0" },
      @{ Sid = "HaikuFoundationModel"; Effect = "Allow"; Action = @("bedrock:InvokeModel"); Resource = "arn:aws:bedrock:us-*::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0"; Condition = @{ StringLike = @{ "bedrock:InferenceProfileArn" = "arn:aws:bedrock:${Region}:$($identity.Account):inference-profile/us.anthropic.claude-haiku-4-5-20251001-v1:0" } } }
    )
  } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $bedrockPolicy -Encoding ascii
  $bedrockLive = aws iam get-policy --policy-arn $bedrockPolicyArn --output json 2>$null | ConvertFrom-Json
  $bedrockPolicyExists = $LASTEXITCODE -eq 0
  $global:LASTEXITCODE = 0
  if (-not $bedrockPolicyExists) { Invoke-Change "Create managed policy $bedrockPolicyName (Claude Haiku 4.5 on Bedrock only)" {
    aws iam create-policy --policy-name $bedrockPolicyName --policy-document "file://$bedrockPolicy" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Bedrock policy could not be created." }
  } } else {
    $bedrockLiveDocument = aws iam get-policy-version --policy-arn $bedrockPolicyArn --version-id $bedrockLive.Policy.DefaultVersionId --query 'PolicyVersion.Document' --output json | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw "Bedrock policy could not be read." }
    $bedrockWanted = Get-StatementMap (Get-Content -LiteralPath $bedrockPolicy -Raw | ConvertFrom-Json)
    $bedrockHave = Get-StatementMap $bedrockLiveDocument
    $bedrockSame = $bedrockWanted.Count -eq $bedrockHave.Count -and -not @($bedrockWanted.Keys | Where-Object { $bedrockHave[$_] -ne $bedrockWanted[$_] }).Count
    if (-not $bedrockSame) { Invoke-Change "Update managed policy $bedrockPolicyName" {
      $versions = @(aws iam list-policy-versions --policy-arn $bedrockPolicyArn --query 'Versions[?IsDefaultVersion==`false`]' --output json | ConvertFrom-Json | Sort-Object CreateDate)
      if ($versions.Count -ge 4) { aws iam delete-policy-version --policy-arn $bedrockPolicyArn --version-id $versions[0].VersionId }
      aws iam create-policy-version --policy-arn $bedrockPolicyArn --policy-document "file://$bedrockPolicy" --set-as-default --output json | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "Bedrock policy could not be updated." }
    } }
  }
  $bedrockAttached = @(aws iam list-attached-role-policies --role-name $RoleName --query 'AttachedPolicies[].PolicyArn' --output json | ConvertFrom-Json)
  if ($LASTEXITCODE -ne 0) { throw "Auth API role policies could not be read." }
  if ($bedrockAttached -notcontains $bedrockPolicyArn) { Invoke-Change "Attach $bedrockPolicyName to the Auth API role" {
    aws iam attach-role-policy --role-name $RoleName --policy-arn $bedrockPolicyArn
    if ($LASTEXITCODE -ne 0) { throw "Bedrock policy could not be attached to the Auth API role." }
  } }
  Remove-Item -LiteralPath $bedrockPolicy -Force -ErrorAction SilentlyContinue

  $mediaBucket = aws cloudformation describe-stack-resource --region $Region --stack-name DANZSTAK-Call-Signaling --logical-resource-id MediaBucket --query 'StackResourceDetail.PhysicalResourceId' --output text
  if ($LASTEXITCODE -ne 0 -or -not $mediaBucket) { throw "DanzStak media bucket could not be resolved." }
  $activityPushOutboxTable = aws cloudformation describe-stack-resource --region $Region --stack-name DANZSTAK-Call-Signaling --logical-resource-id ActivityPushOutboxTable --query 'StackResourceDetail.PhysicalResourceId' --output text
  if ($LASTEXITCODE -ne 0 -or -not $activityPushOutboxTable) { throw "Activity push outbox could not be resolved. Deploy the reviewed signaling stack first." }
  $current = aws lambda get-function-configuration --region $Region --function-name $FunctionName --output json | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "Auth API configuration could not be read." }
  # Lambda keeps the settings encrypted. A caller that may not decrypt them gets Environment.Error and no Variables: the
  # GitHub deploy role, whose boundary denies kms:Decrypt so it never sees a secret value. Writing the environment then
  # would replace every live setting (sign-in, sessions, Stripe, ...) with only the ones set below and take the Auth API
  # down, so the environment is written only when the live settings were read (deploy run 7, 2026-11-23, planned that).
  $settingsRead = -not $current.Environment.Error -and @($current.Environment.Variables.PSObject.Properties).Count -gt 0
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
  # CDN URLs only while call-signaling serves the CDN (the pages allow that host); S3 links otherwise.
  if ($mediaCdnReady -and $mediaCdnServe -eq 'true') { $variables.MEDIA_CDN_DOMAIN = [string]$mediaCdnDomain; $variables.MEDIA_CDN_DISTRIBUTION_ID = [string]$mediaCdnDistribution }
  else { $variables.Remove('MEDIA_CDN_DOMAIN'); $variables.Remove('MEDIA_CDN_DISTRIBUTION_ID') }
  @{ Variables = $variables } | ConvertTo-Json -Depth 6 -Compress | Set-Content -LiteralPath $Environment -Encoding ascii
  # Names only (values can be private settings): which environment variables a real run adds or changes.
  $liveVariables = @{}
  foreach ($property in $current.Environment.Variables.PSObject.Properties) { $liveVariables[$property.Name] = [string]$property.Value }
  $changedVariables = @($variables.Keys | Where-Object { -not $liveVariables.ContainsKey($_) -or $liveVariables[$_] -ne [string]$variables[$_] } | Sort-Object)
  if (-not $settingsRead) {
    Write-Host "SKIP  Auth API environment: this account can't read the live settings (they are encrypted), so they stay exactly as they are. Change a setting from CloudShell."
  } elseif (-not $DryRun -or $changedVariables.Count -gt 0) { Invoke-Change "Set Auth API environment: $($changedVariables -join ', ')" {
    aws lambda update-function-configuration --region $Region --function-name $FunctionName --environment "file://$Environment" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Auth API media configuration failed." }
    aws lambda wait function-updated --region $Region --function-name $FunctionName
    if ($LASTEXITCODE -ne 0) { throw "Auth API media configuration did not finish updating." }
  } }

  if (-not $DryRun -or [int]$current.Timeout -ne 30 -or [int]$current.MemorySize -ne 256) { Invoke-Change "Set Auth API timeout 30 s and memory 256 MB (now $($current.Timeout) s, $($current.MemorySize) MB)" {
    aws lambda update-function-configuration --region $Region --function-name $FunctionName --timeout 30 --memory-size 256 --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Auth API route-planning runtime configuration failed." }
    aws lambda wait function-updated --region $Region --function-name $FunctionName
    if ($LASTEXITCODE -ne 0) { throw "Auth API route-planning runtime configuration did not finish updating." }
  } }

  Invoke-Change "Upload Auth API code ($(@($ApiModules).Count) modules, $([math]::Round((Get-Item -LiteralPath $Bundle).Length / 1MB, 1)) MB bundle)" {
    aws lambda update-function-code `
      --region $Region `
      --function-name $FunctionName `
      --zip-file "fileb://$Bundle" `
      --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Auth API code deployment failed." }

    aws lambda wait function-updated --region $Region --function-name $FunctionName
    if ($LASTEXITCODE -ne 0) { throw "Auth API did not finish updating." }
  }

  $configuration = aws lambda get-function-configuration `
    --region $Region `
    --function-name $FunctionName `
    --output json | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "Auth API configuration could not be read." }
  if ($configuration.LastUpdateStatus -ne "Successful") {
    throw "Auth API deployment status is $($configuration.LastUpdateStatus)."
  }

  $sesTopicName = "DANZSTAK-TourManager-SES-Events"
  if (-not $DryRun) {
    $sesTopicArn = aws sns create-topic --region $Region --name $sesTopicName --query TopicArn --output text
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace([string]$sesTopicArn)) { throw "Tour Manager SES event topic could not be created or resolved." }
  } else {
    $sesTopicArn = "arn:aws:sns:${Region}:$($identity.Account):$sesTopicName"
    $previousErrorPreference = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    aws sns get-topic-attributes --region $Region --topic-arn $sesTopicArn --output json 2>$null | Out-Null
    $topicExit = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorPreference
    if ($topicExit -ne 0) { Invoke-Change "Create SNS topic $sesTopicName" {}; $sesTopicArn = "" }
  }
  $lambdaArn = [string]$configuration.FunctionArn
  $subscriptionArn = ""
  if ($sesTopicArn) {
    $subscriptionArn = aws sns list-subscriptions-by-topic --region $Region --topic-arn $sesTopicArn --query "Subscriptions[?Protocol=='lambda' && Endpoint=='$lambdaArn'].SubscriptionArn | [0]" --output text
    if ($LASTEXITCODE -ne 0) { throw "Tour Manager SES event subscription could not be inspected." }
  }
  if (-not $subscriptionArn -or $subscriptionArn -eq 'None') { Invoke-Change "Subscribe the Auth API to $sesTopicName (and allow SNS to invoke it)" {
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
  } }
  $previousErrorPreference = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  aws sesv2 get-configuration-set --region $Region --configuration-set-name DanzStakTourManager --output json 2>$null | Out-Null
  $configurationSetExit = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorPreference
  if ($configurationSetExit -ne 0) { Invoke-Change "Create SES configuration set DanzStakTourManager" {
    aws sesv2 create-configuration-set --region $Region --configuration-set-name DanzStakTourManager --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Tour Manager SES configuration set creation failed." }
  } }
  @{
    Enabled = $true
    MatchingEventTypes = @("DELIVERY", "BOUNCE", "COMPLAINT")
    SnsDestination = @{ TopicArn = [string]$sesTopicArn }
  } | ConvertTo-Json -Depth 5 -Compress | Set-Content -LiteralPath $SesEventDestination -Encoding ascii
  $previousErrorPreference = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  $eventDestinationJson = $null
  $eventDestinationExit = 0
  if ($configurationSetExit -eq 0) {
    $eventDestinationJson = aws sesv2 get-configuration-set-event-destinations --region $Region --configuration-set-name DanzStakTourManager --query "EventDestinations[?Name=='BookingDeliveryEvents'] | [0]" --output json 2>$null
    $eventDestinationExit = $LASTEXITCODE
  }
  $ErrorActionPreference = $previousErrorPreference
  if ($eventDestinationExit -ne 0) { throw "Tour Manager SES event destination could not be inspected." }
  $liveDestination = if ($eventDestinationJson) { $eventDestinationJson | ConvertFrom-Json } else { $null }
  $destinationCurrent = $liveDestination -and $liveDestination.Enabled -and [string]$liveDestination.SnsDestination.TopicArn -eq [string]$sesTopicArn -and ((@($liveDestination.MatchingEventTypes) | Sort-Object) -join ",") -eq "BOUNCE,COMPLAINT,DELIVERY"
  if (-not $DryRun -or -not $destinationCurrent) { Invoke-Change "Send SES delivery, bounce and complaint events to $sesTopicName" {
    aws sesv2 update-configuration-set-event-destination --region $Region --configuration-set-name DanzStakTourManager --event-destination-name BookingDeliveryEvents --event-destination "file://$SesEventDestination" --output json 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
      aws sesv2 create-configuration-set-event-destination --region $Region --configuration-set-name DanzStakTourManager --event-destination-name BookingDeliveryEvents --event-destination "file://$SesEventDestination" --output json | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "Tour Manager SES event destination configuration failed." }
    }
  } }

  $routes = aws apigatewayv2 get-routes --region $Region --api-id $ApiId --output json | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "Tour route API could not be inspected." }
  $routeId = ($routes.Items | Where-Object { $_.RouteKey -eq "POST /tour/route" } | Select-Object -First 1).RouteId
  if ([string]::IsNullOrWhiteSpace([string]$routeId)) { Invoke-Change "Create API route POST /tour/route" {
    aws apigatewayv2 create-route --region $Region --api-id $ApiId --route-key "POST /tour/route" --target "integrations/$AuthIntegrationId" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Tour route API creation failed." }
  } }
  foreach ($routeKey in @("GET /club-directory/contacts", "POST /club-directory/contacts", "POST /tour-manager/stripe/webhook", "POST /sync-network-number/stripe/webhook", "POST /tour-manager/checkout", "GET /tour-manager/credits", "GET /tour-manager/refunds", "POST /tour-manager/refunds/quote", "POST /tour-manager/refunds/accept", "GET /tour-manager/outreach", "POST /tour-manager/outreach/preflight", "POST /tour-manager/opt-out", "POST /tour-manager/reply", "POST /tour-manager/outreach/reply", "POST /tour-manager/outreach/use-date", "POST /tour-manager/outreach/use-status", "POST /tour-manager/contact-unlock/checkout", "GET /tour-manager/contact-unlocks", "POST /phone-number/checkout", "GET /phone-number/entitlement", "POST /sync-network-number/checkout", "GET /sync-network-number/entitlement", "POST /tour-manager/emails/send", "POST /venues/search", "POST /tour/manual-venue", "POST /record-stores/search", "GET /record-store-workspace", "POST /record-store-workspace", "GET /booking-pipeline", "POST /booking-pipeline", "PATCH /booking-pipeline/identity", "GET /epk", "POST /epk", "DELETE /epk", "POST /epk/qr", "POST /epk/share", "POST /epk/outreach-share", "GET /epk/outreach-share", "POST /epk/outreach/{shareId}", "GET /epk/public/{publicId}", "POST /epk/shared/{publicId}", "POST /epk/share-card", "GET /share/epk/{publicId}", "GET /share/epk/{publicId}/card", "GET /epk/ai", "POST /epk/ai/identify", "POST /epk/ai/confirm", "POST /epk/ai/build", "POST /epk/ai/step", "POST /epk/ai/review", "POST /epk/ai/rewrite", "GET /profile/ai", "POST /profile/ai/draft", "POST /tour-manager/ai-epk/checkout", "GET /albums", "POST /albums", "GET /albums/{albumId}", "PATCH /albums/{albumId}", "DELETE /albums/{albumId}", "POST /albums/{albumId}/items", "DELETE /albums/{albumId}/items/{itemId}", "GET /review-targets", "GET /reviews", "POST /reviews", "PATCH /reviews/{reviewId}", "DELETE /reviews/{reviewId}", "GET /tours", "POST /tours", "DELETE /tours/{tourId}", "GET /marketplace/store", "GET /marketplace/bazaar", "GET /marketplace/bazaar/{productId}", "PUT /marketplace/store", "GET /marketplace/shop", "PUT /marketplace/shop", "GET /marketplace/shop/{memberId}", "POST /marketplace/products", "POST /marketplace/products/import", "PATCH /marketplace/products/{productId}", "DELETE /marketplace/products/{productId}", "POST /marketplace/store/products", "PATCH /marketplace/store/products/{productId}", "DELETE /marketplace/store/products/{productId}", "GET /marketplace/events", "POST /marketplace/events", "GET /marketplace/events/{eventId}", "PATCH /marketplace/events/{eventId}", "POST /marketplace/events/{eventId}/tiers", "GET /auth/reset-password", "GET /auth/sessions", "DELETE /auth/sessions/{deviceId}", "POST /auth/sessions/revoke-others", "GET /auth/reauth", "POST /groups/{groupId}/everyone")) {
    $existing = ($routes.Items | Where-Object { $_.RouteKey -eq $routeKey } | Select-Object -First 1).RouteId
    if ([string]::IsNullOrWhiteSpace([string]$existing)) { Invoke-Change "Create API route $routeKey" {
      aws apigatewayv2 create-route --region $Region --api-id $ApiId --route-key $routeKey --target "integrations/$AuthIntegrationId" --output json | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "Tour plans API route $routeKey creation failed." }
    } }
  }
  foreach ($obsoleteRouteKey in @("GET /auth/mobile-login", "POST /auth/mobile-session")) {
    $obsoleteRouteId = ($routes.Items | Where-Object { $_.RouteKey -eq $obsoleteRouteKey } | Select-Object -First 1).RouteId
    if (-not [string]::IsNullOrWhiteSpace([string]$obsoleteRouteId)) { Invoke-Change "Delete obsolete API route $obsoleteRouteKey" {
      aws apigatewayv2 delete-route --region $Region --api-id $ApiId --route-id $obsoleteRouteId
      if ($LASTEXITCODE -ne 0) { throw "Obsolete native authentication route $obsoleteRouteKey could not be removed." }
    } }
  }

  # Access logs for the Auth HTTP API (L1, owner 2026-11-19): one line per request with the status, the route TEMPLATE
  # (`GET /profiles/{id}`, never the real path, which can hold a username or id), the latency and API Gateway's random
  # request id. No IP address, user agent, query string, cookie, token or email is logged. Kept 30 days.
  # test-auth-api-access-logs.cjs pins the format. The stage is compared with one read the GitHub deploy role is allowed
  # (apigateway:GET), so a run where logging is already on never touches CloudWatch Logs; turning it on needs the logs
  # permissions AWS lists for HTTP API logging, which only CloudShell has (the deploy role's boundary has no logs:*).
  $accessLogGroup = "/aws/apigateway/DANZSTAK-Auth-HTTP-API"
  $accessLogDestination = "arn:aws:logs:${Region}:$($identity.Account):log-group:$accessLogGroup"
  $accessLogFormat = '{"requestId":"$context.requestId","time":"$context.requestTimeEpoch","route":"$context.routeKey","status":"$context.status","latencyMs":"$context.responseLatency","integrationMs":"$context.integrationLatency","integrationStatus":"$context.integrationStatus","bytes":"$context.responseLength","protocol":"$context.protocol","error":"$context.error.message"}'
  $authStage = aws apigatewayv2 get-stage --region $Region --api-id $ApiId --stage-name '$default' --output json | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "Auth API stage could not be inspected." }
  if ([string]$authStage.AccessLogSettings.DestinationArn -ne $accessLogDestination -or [string]$authStage.AccessLogSettings.Format -ne $accessLogFormat) {
    Invoke-Change "Turn on Auth API access logs ($accessLogGroup, 30 days: status, route template, latency, request id; no IP, user agent or path)" {
      $existingGroup = aws logs describe-log-groups --region $Region --log-group-name-prefix $accessLogGroup --query "logGroups[?logGroupName=='$accessLogGroup'].logGroupName | [0]" --output text
      if ($LASTEXITCODE -ne 0) { throw "Access log group could not be inspected." }
      if ($existingGroup -ne $accessLogGroup) {
        aws logs create-log-group --region $Region --log-group-name $accessLogGroup
        if ($LASTEXITCODE -ne 0) { throw "Access log group could not be created." }
      }
      aws logs put-retention-policy --region $Region --log-group-name $accessLogGroup --retention-in-days 30
      if ($LASTEXITCODE -ne 0) { throw "Access log retention could not be set." }
      @{ DestinationArn = $accessLogDestination; Format = $accessLogFormat } | ConvertTo-Json -Compress | Set-Content -LiteralPath $AccessLogSettingsFile -Encoding ascii
      aws apigatewayv2 update-stage --region $Region --api-id $ApiId --stage-name '$default' --access-log-settings "file://$AccessLogSettingsFile" --output json | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "Auth API access logs could not be turned on." }
    }
  }
  $permission = aws lambda get-policy --region $Region --function-name $FunctionName --query Policy --output text
  if ($LASTEXITCODE -ne 0) { throw "Auth API invoke permissions could not be inspected." }
  if ($permission -match "AllowNativeAuthFromApiGateway") { Invoke-Change "Remove obsolete invoke permission AllowNativeAuthFromApiGateway" {
    aws lambda remove-permission --region $Region --function-name $FunctionName --statement-id AllowNativeAuthFromApiGateway
    if ($LASTEXITCODE -ne 0) { throw "Obsolete native authentication API permission could not be removed." }
  } }
  if ($permission -notmatch "AllowTourRouteFromApiGateway") { Invoke-Change "Allow API Gateway to invoke the Auth API (AllowTourRouteFromApiGateway)" {
    aws lambda add-permission --region $Region --function-name $FunctionName --statement-id AllowTourRouteFromApiGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:635288116224:${ApiId}/*/POST/tour/route" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Tour route API invoke permission failed." }
  } }
  if ($permission -notmatch "AllowVenueSearchFromApiGateway") { Invoke-Change "Allow API Gateway to invoke the Auth API (AllowVenueSearchFromApiGateway)" {
    aws lambda add-permission --region $Region --function-name $FunctionName --statement-id AllowVenueSearchFromApiGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:635288116224:${ApiId}/*/POST/venues/search" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Venue search API invoke permission failed." }
  } }
  if ($permission -notmatch "AllowManualVenueFromApiGateway") { Invoke-Change "Allow API Gateway to invoke the Auth API (AllowManualVenueFromApiGateway)" {
    aws lambda add-permission --region $Region --function-name $FunctionName --statement-id AllowManualVenueFromApiGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:635288116224:${ApiId}/*/POST/tour/manual-venue" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Manual venue API invoke permission failed." }
  } }
  if ($permission -notmatch "api-club-directory-contacts") { Invoke-Change "Allow API Gateway to invoke the Auth API (api-club-directory-contacts)" {
    aws lambda add-permission --region $Region --function-name $FunctionName --statement-id api-club-directory-contacts --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:635288116224:${ApiId}/*/*/club-directory/contacts" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Trusted contacts API invoke permission failed." }
  } }
  if ($permission -notmatch "AllowRecordStoresFromApiGateway") { Invoke-Change "Allow API Gateway to invoke the Auth API (AllowRecordStoresFromApiGateway)" {
    aws lambda add-permission --region $Region --function-name $FunctionName --statement-id AllowRecordStoresFromApiGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:635288116224:${ApiId}/*/POST/record-stores/search" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Record store API invoke permission failed." }
  } }
  if ($permission -notmatch "AllowRecordStoreWorkspaceFromApiGateway") { Invoke-Change "Allow API Gateway to invoke the Auth API (AllowRecordStoreWorkspaceFromApiGateway)" {
    aws lambda add-permission --region $Region --function-name $FunctionName --statement-id AllowRecordStoreWorkspaceFromApiGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:635288116224:${ApiId}/*/*/record-store-workspace" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Record-store workspace API invoke permission failed." }
  } }
  if ($permission -notmatch "AllowAlbumsFromApiGateway") { Invoke-Change "Allow API Gateway to invoke the Auth API (AllowAlbumsFromApiGateway)" {
    aws lambda add-permission --region $Region --function-name $FunctionName --statement-id AllowAlbumsFromApiGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:635288116224:${ApiId}/*/*/albums*" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Albums API invoke permission failed." }
  } }
  if ($permission -notmatch "AllowEpkFromApiGateway") { Invoke-Change "Allow API Gateway to invoke the Auth API (AllowEpkFromApiGateway)" {
    aws lambda add-permission --region $Region --function-name $FunctionName --statement-id AllowEpkFromApiGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:635288116224:${ApiId}/*/*/epk*" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "EPK API invoke permission failed." }
  } }
  if ($permission -notmatch "AllowTourPlansFromApiGateway") { Invoke-Change "Allow API Gateway to invoke the Auth API (AllowTourPlansFromApiGateway)" {
    aws lambda add-permission --region $Region --function-name $FunctionName --statement-id AllowTourPlansFromApiGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:635288116224:${ApiId}/*/*/tours*" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Tour plans API invoke permission failed." }
  } }
  if ($permission -notmatch "AllowBookingPipelineFromApiGateway") { Invoke-Change "Allow API Gateway to invoke the Auth API (AllowBookingPipelineFromApiGateway)" {
    aws lambda add-permission --region $Region --function-name $FunctionName --statement-id AllowBookingPipelineFromApiGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:635288116224:${ApiId}/*/*/booking-pipeline" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Booking pipeline API invoke permission failed." }
  } }
  if ($permission -notmatch "AllowReviewsFromApiGateway") { Invoke-Change "Allow API Gateway to invoke the Auth API (AllowReviewsFromApiGateway)" {
    aws lambda add-permission --region $Region --function-name $FunctionName --statement-id AllowReviewsFromApiGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:635288116224:${ApiId}/*/*/review*" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Reviews API invoke permission failed." }
  } }
  if ($permission -notmatch "AllowTourManagerBillingFromApiGateway") { Invoke-Change "Allow API Gateway to invoke the Auth API (AllowTourManagerBillingFromApiGateway)" {
    aws lambda add-permission --region $Region --function-name $FunctionName --statement-id AllowTourManagerBillingFromApiGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:635288116224:${ApiId}/*/*/tour-manager/*" --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Tour Manager billing API invoke permission failed." }
  } }
  if ($DryRun) {
    $summary = "DRY RUN: a real run would make $($script:PlannedChanges.Count) change(s), listed above as PLAN. Nothing was changed."
    Write-Host $summary
    if ($env:GITHUB_STEP_SUMMARY) {
      $lines = @("### Auth API dry run", "", $summary, "") + @($script:PlannedChanges | ForEach-Object { "- $_" }) + @("")
      Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY -Value $lines
    }
  } else {
    Write-Host "DanzStak Auth API authorization safeguards deployed successfully."
  }
} finally {
  Remove-Item -LiteralPath $Bundle -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $Policy -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $Environment -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $SesEventDestination -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $AccessLogSettingsFile -Force -ErrorAction SilentlyContinue
  $resolvedStage = [IO.Path]::GetFullPath($Stage)
  $resolvedTemp = [IO.Path]::GetFullPath($TempRoot).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  if ($resolvedStage.StartsWith($resolvedTemp, [StringComparison]::OrdinalIgnoreCase)) {
    Remove-Item -LiteralPath $resolvedStage -Recurse -Force -ErrorAction SilentlyContinue
  }
}
