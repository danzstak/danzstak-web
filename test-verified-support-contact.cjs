const fs = require("fs");
const assert = require("assert");

for (const file of ["privacy.html", "terms.html", "support.html"]) {
  const source = fs.readFileSync(file, "utf8");
  assert.match(source, /mailto:support@danzstak\.com/, `${file} should publish the verified support mailbox`);
  assert.doesNotMatch(source, /email contacts will be added/i, `${file} must not describe the working mailbox as future work`);
}

console.log("Verified support contact is consistent across legal and support pages.");
