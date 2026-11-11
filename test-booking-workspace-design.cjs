const fs = require("node:fs");
const assert = require("node:assert/strict");

const html = fs.readFileSync("booking.html", "utf8");
const css = fs.readFileSync("assets/booking-workspace.css", "utf8");
const conversation = fs.readFileSync("assets/booking-conversation.js", "utf8");
const agent = fs.readFileSync("assets/booking-agent.js", "utf8");
const map = fs.readFileSync("assets/booking-map.js", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");

assert.match(html, /class="tool-header"/);
assert.match(html, /class="tool-brand"[\s\S]*?<span>DANZSTAK<\/span>/);
assert.match(html, /<section class="booking-start"[\s\S]*?<section class="booking-identity"[\s\S]*?<section class="booking-brief"/);
assert.match(html, /<h1 id="bookingBriefTitle">Where do you want to play\?<\/h1>/);
assert.match(html, />Plan my run<\/button>/);
assert.match(html, /Exact dates are optional while researching/);
assert.match(html, /id="bookingBriefExample">Example<\/button>/);
assert.match(html, /<details class="booking-tools">[\s\S]*?<summary>Use the map or fill in the details yourself<\/summary>/);
assert.match(html, /<details class="planner-drawer">[\s\S]*?<summary>More tour options: genre, crew, van and budget<\/summary>/);
assert.match(html, /assets\/booking-workspace\.css\?v=10/);
assert.match(html, /assets\/booking-map\.js\?v=449/);
assert.match(html, /assets\/booking-discovery\.css\?v=3/);
assert.match(html, /assets\/booking-discovery\.js\?v=4/);
assert.match(html, /assets\/booking-agent\.js\?v=488/);
assert.match(html, /assets\/booking-conversation\.js\?v=480/);

assert.match(css, /\.booking-start[\s\S]*grid-template-columns: minmax\(270px, \.8fr\) minmax\(420px, 1\.2fr\)/);
assert.match(css, /\.booking-page \.booking-lead[\s\S]*border-top: 3px solid var\(--booking-orange\)/);
assert.match(css, /\.booking-page \.booking-brief-actions[\s\S]*grid-template-columns: minmax\(150px, 1fr\) auto/);
assert.match(css, /\.booking-page \.venue-quick-search[\s\S]*grid-template-columns: minmax\(240px, \.8fr\) minmax\(340px, 1\.2fr\)/);
assert.match(css, /@media \(max-width: 700px\)/);
assert.match(css, /@media \(max-width: 700px\)[\s\S]*\.booking-page \.tool-header nav\s*\{[\s\S]*?display: none;/,
  "phone Booking must not duplicate the fixed bottom navigation with desktop tool links");
assert.match(css, /@media \(max-width: 700px\)[\s\S]*\.booking-page \.booking-brief textarea\s*\{[\s\S]*?font-size: 16px;/,
  "phone Booking fields must not trigger iOS focus zoom");
assert.match(css, /min-height: 44px/);
assert.match(css, /\.route-cost-summary/);
assert.match(css, /\.market-research/);
assert.match(css, /\.tour-sheet-workspace/);
assert.match(css, /table\.tour-calendar/);
assert.match(css, /\.route-research-workspace/);
assert.match(css, /\.tour-calendar tbody tr[\s\S]*grid-template-columns: 48px minmax\(0,1fr\)/, "phone day sheet must become readable cards instead of a clipped desktop table");

assert.match(conversation, /let requestStarted = false/);
assert.match(conversation, /requestStarted = true/);
assert.match(conversation, /if \(requestStarted\) status\.textContent = routeStatus\.textContent/);
assert.match(conversation, /const home = field\("startCity"\)\?\.value\.trim\(\)/);
assert.match(conversation, /then press Plan my run again/);
assert.doesNotMatch(conversation, /Momo, Italy|The Rats\./);

assert.match(agent, /deadline = started \+ 5 \* 60 \* 1000/);
assert.match(agent, /runRouteResearch\(automaticResearch, renderGeneration\)/);
assert.match(agent, /Research clubs in/);
assert.match(agent, /Add to booking list/);
assert.match(agent, /route-cost-summary/);
assert.match(agent, /data-route-budget-input="averageShowPay"/);
assert.match(agent, /data-route-budget-input="averageMerchPerShow"/);
assert.match(agent, /Projected money in/);
assert.match(agent, /Break-even per show/);
assert.match(agent, /projectedIncome - finishBudget/);
assert.match(agent, /<th>Sleep plan<\/th>/);
assert.match(agent, /Sleeper van · parking permission needed/);
assert.match(agent, /permission required/);
assert.match(agent, /Budget room needed/);
assert.match(agent, /Host or couch lead needed/);
assert.match(agent, /Leg miles are estimates/);
assert.match(agent, /directMiles \* 1\.18/);
assert.match(agent, /≈\$\{legMiles\} road mi/);
assert.match(agent, /Never carry an older city across a stop whose geometry is unavailable/);
assert.match(agent, /Sourced lead means a public source was found/);
assert.match(agent, /venue\.bookingSuitability === "contact-found" \? "Contact found" : "Sourced lead"/);
assert.match(agent, /Public source found; booking and availability are not confirmed/);
assert.match(css, /\.tour-lead-status/);
assert.match(agent, /currentCalendar\.replaceWith\(renderProposedCalendar\(data\)\)/);
assert.match(agent, /Club research and contacts/);
assert.match(agent, /researchMarkets\.append\(section\)/, "city-by-city research must stay behind one optional workspace instead of stretching the primary day sheet");
assert.doesNotMatch(agent, /routeResults\.append\(section\)/, "individual city drawers must not clutter the primary result stack");
assert.doesNotMatch(agent, /Choose the first date and the date the act must be home\./);
assert.match(map, /danzstak:booking-selection/);
assert.match(map, /window\.danzstakToggleBookingVenue/);

assert.match(worker, /danzstak-shell-v808/);
assert.match(worker, /"\/assets\/booking-workspace\.css"/);

console.log("Booking workspace design checks passed: one compact planning card, truthful status timing, shared tool header, optional advanced controls, and PWA coverage.");
