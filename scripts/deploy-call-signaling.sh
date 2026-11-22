#!/usr/bin/env bash
# D0 (owner 2026-11-22): deploy infrastructure/call-signaling/template.yaml to the DANZSTAK-Call-Signaling stack through a
# reviewed CloudFormation change set. Run by .github/workflows/deploy.yml (role DanzStak-GitHub-Deploy), or by hand in
# CloudShell with the same result.
#
#   DRY_RUN=true  (default) create the change set, print it, delete it. Nothing changes.
#   DRY_RUN=false create the change set, print it, execute it and wait for the stack.
#
# Every parameter keeps the stack's current value (UsePreviousValue), so a deploy never flips MediaCdnServe,
# MediaSigningPublicKeyId or DeviceSmsOtpRequired by accident. A change set that would replace or remove a stateful
# resource (a table, the media bucket, the push key, the CDN distribution) stops the run: that needs the owner in
# CloudShell, on purpose.
set -euo pipefail

REGION="us-west-1"
STACK="DANZSTAK-Call-Signaling"
TEMPLATE="infrastructure/call-signaling/template.yaml"
DRY_RUN="${DRY_RUN:-true}"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"
SHA="${GITHUB_SHA:-$(git rev-parse HEAD)}"
CHANGE_SET="github-${GITHUB_RUN_ID:-manual$(date +%s)}-${GITHUB_RUN_ATTEMPT:-1}"
export AWS_PAGER=""

if [ "$DRY_RUN" != "true" ] && [ "$DRY_RUN" != "false" ]; then
  echo "DRY_RUN must be true or false (got '$DRY_RUN')." >&2
  exit 2
fi

bucket=$(aws cloudformation describe-stack-resource --region "$REGION" --stack-name "$STACK" --logical-resource-id MediaBucket \
  --query 'StackResourceDetail.PhysicalResourceId' --output text)
case "$bucket" in
  danzstak-call-signaling-mediabucket-*) ;;
  *) echo "Unexpected media bucket name; stopping." >&2; exit 1 ;;
esac

# The template is over CloudFormation's 51,200-byte inline limit, so it goes to the stack's bucket under deploy-artifacts/.
key="deploy-artifacts/call-signaling-${SHA}.yaml"
aws s3 cp "$TEMPLATE" "s3://${bucket}/${key}" --region "$REGION" --only-show-errors
template_url="https://${bucket}.s3.${REGION}.amazonaws.com/${key}"

# Keep every current parameter value that the new template still has; new parameters take their template defaults.
stack_params=$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" --query 'Stacks[0].Parameters[].ParameterKey' --output text | tr '\t' '\n')
template_params=$(aws cloudformation get-template-summary --region "$REGION" --template-url "$template_url" --query 'Parameters[].ParameterKey' --output text | tr '\t' '\n')
params=()
for name in $stack_params; do
  if printf '%s\n' $template_params | grep -qx "$name"; then params+=("ParameterKey=${name},UsePreviousValue=true"); fi
done

echo "Creating change set ${CHANGE_SET} for ${STACK} at ${SHA:0:7} (dry run: ${DRY_RUN})."
aws cloudformation create-change-set --region "$REGION" --stack-name "$STACK" --change-set-name "$CHANGE_SET" \
  --change-set-type UPDATE --template-url "$template_url" --capabilities CAPABILITY_NAMED_IAM \
  --description "GitHub deploy ${SHA:0:7}" ${params[@]+"--parameters"} ${params[@]+"${params[@]}"} --output text >/dev/null

if ! aws cloudformation wait change-set-create-complete --region "$REGION" --stack-name "$STACK" --change-set-name "$CHANGE_SET" 2>/dev/null; then
  reason=$(aws cloudformation describe-change-set --region "$REGION" --stack-name "$STACK" --change-set-name "$CHANGE_SET" --query StatusReason --output text)
  aws cloudformation delete-change-set --region "$REGION" --stack-name "$STACK" --change-set-name "$CHANGE_SET" || true
  if printf '%s' "$reason" | grep -qiE "didn't contain changes|No updates are to be performed"; then
    echo "No changes: the stack already matches ${SHA:0:7}."
    printf '### Call-signaling\n\nNo changes: the stack already matches `%s`.\n\n' "${SHA:0:7}" >> "$SUMMARY"
    exit 0
  fi
  echo "Change set failed: ${reason}" >&2
  exit 1
fi

changes=$(aws cloudformation describe-change-set --region "$REGION" --stack-name "$STACK" --change-set-name "$CHANGE_SET" \
  --query 'Changes[].ResourceChange.[Action,LogicalResourceId,ResourceType,Replacement]' --output text)
echo "Planned changes (action, resource, type, replacement):"
printf '%s\n' "$changes"
{
  printf '### Call-signaling change set `%s`\n\n| Action | Resource | Type | Replacement |\n|---|---|---|---|\n' "$CHANGE_SET"
  printf '%s\n' "$changes" | awk -F'\t' 'NF { printf "| %s | %s | %s | %s |\n", $1, $2, $3, $4 }'
  printf '\n'
} >> "$SUMMARY"

risky=$(printf '%s\n' "$changes" | awk -F'\t' '($3 ~ /^AWS::(DynamoDB::Table|S3::Bucket|KMS::Key|CloudFront::Distribution)$/) && ($1 == "Remove" || $4 == "True" || $4 == "Conditional") { print $2 }')
if [ -n "$risky" ]; then
  echo "Stopping: this change set would replace or remove stateful resources: $(echo $risky). Deploy that one from CloudShell after review." >&2
  aws cloudformation delete-change-set --region "$REGION" --stack-name "$STACK" --change-set-name "$CHANGE_SET" || true
  exit 1
fi

if [ "$DRY_RUN" != "false" ]; then
  aws cloudformation delete-change-set --region "$REGION" --stack-name "$STACK" --change-set-name "$CHANGE_SET"
  echo "Dry run: change set printed and deleted. Nothing changed."
  printf 'Dry run: nothing changed.\n\n' >> "$SUMMARY"
  exit 0
fi

aws cloudformation execute-change-set --region "$REGION" --stack-name "$STACK" --change-set-name "$CHANGE_SET"
if ! aws cloudformation wait stack-update-complete --region "$REGION" --stack-name "$STACK"; then
  status=$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" --query 'Stacks[0].StackStatus' --output text)
  echo "Stack update did not complete: ${status}" >&2
  aws cloudformation describe-stack-events --region "$REGION" --stack-name "$STACK" --max-items 15 \
    --query "StackEvents[?contains(ResourceStatus, 'FAILED')].[LogicalResourceId,ResourceStatus,ResourceStatusReason]" --output text >&2 || true
  printf 'Stack update did not complete: %s\n\n' "$status" >> "$SUMMARY"
  exit 1
fi
echo "Call-signaling deployed at ${SHA:0:7}."
printf 'Deployed at `%s`.\n\n' "${SHA:0:7}" >> "$SUMMARY"
