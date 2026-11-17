"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
// Owner 2026-11-17: members can send themselves a test notification to check SYNC reaches their devices.
const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
assert.match(template, /RouteKey: POST \/push\/test/);
assert.match(template, /TestPushInvokePermission:[^\n]*\/\*\/POST\/push\/test/, "API Gateway may invoke the test route (a missing permission returns 500)");
assert.match(template, /if\(key==='POST \/push\/test'\)return await testPush\(event,user\)/);
assert.match(template, /async function testPush\(event,user\)\{const items=await queryAll\(\{TableName:process\.env\.PUSH_SUBSCRIPTIONS_TABLE,KeyConditionExpression:'userEmail = :u'/, "a test only goes to the member's own devices");
assert.match(template, /Wait a minute before sending another test/, "tests are rate limited");
assert.match(template, /dynamodb:UpdateItem\]\s+Resource: !GetAtt PushSubscriptionsTable\.Arn/);
assert.match(fs.readFileSync("messages.html", "utf8"), /id="pushTestButton"/);
assert.match(fs.readFileSync("assets/push-notifications.js", "utf8"), /api\("\/push\/test"/);
console.log("Push test checks passed: own devices only, rate limited, button in SYNC device settings.");
