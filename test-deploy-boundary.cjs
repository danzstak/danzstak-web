"use strict";
// D0 (owner 2026-11-22): the GitHub deploy role (infrastructure/github-deploy/bootstrap.yaml) must stay narrow. Data
// breaches are the main risk, so this reads the CloudFormation template (short tags included, scripts/cfn-yaml.cjs) and
// fails when:
//   - the trust policy accepts anything but this repository's production environment, by GitHub's permanent ids
//     (repo:danzstak@346346934/danzstak-web@1429660534:environment:production), with audience sts.amazonaws.com;
//   - the permission boundary lacks an unconditional Deny for: creating users or access keys, login profiles, any role
//     other than the app roles, reading secret values, Route 53 (the Zoho MX), Organizations, account and billing, or
//     loosening/deleting the boundary itself;
//   - any Allow names a wildcard role (role/*) or a role outside the app roles, grants secrets, or grants "*" / "iam:*";
//   - the account number is written into the template instead of ${AWS::AccountId}.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { parse } = require("./scripts/cfn-yaml.cjs");

const source = fs.readFileSync("infrastructure/github-deploy/bootstrap.yaml", "utf8");
const template = parse(source);
const ACCOUNT = "111122223333"; // stands in for ${AWS::AccountId} while matching ARNs
const resolve = value => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(resolve);
  if (value && typeof value === "object" && "Fn::Sub" in value) {
    assert.equal(typeof value["Fn::Sub"], "string", "!Sub takes a plain string here");
    return value["Fn::Sub"].replace(/\$\{AWS::AccountId\}/g, ACCOUNT).replace(/\$\{AWS::Region\}/g, "us-west-1");
  }
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, resolve(inner)]));
  return value;
};
const list = value => (value === undefined ? [] : Array.isArray(value) ? value : [value]);
const glob = pattern => new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`, "i");
const covers = (patterns, name) => list(patterns).some(pattern => glob(pattern).test(name));

assert.doesNotMatch(source, /(?<![0-9a-f])\d{12}(?![0-9a-f])/, "no account number in the template: use ${AWS::AccountId}");

const resources = template.Resources;
const byType = type => Object.entries(resources).filter(([, resource]) => resource.Type === type);

// --- OIDC provider (optional when the account already has one) -------------------------------------------------------
assert.equal(template.Parameters.CreateOidcProvider.Default, "true", "the provider is created unless the owner says the account has one");
assert.deepEqual(template.Parameters.CreateOidcProvider.AllowedValues, ["true", "false"]);
const [[providerId, provider]] = byType("AWS::IAM::OIDCProvider");
assert.equal(provider.Condition, "MakeOidcProvider", "the provider is conditional");
assert.deepEqual(template.Conditions.MakeOidcProvider, { "Fn::Equals": [{ Ref: "CreateOidcProvider" }, "true"] });
assert.equal(provider.Properties.Url, "https://token.actions.githubusercontent.com");
assert.deepEqual(provider.Properties.ClientIdList, ["sts.amazonaws.com"], "audience sts.amazonaws.com only");

// --- The role and its trust ------------------------------------------------------------------------------------------
const roles = byType("AWS::IAM::Role");
assert.equal(roles.length, 1, "the template makes one role");
const [[roleId, role]] = roles;
assert.equal(role.Properties.RoleName, "DanzStak-GitHub-Deploy");
assert.ok(role.Properties.MaxSessionDuration <= 3600, "sessions last at most an hour");
const trust = role.Properties.AssumeRolePolicyDocument.Statement;
assert.equal(trust.length, 1, "one trust statement");
const [statement] = trust;
assert.equal(statement.Effect, "Allow");
assert.equal(statement.Action, "sts:AssumeRoleWithWebIdentity", "web identity (OIDC) only");
assert.deepEqual(statement.Principal, {
  Federated: { "Fn::If": ["MakeOidcProvider", { Ref: providerId }, { "Fn::Sub": "arn:aws:iam::${AWS::AccountId}:oidc-provider/token.actions.githubusercontent.com" }] },
}, "trusted principal is GitHub's OIDC provider in this account, nothing else");
assert.deepEqual(Object.keys(statement.Condition), ["StringEquals"], "exact matching only (no StringLike wildcards)");
assert.deepEqual(statement.Condition.StringEquals, {
  "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
  // GitHub sends the owner's and repository's permanent ids in the subject (CloudTrail, deploy run 5, 2026-11-23):
  // the name-only form never matches, and a renamed or re-created repository can't take the role.
  "token.actions.githubusercontent.com:sub": "repo:danzstak@346346934/danzstak-web@1429660534:environment:production",
}, "only this repository's production environment (owner-approved runs) can assume the role");

// --- Policies: the boundary and the access policies -------------------------------------------------------------------
const policies = Object.fromEntries(byType("AWS::IAM::ManagedPolicy").map(([id, policy]) => [id, policy]));
const boundaryId = Object.keys(policies).find(id => policies[id].Properties.ManagedPolicyName === "DanzStakDeployBoundary");
assert.ok(boundaryId, "a managed policy named DanzStakDeployBoundary");
assert.deepEqual(role.Properties.PermissionsBoundary, { Ref: boundaryId }, "the role wears the boundary");
const accessIds = list(role.Properties.ManagedPolicyArns).map(arn => arn.Ref);
assert.ok(accessIds.length >= 1 && accessIds.every(id => policies[id] && id !== boundaryId), "the role's permissions are this template's own access policies");
assert.equal(role.Properties.Policies, undefined, "no inline policies on the role");
for (const [id, policy] of Object.entries(policies)) {
  assert.match(policy.Properties.ManagedPolicyName, /^DanzStakDeploy/, `${id} is named DanzStakDeploy* so the boundary protects it from edits`);
  const size = JSON.stringify(resolve(policy.Properties.PolicyDocument)).replace(/\s/g, "").length;
  assert.ok(size <= 6144, `${id} fits IAM's 6,144-character managed policy limit (${size})`);
}

const boundary = resolve(policies[boundaryId].Properties.PolicyDocument).Statement;
const denies = boundary.filter(item => item.Effect === "Deny");
const unconditionalDeny = (action, resource = "*") => denies.some(item =>
  !item.Condition && covers(item.Action, action) &&
  (item.Resource ? covers(item.Resource, resource) : item.NotResource ? !covers(item.NotResource, resource) : false));

const required = [
  "iam:CreateUser", "iam:CreateAccessKey", "iam:CreateLoginProfile", "iam:UpdateLoginProfile", "iam:DeleteLoginProfile",
  "secretsmanager:GetSecretValue", "route53:ChangeResourceRecordSets", "route53:DeleteHostedZone",
  "organizations:LeaveOrganization", "account:CloseAccount", "aws-portal:ModifyBilling", "billing:UpdateBillingPreferences",
  "iam:PutRolePermissionsBoundary", "iam:DeleteRolePermissionsBoundary", "iam:CreateOpenIDConnectProvider",
  "iam:UpdateOpenIDConnectProviderThumbprint", "sts:AssumeRole",
];
for (const action of required) assert.ok(unconditionalDeny(action), `the boundary denies ${action} on everything`);
for (const action of ["iam:DeletePolicy", "iam:CreatePolicyVersion", "iam:SetDefaultPolicyVersion", "iam:DeletePolicyVersion"]) {
  for (const name of ["DanzStakDeployBoundary", ...accessIds.map(id => policies[id].Properties.ManagedPolicyName)]) {
    assert.ok(unconditionalDeny(action, `arn:aws:iam::${ACCOUNT}:policy/${name}`), `the boundary denies ${action} on ${name} (it can't loosen or delete its own limits)`);
  }
}

// Roles: everything on any role except the app roles is denied; the deploy role itself is never an exception.
// The Auth API role was made by the Lambda console, so it lives under the /service-role/ path: its ARN is
// role/service-role/DANZSTAK-Auth-API-role-zjknf4ur. Deploy run 6 (2026-11-23) failed on iam:ListAttachedRolePolicies
// because every ARN here left the path out, so no Allow matched (and the boundary would have denied it too).
const appRoles = [
  `arn:aws:iam::${ACCOUNT}:role/service-role/DANZSTAK-Auth-API-role-zjknf4ur`,
  `arn:aws:iam::${ACCOUNT}:role/DANZSTAK-Call-Signaling-SignalingRole-*`,
  `arn:aws:iam::${ACCOUNT}:role/DANZSTAK-Call-Signaling-StoryCleanupRole-*`,
];
for (const match of source.matchAll(/:role\/[^'"\s]*DANZSTAK-Auth-API-role[^'"\s]*/g)) {
  assert.equal(match[0], ":role/service-role/DANZSTAK-Auth-API-role-zjknf4ur", `the Auth API role is named with its /service-role/ path (${match[0]})`);
}
const otherRoles = ["DanzStak-GitHub-Deploy", "DANZSTAK-Posts-API-role-x", "DanzStakCognitoAllowlistRole", "OrganizationAccountAccessRole", "Admin", "DANZSTAK-Auth-API-role-other"];
for (const name of otherRoles) {
  for (const action of ["iam:PassRole", "iam:AttachRolePolicy", "iam:PutRolePolicy", "iam:UpdateAssumeRolePolicy", "iam:CreateRole", "iam:DeleteRole", "iam:CreateServiceLinkedRole"]) {
    assert.ok(unconditionalDeny(action, `arn:aws:iam::${ACCOUNT}:role/${name}`), `the boundary denies ${action} on role ${name}`);
  }
}
const roleDeny = denies.find(item => item.NotResource && covers(item.Action, "iam:PassRole"));
assert.deepEqual(list(roleDeny.NotResource).sort(), [...appRoles].sort(), "the only roles outside the role Deny are the app roles");
// Attaching anything but DanzStak* (or Lambda's basic logging policy) to an app role is denied, as is attaching the deploy policies.
const attachDeny = denies.find(item => item.Condition?.ArnNotLike?.["iam:PolicyARN"] && covers(item.Action, "iam:AttachRolePolicy"));
assert.ok(attachDeny, "attaching a non-DanzStak policy (AdministratorAccess) is denied");
assert.deepEqual(list(attachDeny.Condition.ArnNotLike["iam:PolicyARN"]).sort(), [`arn:aws:iam::${ACCOUNT}:policy/DanzStak*`, "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"].sort());
assert.ok(denies.some(item => covers(item.Action, "iam:AttachRolePolicy") && item.Condition?.ArnLike?.["iam:PolicyARN"] === `arn:aws:iam::${ACCOUNT}:policy/DanzStakDeploy*`), "the deploy policies can't be attached to an app role");
// Member data and media stay out of reach.
for (const action of ["dynamodb:GetItem", "dynamodb:Scan", "dynamodb:Query", "dynamodb:PutItem", "dynamodb:DeleteTable", "dynamodb:ExportTableToPointInTime"]) {
  assert.ok(unconditionalDeny(action, `arn:aws:dynamodb:us-west-1:${ACCOUNT}:table/DANZSTAK-Posts`), `the boundary denies ${action} (member data)`);
}
assert.ok(unconditionalDeny("s3:GetObject", "arn:aws:s3:::danzstak-call-signaling-mediabucket-abc/uploads/photo.jpg"), "member media can't be read");
assert.ok(!unconditionalDeny("s3:PutObject", "arn:aws:s3:::danzstak-call-signaling-mediabucket-abc/deploy-artifacts/call-signaling-x.yaml"), "deploy artifacts can still be uploaded");
assert.ok(unconditionalDeny("kms:Sign") && unconditionalDeny("kms:Decrypt") && unconditionalDeny("lambda:InvokeFunction"), "no key use and no running the app's functions");

// --- Allows: narrow, no wildcard roles, no secrets ----------------------------------------------------------------------
const allows = accessIds.flatMap(id => resolve(policies[id].Properties.PolicyDocument).Statement);
for (const item of allows) {
  assert.equal(item.Effect, "Allow", `${item.Sid}: access policies only allow (denies live in the boundary)`);
  assert.ok(item.Resource && !item.NotResource && !item.NotAction, `${item.Sid}: plain Action/Resource statements`);
  for (const action of list(item.Action)) {
    assert.notEqual(action, "*", `${item.Sid} grants "*"`);
    assert.doesNotMatch(action, /^[\w-]+:\*$/, `${item.Sid} grants a whole service (${action})`);
    assert.doesNotMatch(action, /^(secretsmanager|ssm|route53|route53domains|organizations|account|aws-portal|billing|sts):/i, `${item.Sid} grants ${action}`);
    assert.ok(!/^iam:(CreateUser|CreateAccessKey|.*LoginProfile)$/i.test(action), `${item.Sid} grants ${action}`);
  }
  for (const resource of list(item.Resource)) {
    if (/:role\//.test(resource)) {
      assert.doesNotMatch(resource, /:role\/\*?$|:role\/\*/, `${item.Sid} names a wildcard role (${resource})`);
      assert.ok(appRoles.includes(resource), `${item.Sid} names a role outside the app roles (${resource})`);
    }
    if (resource === "*") {
      assert.ok(list(item.Action).every(action => /^(cloudformation:(ValidateTemplate|GetTemplateSummary)|sms-voice:Describe\w+)$/.test(action)) || item.Condition?.["ForAnyValue:StringEquals"]?.["aws:CalledVia"],
        `${item.Sid}: "*" only for read-only template checks or calls CloudFormation makes for the stack`);
    }
  }
}
// iam:PassRole only for the app roles, only to Lambda.
const pass = allows.filter(item => list(item.Action).some(action => covers(action, "iam:PassRole")));
assert.equal(pass.length, 1, "one PassRole statement");
assert.deepEqual(list(pass[0].Resource).sort(), [...appRoles].sort(), "PassRole only for the app roles");
assert.deepEqual(pass[0].Condition, { StringEquals: { "iam:PassedToService": "lambda.amazonaws.com" } }, "and only to Lambda");
// DanzStak* managed policies only, attached only to the two app roles named in the plan.
const attach = allows.filter(item => list(item.Action).includes("iam:AttachRolePolicy") && !item.Condition?.["ForAnyValue:StringEquals"]);
assert.equal(attach.length, 1, "one direct attach statement (the stack's own role updates go through CloudFormation)");
assert.deepEqual(list(attach[0].Resource).sort(), appRoles.slice(0, 2).sort(), "direct attach only on DANZSTAK-Auth-API-role and the call-signaling SignalingRole");
assert.equal(attach[0].Condition.ArnLike["iam:PolicyARN"], `arn:aws:iam::${ACCOUNT}:policy/DanzStak*`, "and only DanzStak* policies");
for (const item of allows.filter(entry => list(entry.Action).some(action => /^iam:(CreatePolicy|CreatePolicyVersion)$/.test(action)))) {
  assert.deepEqual(list(item.Resource), [`arn:aws:iam::${ACCOUNT}:policy/DanzStak*`], "only DanzStak* managed policies are created or updated");
}
// The CloudFormation statements cover only the DANZSTAK-Call-Signaling stack (and read the Engagement stack's outputs).
for (const item of allows.filter(entry => list(entry.Action).some(action => /^cloudformation:(CreateChangeSet|ExecuteChangeSet)$/.test(action)))) {
  for (const resource of list(item.Resource)) assert.match(resource, /:stack\/DANZSTAK-Call-Signaling\/\*$|:changeSet\/github-\*\/\*$/, `change sets only on the call-signaling stack (${resource})`);
}

console.log(`Deploy boundary checks passed: trust = this repository's production environment only (by GitHub's permanent ids); ${denies.length} boundary Denies cover users/keys, other roles, secret values, DNS, Organizations, account, billing, member data and the boundary itself; ${allows.length} Allow statements name no wildcard role and no secrets; PassRole only to Lambda for the app roles.`);
