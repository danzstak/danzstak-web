const fs = require("fs");
const assert = require("assert");

const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const editor = fs.readFileSync("assets/profile-editor.js", "utf8");

assert.match(template, /ProfileNamesTable:\s*[\s\S]*?TableName: DanzStak-ProfileNames/);
assert.match(template, /ProfileNamesTable:[\s\S]*?DeletionPolicy: Retain[\s\S]*?PointInTimeRecoveryEnabled: true/);
assert.match(template, /PROFILE_NAMES_TABLE: !Ref ProfileNamesTable/);
assert.match(template, /dynamodb:TransactWriteItems/);
assert.match(template, /TransactWriteItemsCommand/);
assert.match(template, /normalize\('NFKC'\)[\s\S]*?replace\(\/\\s\+\/g,' '\)[\s\S]*?toLocaleLowerCase\('en-US'\)/);
assert.match(template, /\['name','name#'\],\['handle','handle#'\]/);
assert.match(template, /attribute_not_exists\(#claim\) OR #owner = :owner/);
assert.match(template, /scanAll\(\{TableName:process\.env\.SETTINGS_TABLE,ProjectionExpression:'userEmail, profileName, profileHandle'\}\)/);
assert.match(template, /return json\(409,\{error:`That \$\{field==='name'[\s\S]*?Try \$\{requested\[field\]\}\.2/);
assert.match(template, /async function updateProfile\(event,user\)\{return updateProfileUnique\(event,user\);\}/);
assert.match(editor, /display name and username must each be unique/i);
assert.match(editor, /name="handle" minlength="3"/);

console.log("Unique-profile-name checks passed: names and usernames are atomically reserved and duplicates receive a numbered suggestion.");
