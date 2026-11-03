const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = file => fs.readFileSync(file, "utf8");
const api = read("infrastructure/auth-api/index.mjs");
const deploy = read("aws-deploy-auth-api.ps1");
const page = read("radio-stations.html");
const client = read("assets/radio-stations.js");
const worker = read("service-worker.js");

assert.match(api, /function isRadioStation\(place\)/);
assert.match(api, /kind === "radio-station"/);
assert.match(api, /community radio station/);
assert.match(api, /college radio station/);
assert.match(api, /internet radio station/);
assert.match(api, /async function searchRadioStations\(event\)/);
assert.match(api, /const radioStationWorkspaceId = "radio-station-workspace-v1"/);
assert.match(api, /ConditionExpression: data\.revision \? "revision = :revision" : "attribute_not_exists\(userId\)"/);
assert.match(api, /path === "\/radio-stations\/search"/);
assert.match(api, /path === "\/radio-station-workspace"/);
assert.match(deploy, /POST \/radio-stations\/search/);
assert.match(deploy, /GET \/radio-station-workspace/);
assert.match(deploy, /POST \/radio-station-workspace/);

for (const id of ["radioStationForm", "radioLocation", "radioGenre", "radioResults", "radioWorkspace", "saveRadioWorkspace"]) assert.match(page, new RegExp(`id="${id}"`));
assert.match(client, /credentials:"include"/);
assert.match(client, /noopener noreferrer/);
assert.match(client, /workspace\.stations\.push/);
assert.match(client, /proposedDate/);
assert.match(client, /proposedTime/);
assert.match(client, /EPK:/);
assert.match(client, /Verify the program and contact before outreach/i);
assert.doesNotMatch(client, /innerHTML\s*=/);
assert.match(worker, /"\/radio-stations\.html"/);
assert.match(worker, /"\/assets\/radio-stations\.js"/);
assert.match(worker, /"\/assets\/radio-stations\.css"/);

console.log("Radio discovery and saved outreach workspace checks passed.");
