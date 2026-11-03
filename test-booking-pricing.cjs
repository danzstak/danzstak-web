const assert = require("assert");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "booking-pricing.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "assets", "booking-pricing.css"), "utf8");

for (const text of ["Beginner", "The Bedroom", "Intermediate", "The Garage", "Professional", "The Rehearsal Room"]) assert(html.includes(text), `missing ${text}`);
assert(html.includes("$0.75") && html.includes("price_1UXkB5FgtfNMBXOVVeUOGJjX"), "contact unlock price mapping missing");
assert(html.includes("$1.50") && html.includes("price_1UXjMtFgtfNMBXOVCLeEk8vI"), "Tour Manager price mapping missing");
assert(html.includes("booking.html#venueQuickTitle"), "contact unlock must start from a selected club");
assert(html.includes("booking-selections.html#buyBookingCredits"), "Tour Manager must reuse existing checkout");
assert((html.match(/Coming Soon/g) || []).length >= 3, "unfinished features must be labeled Coming Soon");
assert((html.match(/loading="lazy"/g) || []).length === 3, "all pricing images should lazy load");
assert((html.match(/width="640" height="480"/g) || []).length === 3, "images need intrinsic dimensions");
for (const name of ["pricing-bedroom.webp", "pricing-garage.webp", "pricing-rehearsal-room.webp"]) {
  const imagePath = path.join(__dirname, "assets", name);
  assert(fs.existsSync(imagePath), `${name} missing`);
  assert(fs.statSync(imagePath).size < 100 * 1024, `${name} must remain below 100 KB`);
  assert(html.includes(`assets/${name}`), `${name} not used`);
}
assert(css.includes("grid-template-columns:repeat(3,minmax(0,1fr))"), "desktop should use three columns");
assert(css.includes("@media(max-width:900px)") && css.includes("grid-template-columns:1fr"), "mobile should stack cards");
console.log("booking pricing tests passed");
