const fs = require('node:fs');
const assert = require('node:assert/strict');

const source = fs.readFileSync('aws-configure-production.ps1', 'utf8');

assert.match(source, /AutoVerifiedAttributes\D+email/);
assert.match(source, /Property\.Name -ne "PreSignUp"/);
assert.match(source, /AllowAdminCreateUserOnly/);
assert.match(source, /Verify your DanzStak account/);
assert.match(source, /verification code is \{####\}/);
assert.match(source, /never ask for your password or sell your personal information/i);

console.log('Public signup configuration checks passed: open registration, email verification, and branded copy.');
