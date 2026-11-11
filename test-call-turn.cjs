"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const chat = fs.readFileSync("assets/chat.js", "utf8");
const signaling = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const relay = fs.readFileSync("infrastructure/sync-turn/template.yaml", "utf8");
const deploy = fs.readFileSync("aws-deploy-production.ps1", "utf8");

assert.doesNotMatch(chat, /stun\.l\.google\.com|stun[0-9]*\.l\.google\.com/, "SYNC calls must not depend on Google STUN");
assert.match(chat, /request\("\/calls\/ice"\)/, "the browser must request short-lived relay credentials from DanzStak");
assert.match(chat, /new RTCPeerConnection\(\{iceServers,iceCandidatePoolSize:4\}\)/, "calls must use the returned ICE server set");
assert.doesNotMatch(chat, /accessKeyId|secretAccessKey|sessionToken/, "the browser must never contain AWS credentials");

assert.match(signaling, /async function getCallIceServers\(event,user\)\{if\(!\(await authenticatedCallingDevice\(event,user\)\)\)/, "TURN credentials must require an OTP-verified calling device");
assert.match(signaling, /GetSignalingChannelEndpointCommand/, "the API must resolve the managed Kinesis Video signaling endpoint");
assert.match(signaling, /GetIceServerConfigCommand/, "the API must issue short-lived managed TURN credentials");
assert.match(signaling, /RouteKey: GET \/calls\/ice/, "API Gateway must expose the authenticated ICE endpoint");
assert.match(signaling, /kinesisvideo:GetSignalingChannelEndpoint, kinesisvideo:GetIceServerConfig/, "the Lambda must have only the required Kinesis Video actions");
assert.match(signaling, /Resource: !Ref TurnChannelArn/, "relay permissions must be scoped to the configured DanzStak channel");

assert.match(relay, /Type: AWS::KinesisVideo::SignalingChannel/, "the relay credential source must be reproducible infrastructure");
assert.match(relay, /Name: DANZSTAK-SYNC-TURN/, "the managed channel must be DanzStak-specific");
assert.match(deploy, /DANZSTAK-SYNC-TURN/, "the production workflow must deploy the relay before the call API");
assert.match(deploy, /TurnChannelArn=\$turnChannelArn/, "the call API deployment must receive the scoped channel ARN");

console.log("SYNC relay checks passed: private credential endpoint, verified-device gate, scoped AWS relay, and no Google STUN.");
