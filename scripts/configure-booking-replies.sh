#!/usr/bin/env bash
# Routes venue / record-shop / radio replies (<token>@reply.danzstak.com) into the artist's SYNC booking thread.
# Bash port of aws-configure-booking-replies.ps1 for AWS CloudShell. Only touches the reply.danzstak.com
# subdomain; the root danzstak.com MX (Zoho mailboxes) and the support@ receipt rule are left unchanged.
set -euo pipefail
REGION=us-east-1; APP_REGION=us-west-1
RULE_SET=DanzStakSupportMail; RULE=BookingReplies
FN=DANZSTAK-Booking-Inbound; ROLE=DANZSTAK-Booking-Inbound-role
HERE="$(cd "$(dirname "$0")/.." && pwd)"; SRC="$HERE/infrastructure/booking-inbound"
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
ZONE=$(aws route53 list-hosted-zones-by-name --dns-name danzstak.com --query "HostedZones[?Name=='danzstak.com.'].Id | [0]" --output text | sed 's#/hostedzone/##')
BUCKET="danzstak-booking-replies-$ACCOUNT-$REGION"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
node --check "$SRC/index.mjs"

echo "1/6 MX for reply.danzstak.com"
cat > "$TMP/dns.json" <<JSON
{"Comment":"Route DanzStak booking replies to SES","Changes":[{"Action":"UPSERT","ResourceRecordSet":{"Name":"reply.danzstak.com","Type":"MX","TTL":300,"ResourceRecords":[{"Value":"10 inbound-smtp.$REGION.amazonaws.com"}]}}]}
JSON
aws route53 change-resource-record-sets --hosted-zone-id "$ZONE" --change-batch "file://$TMP/dns.json" --query ChangeInfo.Status --output text

echo "2/6 private bucket"
aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null || aws s3api create-bucket --region "$REGION" --bucket "$BUCKET" >/dev/null
aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-encryption --bucket "$BUCKET" --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" --lifecycle-configuration '{"Rules":[{"ID":"ExpireRawBookingReplies","Status":"Enabled","Filter":{"Prefix":"incoming/"},"Expiration":{"Days":30}}]}'
cat > "$TMP/bucket.json" <<JSON
{"Version":"2012-10-17","Statement":[
 {"Sid":"AllowSesReceipt","Effect":"Allow","Principal":{"Service":"ses.amazonaws.com"},"Action":"s3:PutObject","Resource":"arn:aws:s3:::$BUCKET/incoming/*","Condition":{"StringEquals":{"AWS:SourceAccount":"$ACCOUNT"},"ArnLike":{"AWS:SourceArn":"arn:aws:ses:$REGION:$ACCOUNT:receipt-rule-set/$RULE_SET:receipt-rule/$RULE"}}},
 {"Sid":"DenyInsecureTransport","Effect":"Deny","Principal":"*","Action":"s3:*","Resource":["arn:aws:s3:::$BUCKET","arn:aws:s3:::$BUCKET/*"],"Condition":{"Bool":{"aws:SecureTransport":"false"}}}]}
JSON
aws s3api put-bucket-policy --bucket "$BUCKET" --policy "file://$TMP/bucket.json"

echo "3/6 Lambda role"
cat > "$TMP/trust.json" <<'JSON'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}
JSON
aws iam get-role --role-name "$ROLE" >/dev/null 2>&1 || { aws iam create-role --role-name "$ROLE" --assume-role-policy-document "file://$TMP/trust.json" >/dev/null; sleep 10; }
cat > "$TMP/policy.json" <<JSON
{"Version":"2012-10-17","Statement":[
 {"Effect":"Allow","Action":["logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents"],"Resource":"arn:aws:logs:$REGION:$ACCOUNT:*"},
 {"Effect":"Allow","Action":"s3:GetObject","Resource":"arn:aws:s3:::$BUCKET/incoming/*"},
 {"Effect":"Allow","Action":["dynamodb:GetItem","dynamodb:TransactWriteItems"],"Resource":"arn:aws:dynamodb:$APP_REGION:$ACCOUNT:table/DANZSTAK-Tours"}]}
JSON
aws iam put-role-policy --role-name "$ROLE" --policy-name DanzStakBookingInbound --policy-document "file://$TMP/policy.json"

echo "4/6 Lambda"
cp "$SRC/index.mjs" "$SRC/mime.mjs" "$SRC/package.json" "$SRC/package-lock.json" "$TMP/"
(cd "$TMP" && npm ci --omit=dev --ignore-scripts --no-audit --no-fund >/dev/null && zip -qr bundle.zip index.mjs mime.mjs package.json node_modules)
if aws lambda get-function --region "$REGION" --function-name "$FN" >/dev/null 2>&1; then
  aws lambda update-function-code --region "$REGION" --function-name "$FN" --zip-file "fileb://$TMP/bundle.zip" --query LastUpdateStatus --output text
else
  sleep 8
  aws lambda create-function --region "$REGION" --function-name "$FN" --runtime nodejs22.x --handler index.handler \
    --role "arn:aws:iam::$ACCOUNT:role/$ROLE" --zip-file "fileb://$TMP/bundle.zip" --timeout 20 --memory-size 256 \
    --environment "Variables={APP_REGION=$APP_REGION,INBOUND_BUCKET=$BUCKET,TOURS_TABLE=DANZSTAK-Tours}" --query State --output text
fi
aws lambda wait function-updated --region "$REGION" --function-name "$FN"
aws lambda add-permission --region "$REGION" --function-name "$FN" --statement-id AllowSesBookingReplies --action lambda:InvokeFunction \
  --principal ses.amazonaws.com --source-account "$ACCOUNT" --source-arn "arn:aws:ses:$REGION:$ACCOUNT:receipt-rule-set/$RULE_SET:receipt-rule/$RULE" >/dev/null 2>&1 || true

echo "5/6 receipt rule (support@ rule untouched)"
cat > "$TMP/rule.json" <<JSON
{"RuleSetName":"$RULE_SET","Rule":{"Name":"$RULE","Enabled":true,"TlsPolicy":"Require","Recipients":["reply.danzstak.com"],"ScanEnabled":true,
 "Actions":[{"S3Action":{"BucketName":"$BUCKET","ObjectKeyPrefix":"incoming/"}},{"LambdaAction":{"FunctionArn":"arn:aws:lambda:$REGION:$ACCOUNT:function:$FN","InvocationType":"Event"}}]}}
JSON
aws ses create-receipt-rule --region "$REGION" --cli-input-json "file://$TMP/rule.json" 2>/dev/null || aws ses update-receipt-rule --region "$REGION" --cli-input-json "file://$TMP/rule.json"

echo "6/6 verify"
aws ses describe-active-receipt-rule-set --region "$REGION" --query "Rules[].Name" --output text
echo REPLIES-CONFIGURED
