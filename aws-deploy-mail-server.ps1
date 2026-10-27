$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false

$Region = "us-west-1"
$StackName = "DanzStak-Mail-Server"
$Template = ".\infrastructure\mail-server\template.yaml"
$VpcId = "vpc-0fec060bac0007a9e"
$SubnetId = "subnet-014d748201e63eaab"
$HostedZoneId = "Z0864481MZJ0HPSLQPR9"
$AmiId = aws ssm get-parameter --region $Region --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64 --query "Parameter.Value" --output text
if ($LASTEXITCODE -ne 0 -or -not $AmiId) { throw "Could not resolve the current Amazon Linux 2023 Arm64 AMI." }

aws cloudformation validate-template --region $Region --template-body "file://$Template" --output json | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Mail server template validation failed." }

aws cloudformation deploy --region $Region --stack-name $StackName --template-file $Template --capabilities CAPABILITY_IAM --no-fail-on-empty-changeset --parameter-overrides VpcId=$VpcId SubnetId=$SubnetId HostedZoneId=$HostedZoneId AmiId=$AmiId MailHostname=inbox.danzstak.com InstanceType=t4g.small
if ($LASTEXITCODE -ne 0) { throw "Mail server stack deployment failed." }

aws cloudformation describe-stacks --region $Region --stack-name $StackName --query "Stacks[0].Outputs" --output table
