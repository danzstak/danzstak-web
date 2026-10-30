const assert = require("node:assert/strict");
const fs = require("node:fs");

const markup = fs.readFileSync("booking-selections.html", "utf8");
const client = fs.readFileSync("assets/booking-selections.js", "utf8");
const styles = fs.readFileSync("assets/booking-selections.css", "utf8");

for (const control of ["printVenueSheet", "downloadVenueCsv", "clearVenueSelections", "selectedVenueCards"]) {
  assert.match(markup, new RegExp(`id=["']${control}["']`), `${control} must be available on the contact sheet`);
}
assert.match(client, /sessionStorage\.setItem\(storageKey, JSON\.stringify\(venues\)\)/, "removed leads must stay removed");
assert.match(client, /venues\.splice\(index, 1\)/, "individual leads must be removable");
assert.match(client, /window\.confirm\("Clear every selected club/, "clearing every lead must be confirmed");
assert.match(client, /window\.print\(\)/, "the contact sheet must be printable");
assert.match(client, /text\/csv;charset=utf-8/, "the contact sheet must export CSV");
assert.match(client, /booking\.outreachDraft = draft\.value/, "edited outreach drafts must survive rerenders and tab refreshes");
assert.match(client, /venue\.booking\?\.outreachDraft/, "CSV exports must include the reviewed outreach draft");
assert.match(client, /venue\.activityEvidence/, "current-activity evidence must remain visible");
assert.match(client, /listingCheckedText\(venue\.discoveredAt\)/, "the discovery date must remain visible on the saved contact sheet");
assert.match(client, /source\.textContent = `Source: \$\{String\(evidence\.name\)\}`/, "sources without an external URL must remain visible");
assert.match(client, /venueSources\(venue\)\.map\(source => source\.name\)/, "CSV exports must preserve every discovery source");
assert.match(client, /"Source name", "Source URL", "Listing checked"/, "CSV exports must preserve separate source and freshness evidence");
assert.match(client, /\^https:\\\/\\\//, "only HTTPS venue and source links may open externally");
assert.match(styles, /@media print/, "the printed contact sheet needs a dedicated layout");
assert.match(styles, /button:focus-visible,a:focus-visible/, "contact-sheet actions need a visible keyboard focus state");

console.log("Booking contact-sheet checks passed: removable leads, evidence, source attribution, print, and CSV export.");
