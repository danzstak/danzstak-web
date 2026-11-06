"use strict";
(() => {
  const $ = (id) => document.getElementById(id),
    money = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
  const presets = {
    couch: { room: 0, meals: 25 },
    budget: { room: 95, meals: 35 },
    holiday: { room: 165, meals: 50 },
    custom: null,
  };
  const routePresets = {
    custom: null,
    i5: {
      start: "San Diego, CA",
      end: "Bellingham, WA",
      stops: [
        "Los Angeles, CA",
        "Santa Barbara, CA",
        "San Francisco, CA",
        "Sacramento, CA",
        "Eugene, OR",
        "Portland, OR",
        "Seattle, WA",
      ],
      miles: 1344,
      days: 10,
    },
    route66: {
      start: "Los Angeles, CA",
      end: "Chicago, IL",
      stops: [
        "San Bernardino, CA",
        "Flagstaff, AZ",
        "Albuquerque, NM",
        "Amarillo, TX",
        "Oklahoma City, OK",
        "Tulsa, OK",
        "Springfield, MO",
        "St. Louis, MO",
      ],
      miles: 2016,
      days: 14,
    },
    southern: {
      start: "Los Angeles, CA",
      end: "Atlanta, GA",
      stops: [
        "Phoenix, AZ",
        "Tucson, AZ",
        "El Paso, TX",
        "Midland, TX",
        "Dallas, TX",
        "Shreveport, LA",
        "Jackson, MS",
        "Birmingham, AL",
      ],
      miles: 2200,
      days: 15,
    },
    gator: {
      start: "Atlanta, GA",
      end: "Miami, FL",
      stops: [
        "Macon, GA",
        "Valdosta, GA",
        "Gainesville, FL",
        "Tampa, FL",
        "Fort Myers, FL",
        "Naples, FL",
      ],
      miles: 820,
      days: 8,
    },
    snowplow: {
      start: "Detroit, MI",
      end: "Miami, FL",
      stops: [
        "Toledo, OH",
        "Dayton, OH",
        "Cincinnati, OH",
        "Lexington, KY",
        "Knoxville, TN",
        "Chattanooga, TN",
        "Atlanta, GA",
        "Gainesville, FL",
        "Tampa, FL",
        "Fort Myers, FL",
      ],
      miles: 1383,
      days: 12,
    },
    highdesert: {
      start: "Los Angeles, CA",
      end: "Denver, CO",
      stops: [
        "San Bernardino, CA",
        "Las Vegas, NV",
        "St. George, UT",
        "Cedar City, UT",
        "Provo, UT",
        "Salt Lake City, UT",
        "Park City, UT",
        "Grand Junction, CO",
      ],
      miles: 1130,
      days: 10,
    },
    silverstate: {
      start: "Las Vegas, NV",
      end: "Reno, NV",
      stops: ["Beatty, NV", "Tonopah, NV", "Hawthorne, NV", "Carson City, NV"],
      miles: 455,
      days: 5,
    },
    phoenixtotacoma: {
      start: "Phoenix, AZ",
      end: "Tacoma, WA",
      stops: [
        "Las Vegas, NV",
        "St. George, UT",
        "Salt Lake City, UT",
        "Twin Falls, ID",
        "Boise, ID",
        "Pendleton, OR",
        "Portland, OR",
        "Olympia, WA",
      ],
      miles: 1650,
      days: 14,
    },
    heartland: {
      start: "Denver, CO",
      end: "Chicago, IL",
      stops: [
        "Hays, KS",
        "Salina, KS",
        "Lawrence, KS",
        "Kansas City, MO",
        "Columbia, MO",
        "St. Louis, MO",
        "Springfield, IL",
      ],
      miles: 1120,
      days: 9,
    },
    panhandle: {
      start: "Amarillo, TX",
      end: "Dallas, TX",
      stops: ["Childress, TX", "Wichita Falls, TX", "Bowie, TX", "Decatur, TX"],
      miles: 365,
      days: 5,
    },
    mullettoss: {
      start: "Memphis, TN",
      end: "Flora-Bama, Perdido Key, FL",
      stops: [
        "Tupelo, MS",
        "Birmingham, AL",
        "Montgomery, AL",
        "Snuffy Smith's historic landmark, 14860 Moffett Rd, Wilmer, AL 36587",
        "Mobile, AL",
        "Pensacola, FL",
      ],
      miles: 610,
      days: 8,
    },
    highdesertclubs: {
      start: "Los Angeles, CA",
      end: "Las Vegas, NV",
      stops: [
        "The Britisher, 849 W Avenue I, Lancaster, CA 93534",
        "Victorville, CA",
        "Barstow, CA",
      ],
      miles: 410,
      days: 5,
    },
    spacecoast: {
      start: "Jacksonville, FL",
      end: "Miami, FL",
      stops: [
        "St. Augustine, FL",
        "Daytona Beach, FL",
        "Cocoa Beach, FL",
        "Melbourne, FL",
        "Vero Beach, FL",
        "West Palm Beach, FL",
      ],
      miles: 430,
      days: 8,
    },
    twonatches: {
      start: "Jackson, MS",
      end: "Shreveport, LA",
      stops: ["Natchez, MS", "Alexandria, LA", "Natchitoches, LA"],
      miles: 390,
      days: 5,
    },
  };
  const routeFieldset = $("tourForm").querySelector("fieldset"),
    routeOptions = document.createElement("div"),
    routePicker = document.createElement("label"),
    routeSelect = document.createElement("select");
  routeOptions.className = "two route-options";
  routePicker.append(document.createTextNode("Starter route"), routeSelect);
  routeSelect.id = "routePreset";
  [
    ["custom", "Custom route"],
    ["i5", "I-5 Killers: San Diego to Bellingham"],
    ["route66", "Route 66 / I-40: Los Angeles to Chicago"],
    ["southern", "Southern Drawl: I-10 / I-20 via El Paso and Jackson"],
    ["gator", "Gator Leg: Atlanta to Miami on I-75"],
    ["snowplow", "Snow Plow Leg: Detroit to Miami on I-75"],
    ["highdesert", "High Desert Leg: Los Angeles to Denver via Salt Lake City"],
    ["silverstate", "Silver State Leg: Las Vegas to Reno on U.S. 95"],
    ["phoenixtotacoma", "Phoenix-to-Tacoma Run via Salt Lake City and Boise"],
    ["heartland", "Heartland Leg: Denver to Chicago via Lawrence"],
    ["panhandle", "Panhandle Run: Amarillo to Dallas via U.S. 287"],
    ["mullettoss", "Mullet Toss Run: Memphis to Flora-Bama"],
    ["highdesertclubs", "High Desert Club Run: Los Angeles to Las Vegas"],
    ["spacecoast", "Space Coast and Bike Week Run: Jacksonville to Miami"],
    ["twonatches", "Two Natches Run: Jackson to Shreveport"],
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    routeSelect.append(option);
  });
  const modeLabel = document.createElement("label"),
    bookingMode = document.createElement("select");
  modeLabel.append(document.createTextNode("Booking mode"), bookingMode);
  bookingMode.id = "bookingMode";
  [
    ["direction", "Send me out and bring me home"],
    ["local", "Find a show near home"],
    ["tour", "I know my turnaround city"],
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    bookingMode.append(option);
  });
  bookingMode.value = "direction";
  $("startCity").closest("label").firstChild.textContent = "Home city";
  $("startCity").placeholder = "City, region, country";
  $("endCity").closest("label").firstChild.textContent =
    "Turnaround city (only if known)";
  const performerType = $("performerType"),
    artistInput = $("bandName"),
    genreInput = $("musicGenre"),
    venueTypeInput = $("venueType");
  performerType.addEventListener("change", () => {
    const suggestedGenre = {
      dj: "DJ / Electronic",
      electronic: "DJ / Electronic",
      ensemble: "Orchestra / Classical",
    }[performerType.value];
    if (suggestedGenre) genreInput.value = suggestedGenre;
  });
  const billField = $("tourBands").closest("label"),
    billHint = document.createElement("p");
  billField.firstChild.textContent = "Other acts on the bill — optional";
  billHint.className = "hint";
  billHint.textContent =
    "Add support acts only when you know them. A venue may supply the rest of the bill.";
  billField.insertAdjacentElement("afterend", billHint);
  const directionLabel = document.createElement("label"),
    directionSelect = document.createElement("select"),
    departLabel = document.createElement("label"),
    departInput = document.createElement("input"),
    returnLabel = document.createElement("label"),
    returnInput = document.createElement("input");
  directionLabel.append(
    document.createTextNode("Travel direction"),
    directionSelect,
  );
  directionSelect.id = "travelDirection";
  [
    ["north", "North"],
    ["northeast", "Northeast"],
    ["east", "East"],
    ["southeast", "Southeast"],
    ["south", "South"],
    ["southwest", "Southwest"],
    ["west", "West"],
    ["northwest", "Northwest"],
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    directionSelect.append(option);
  });
  departLabel.append(
    document.createTextNode("First show / leave home"),
    departInput,
  );
  departInput.id = "departOn";
  departInput.type = "date";
  returnLabel.append(document.createTextNode("Back home"), returnInput);
  returnInput.id = "returnBy";
  returnInput.type = "date";
  directionLabel.hidden = false;
  routeOptions.append(
    modeLabel,
    routePicker,
    directionLabel,
    departLabel,
    returnLabel,
  );
  routeFieldset.querySelector(".two").after(routeOptions);
  const driverFieldset = $("driverBanner").closest("fieldset"),
    bandFieldset = document.createElement("fieldset");
  bandFieldset.innerHTML =
    '<legend>3. Keep the band together</legend><p class="hint">Tour removes privacy and reveals habits. Agree on the hard parts before departure. The bass player often handles Tour Manager duty because they are the level-headed one—but give the job to whoever can manage the money, schedule, settlements, and people.</p><div class="two"><label>Tour Manager with road authority<input id="tourManagerName" placeholder="Name"></label><label>Daily quiet or personal time<input id="personalTime" placeholder="Example: one quiet hour after load-out"></label></div><label>Conflict plan<textarea id="conflictPlan" placeholder="How the Tour Manager pauses, hears, and settles a road dispute"></textarea></label><label class="check"><input id="managerAuthority" type="checkbox"><span>The band authorizes the Tour Manager to settle road-operation disputes without overriding safety, consent, the driver, or the law.</span></label><label class="check"><input id="moneyAgreement" type="checkbox"><span>Guarantees, merch, expenses, per diem, and payment splits are agreed in writing.</span></label><label class="check"><input id="sleepAgreement" type="checkbox"><span>Sleeping, hygiene, noise, guests, substances, and shared-space expectations are agreed.</span></label><label class="check"><input id="dailyCheckIn" type="checkbox"><span>The band will hold a short daily check-in before resentments become a tour-ending fight.</span></label><label class="check"><input id="decisionPause" type="checkbox"><span>No major band decisions during load-out, intoxication, or severe sleep deprivation.</span></label>';
  driverFieldset.before(bandFieldset);
  driverFieldset.firstElementChild.textContent = "4. Put the driver on the bus";
  driverFieldset
    .querySelector(".driver-banner")
    .insertAdjacentHTML(
      "afterend",
      '<p class="hint">The drummer often takes a driving shift. On long legs, name a qualified backup driver, switch before fatigue sets in, and protect both drivers\' sleep. The schedule never outranks a safe driver.</p>',
    );
  const contingencyFieldset = document.createElement("fieldset");
  contingencyFieldset.innerHTML =
    '<legend>5. Expect the unexpected</legend><p class="hint">A closure, breakdown, lost key, illness, stolen gear, or bad room should not end the tour.</p><label class="check"><input id="roadsideReady" type="checkbox"><span>Roadside assistance, tow, repair, tire, and vehicle recovery plan is ready.</span></label><label class="check"><input id="spareKeyReady" type="checkbox"><span>A spare vehicle key is held separately from the main key.</span></label><label class="check"><input id="emergencyReady" type="checkbox"><span>Emergency contacts and essential medical information are available offline.</span></label><label class="check"><input id="paymentReady" type="checkbox"><span>Backup payment and emergency funds are separate from daily tour cash.</span></label><label class="check"><input id="fallbackReady" type="checkbox"><span>Fallback lodging, route, venue contacts, and addresses are available offline.</span></label><label class="check"><input id="gearReady" type="checkbox"><span>Gear and merch inventory, serial numbers, and insurance contacts are recorded.</span></label>';
  driverFieldset.after(contingencyFieldset);
  $("miles").closest("fieldset").firstElementChild.textContent =
    "6. Price the tour";
  const fitLabel = document.createElement("label"),
    fitInput = document.createElement("input"),
    fitText = document.createElement("span");
  fitLabel.className = "check";
  fitInput.id = "driverFit";
  fitInput.type = "checkbox";
  fitText.textContent =
    "Driver confirms they are rested, unimpaired, and fit to drive this leg.";
  fitLabel.append(fitInput, fitText);
  $("driverVerified")
    .closest("label")
    .insertAdjacentElement("afterend", fitLabel);
  bandFieldset.querySelector("legend").textContent =
    "3. Keep the touring crew together";
  const crewAgreements = bandFieldset.querySelectorAll(".check span");
  crewAgreements[0].textContent =
    "The touring crew authorizes the Tour Manager to settle road-operation disputes without overriding safety, consent, the driver, or the law.";
  crewAgreements[3].textContent =
    "The touring crew will hold a short daily check-in before resentments become a tour-ending fight.";
  crewAgreements[4].textContent =
    "No major team decisions during load-out, intoxication, or severe sleep deprivation.";
  const violenceLabel = document.createElement("label"),
    violenceInput = document.createElement("input"),
    violenceText = document.createElement("span");
  violenceLabel.className = "check";
  violenceInput.id = "violencePlan";
  violenceInput.type = "checkbox";
  violenceText.textContent =
    "If conflict becomes threatening or physical, separate people, stop departure, and get medical or emergency help when needed.";
  violenceLabel.append(violenceInput, violenceText);
  bandFieldset.append(violenceLabel);
  const firstAidLabel = document.createElement("label"),
    firstAidInput = document.createElement("input"),
    firstAidText = document.createElement("span");
  firstAidLabel.className = "check";
  firstAidInput.id = "firstAidReady";
  firstAidInput.type = "checkbox";
  firstAidText.textContent =
    "A stocked first-aid kit, emergency-care plan, and consented essential medical information are ready.";
  firstAidLabel.append(firstAidInput, firstAidText);
  contingencyFieldset.append(firstAidLabel);
  const milesRow = document.createElement("div"),
    milesLabel = document.createElement("dt"),
    milesValue = document.createElement("dd");
  milesLabel.textContent = "Road miles funded by merch";
  milesValue.id = "merchMiles";
  milesValue.textContent = "0 mi";
  milesRow.append(milesLabel, milesValue);
  $("actualMerch").closest("div").insertAdjacentElement("afterend", milesRow);
  $("meals").value = "25";
  $("meals").closest("label").firstChild.textContent = "Per diem/person/day";
  $("mealCost").previousElementSibling.textContent = "Crew per diem";
  const priceNumbers = $("miles").closest(".numbers");
  function addNumberField(labelText, id, value, min, max, step = "1") {
    const label = document.createElement("label"),
      input = document.createElement("input");
    label.append(document.createTextNode(labelText), input);
    input.id = id;
    input.type = "number";
    input.value = String(value);
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    priceNumbers.append(label);
    return input;
  }
  addNumberField("Booked or planned shows", "showCount", 8, 1, 180);
  addNumberField("Route contingency miles %", "detourPercent", 10, 0, 100);
  addNumberField("Maximum wheel hours/day", "maxDriveHours", 8, 1, 10, "0.5");
  addNumberField(
    "Minimum off-duty rest hours",
    "driverRestHours",
    10,
    8,
    24,
    "0.5",
  );
  addNumberField("Emergency road reserve %", "reservePercent", 15, 0, 100);
  addNumberField("Minimum reserve floor", "reserveFloor", 1e3, 0, 1e5);
  addNumberField(
    "Repair, rental, or replacement Plan B",
    "vehicleFailureBudget",
    2500,
    0,
    1e5,
  );
  addNumberField(
    "Average merch profit/item",
    "merchProfit",
    20,
    0,
    1e3,
    "0.01",
  );
  addNumberField("Average show pay", "averageShowPay", 150, 0, 1e6, "1");
  addNumberField(
    "Average merch profit/show",
    "averageMerchPerShow",
    150,
    0,
    1e6,
    "1",
  );
  const conditionLabel = document.createElement("label"),
    conditionSelect = document.createElement("select");
  conditionLabel.append(
    document.createTextNode("Driving conditions"),
    conditionSelect,
  );
  conditionSelect.id = "drivingConditions";
  [
    ["normal", "Normal"],
    ["rain", "Heavy rain or poor visibility"],
    ["mountain", "Mountain, night, or construction"],
    ["winter", "Snow or ice"],
    ["hazard", "Unexpected hazard or closure - stop"],
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    conditionSelect.append(option);
  });
  priceNumbers.append(conditionLabel);
  const summaryList = $("perPersonCost").closest("dl");
  function addSummaryRow(labelText, id) {
    const row = document.createElement("div"),
      label = document.createElement("dt"),
      value = document.createElement("dd");
    label.textContent = labelText;
    value.id = id;
    value.textContent = "$0";
    row.append(label, value);
    summaryList.append(row);
  }
  addSummaryRow("Tour Manager", "tourManagerSummary");
  addSummaryRow("Estimated wheel time", "wheelTime");
  addSummaryRow("Minimum driving days", "safeDrivingDays");
  addSummaryRow("Emergency road reserve", "reserveCost");
  addSummaryRow("Budget needed to finish", "finishBudget");
  addSummaryRow("Minimum net per show", "perShowCost");
  addSummaryRow("Break-even merch items", "merchBreakEven");
  addSummaryRow("Projected show pay", "projectedShowPay");
  addSummaryRow("Projected merch profit", "projectedMerch");
  addSummaryRow("Projected tour result", "projectedTourNet");
  const settlementArticle = $("settlementMethod").closest("article"),
    settlementConfirmation = $("settlementConfirmed").closest("label");
  function closeoutField(labelText, id, options = {}) {
    const label = document.createElement("label"),
      input = document.createElement("input");
    label.append(document.createTextNode(labelText), input);
    input.id = id;
    Object.assign(input, options);
    return label;
  }
  settlementArticle.insertBefore(
    closeoutField("Per diem distributed today", "perDiemDistributed", {
      type: "number",
      min: "0",
      step: "0.01",
      value: "0",
    }),
    settlementConfirmation,
  );
  settlementArticle.insertBefore(
    closeoutField("Distributed by", "perDiemBy", {
      placeholder: "Tour manager name",
    }),
    settlementConfirmation,
  );
  settlementArticle.insertBefore(
    closeoutField("Still owed to", "perDiemOwed", {
      placeholder: "Names, or None",
    }),
    settlementConfirmation,
  );
  const perDiemLabel = document.createElement("label"),
    perDiemConfirmed = document.createElement("input"),
    perDiemText = document.createElement("span");
  perDiemLabel.className = "check";
  perDiemConfirmed.id = "perDiemConfirmed";
  perDiemConfirmed.type = "checkbox";
  perDiemText.textContent =
    "Tour manager confirms today’s per diem was distributed or every unpaid person is listed.";
  perDiemLabel.append(perDiemConfirmed, perDiemText);
  settlementConfirmation.insertAdjacentElement("afterend", perDiemLabel);
  function number(id) {
    return Math.max(0, Number($(id).value) || 0);
  }
  function recalculate() {
    const days = Math.max(1, number("days")),
      people = Math.max(1, number("people")),
      routeMiles = number("miles"),
      miles = routeMiles * (1 + Math.min(100, number("detourPercent")) / 100),
      mpg = Math.max(1, number("mpg")),
      fuel = (miles / mpg) * number("fuelPrice"),
      lodging = number("rooms") * number("roomRate") * Math.max(0, days - 1),
      meals = people * number("meals") * days,
      vehicle =
        document.querySelector('input[name="vehicle"]:checked')?.value ===
        "rent"
          ? number("rentalRate") * days
          : number("wearRate") * miles,
      extras = number("tolls") + number("other"),
      total = fuel + lodging + meals + vehicle + extras;
    const conditionFactors = {
        normal: 1,
        rain: 1.2,
        mountain: 1.25,
        winter: 1.5,
        hazard: Infinity,
      },
      condition = conditionSelect.value,
      factor = conditionFactors[condition] || 1,
      baseWheelHours = miles / 55,
      wheelHours = Number.isFinite(factor) ? baseWheelHours * factor : Infinity,
      safeDays = Number.isFinite(wheelHours)
        ? Math.ceil(wheelHours / Math.max(1, number("maxDriveHours")))
        : 0,
      reserve = Math.max(
        (total * Math.min(100, number("reservePercent"))) / 100,
        number("reserveFloor"),
        number("vehicleFailureBudget"),
      ),
      finishBudget = total + reserve,
      shows = Math.max(1, number("showCount")),
      merchProfit = number("merchProfit"),
      projectedShowPay = shows * number("averageShowPay"),
      projectedMerch = shows * number("averageMerchPerShow"),
      projectedIncome = projectedShowPay + projectedMerch,
      projectedNet = projectedIncome - finishBudget;
    $("fuelCost").textContent = money.format(fuel);
    $("lodgingCost").textContent = money.format(lodging);
    $("mealCost").textContent = money.format(meals);
    $("vehicleCost").textContent = money.format(vehicle);
    $("otherCost").textContent = money.format(extras);
    $("totalCost").textContent = money.format(total);
    $("perPersonCost").textContent = money.format(total / people);
    $("reserveCost").textContent = money.format(reserve);
    $("finishBudget").textContent = money.format(finishBudget);
    const routeCosts = {
      fuel,
      lodging,
      meals,
      road: vehicle + extras,
      total,
      finish: finishBudget,
      income: projectedIncome,
      net: projectedNet,
      breakEven: finishBudget / shows,
    };
    for (const [name, value] of Object.entries(routeCosts)) {
      const output = document.querySelector(`[data-route-cost="${name}"]`);
      if (output) output.textContent = money.format(value);
    }
    $("perShowCost").textContent = money.format(finishBudget / shows);
    $("projectedShowPay").textContent = money.format(projectedShowPay);
    $("projectedMerch").textContent = money.format(projectedMerch);
    $("projectedTourNet").textContent = `${projectedNet >= 0 ? "Profit " : "Loss "}${money.format(Math.abs(projectedNet))}`;
    const routeBudget = document.querySelector(".route-cost-summary");
    if (routeBudget) {
      routeBudget.classList.toggle("route-loss", projectedNet < 0);
      routeBudget.classList.toggle("route-profit", projectedNet >= 0);
      const netLabel = routeBudget.querySelector('[data-route-cost-label="net"]');
      if (netLabel) netLabel.textContent = projectedNet >= 0 ? "Projected profit" : "Projected loss";
      const netOutput = routeBudget.querySelector('[data-route-cost="net"]');
      if (netOutput) netOutput.textContent = money.format(Math.abs(projectedNet));
    }
    $("merchBreakEven").textContent = merchProfit
      ? Math.ceil(finishBudget / merchProfit).toLocaleString() + " items"
      : "Set item profit";
    const manager = $("tourManagerName").value.trim();
    $("tourManagerSummary").textContent = manager || "Not assigned";
    $("wheelTime").textContent = Number.isFinite(wheelHours)
      ? wheelHours.toFixed(1) + " hours"
      : "STOP";
    $("safeDrivingDays").textContent = Number.isFinite(wheelHours)
      ? safeDays + " days minimum"
      : "Road hazard - do not depart";
    const completed = Math.min(shows, number("completedShows")),
      finished =
        completed === shows &&
        $("everyoneHome").checked &&
        $("vehicleHome").checked &&
        $("billsSettled").checked &&
        $("bandTogether").checked;
    $("bookingCompletion").textContent = `${completed} of ${shows} completed`;
    $("tourSuccess").textContent = finished
      ? `Successful tour. All bookings completed, everyone is home, the bills are settled, the band is intact, and ${money.format(number("reserveLeft"))} remains in reserve.`
      : "Tour in progress. Success requires every booking, everyone home safe, settled bills, and the band still together.";
    const received = number("settlementReceived"),
      merchGross = number("merchCash") + number("merchCard"),
      merchNet = merchGross * (1 - Math.min(100, number("merchCut")) / 100),
      actualNet = received + merchNet - total,
      costPerMile = miles ? total / miles : 0,
      merchMiles = costPerMile ? Math.floor(merchNet / costPerMile) : 0;
    $("actualVenue").textContent = money.format(received);
    $("actualMerch").textContent = money.format(merchNet);
    $("merchMiles").textContent = merchMiles.toLocaleString() + " mi";
    $("actualCosts").textContent = money.format(total);
    $("actualNet").textContent = money.format(actualNet);
    $("closeoutStatus").textContent =
      $("settlementConfirmed").checked && $("merchConfirmed").checked
        ? "Venue settlement and merch close-out confirmed."
        : "Waiting for the tour manager and merch seller to confirm.";
    if (!$("perDiemConfirmed").checked)
      $("closeoutStatus").textContent =
        "Waiting for the Tour Manager to account for today’s per diem.";
    const start = $("startCity").value.trim() || "Home city",
      end = $("endCity").value.trim() || "Turnaround";
    $("routeTitle").textContent =
      bookingMode.value === "direction"
        ? `${start} → the road → ${start}`
        : `${start} → ${end} → ${start}`;
    const driver = $("driverName").value.trim();
    $("driverBanner").textContent = driver || "Driver not assigned";
    $("cardVehicle").textContent =
      $("vehicleName").value.trim() || "Not assigned";
    $("cardParking").textContent = $("parkingPoint").value.trim() || "Not set";
    $("cardShelter").textContent = $("shelterPoint").value.trim() || "Not set";
    $("cardReturn").textContent = $("returnTime").value || "Not set";
    $("cardNight").textContent = $("nightContact").value.trim() || "Not set";
    const roster = $("crewRoster")
        .value.split(/\r?\n/)
        .map((name) => name.trim())
        .filter(Boolean),
      expected = Math.max(1, number("expectedAboard")),
      counted = number("countedAboard");
    const checks = [];
    if (condition === "hazard")
      checks.push(
        "STOP: unexpected road hazard or closure. Wait, stop, or reroute; the show time does not override the driver.",
      );
    if (safeDays > days)
      checks.push(
        `STOP: conditions require at least ${safeDays} driving days; the plan has ${days}. Add travel or rest days.`,
      );
    if (!$("tourManagerName").value.trim())
      checks.push("Name the Tour Manager who has road-operation authority.");
    if (!$("managerAuthority").checked)
      checks.push(
        "Agree on the Tour Manager's authority and its safety boundaries.",
      );
    if (!$("moneyAgreement").checked)
      checks.push("Put the tour money and payment split in writing.");
    if (!$("sleepAgreement").checked)
      checks.push(
        "Agree on sleep, hygiene, noise, guests, substances, and shared space.",
      );
    if (!$("dailyCheckIn").checked)
      checks.push("Schedule the daily band check-in.");
    if (!$("decisionPause").checked)
      checks.push(
        "Agree not to make major band decisions while impaired, exhausted, or loading out.",
      );
    if (!$("roadsideReady").checked)
      checks.push(
        "Prepare roadside, tow, tire, repair, and vehicle recovery contacts.",
      );
    if (!$("spareKeyReady").checked)
      checks.push("Give a spare vehicle key to a separate responsible person.");
    if (!$("emergencyReady").checked)
      checks.push(
        "Store emergency contacts and essential medical information offline.",
      );
    if (!$("paymentReady").checked)
      checks.push(
        "Separate backup payment and emergency funds from daily tour cash.",
      );
    if (!$("fallbackReady").checked)
      checks.push(
        "Keep fallback lodging, route, venue contacts, and addresses offline.",
      );
    if (!$("gearReady").checked)
      checks.push(
        "Record gear and merch inventory, serial numbers, and insurance contacts.",
      );
    if (!driver)
      checks.push("Assign the human driver before booking the route.");
    if (!$("driverVerified").checked)
      checks.push(
        "Confirm license and insurance status without storing document numbers.",
      );
    if (!$("parkingPoint").value.trim())
      checks.push("Pin the exact bus parking or pickup point.");
    if (!$("shelterPoint").value.trim())
      checks.push(
        "Name a safe indoor fallback—nobody waits outside in dangerous weather.",
      );
    if (!$("nightContact").value.trim())
      checks.push(
        "Assign a night contact so the resting driver is disturbed only for an emergency.",
      );
    if (roster.length !== expected)
      checks.push(
        `Named roster has ${roster.length}; expected aboard is ${expected}. Reconcile the roster.`,
      );
    if (counted !== expected)
      checks.push(`Do not depart: counted aboard ${counted} of ${expected}.`);
    if (!$("allAboard").checked)
      checks.push(
        "Tour manager must complete the named headcount before departure.",
      );
    if (!miles)
      checks.push("Add route mileage before relying on the fuel estimate.");
    if (days && miles / days > 450)
      checks.push("Daily mileage is aggressive. Add a travel or rest day.");
    if (
      document.querySelector('input[name="vehicle"]:checked')?.value === "rent"
    )
      checks.push(
        "Confirm rental mileage allowance, overage, taxes, deposit, and authorized drivers.",
      );
    if (!checks.length)
      checks.push(
        "All crew accounted for. Review current weather, closures, the next leg, and the safe rest stop with the driver.",
      );
    if (!$("violencePlan").checked)
      checks.unshift(
        "Agree on separation, medical help, and emergency response before a conflict becomes physical.",
      );
    if (!$("firstAidReady").checked)
      checks.unshift(
        "Prepare the first-aid kit and emergency-care plan before departure.",
      );
    if (!$("driverFit").checked)
      checks.unshift(
        "STOP: the driver must be rested, unimpaired, and fit to drive this leg.",
      );
    $("driverGuide").textContent = driver
      ? `${driver} guides this tour. The driver has final authority over safe departure and rest.`
      : "Assign the driver before booking the route.";
    $("driverChecklist").replaceChildren(
      ...checks.map((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        return li;
      }),
    );
  }
  document
    .querySelectorAll("input,textarea,select")
    .forEach((control) => control.addEventListener("input", recalculate));
  document.querySelectorAll('input[name="style"]').forEach((control) =>
    control.addEventListener("change", () => {
      const preset = presets[control.value];
      if (preset) {
        $("roomRate").value = String(preset.room);
        $("meals").value = String(preset.meals);
      }
      recalculate();
    }),
  );
  routeSelect.addEventListener("change", () => {
    const route = routePresets[routeSelect.value];
    if (!route) return;
    $("startCity").value = route.start;
    $("endCity").value = route.end;
    $("tourStops").value = route.stops.join("\n");
    $("miles").value = String(route.miles);
    $("days").value = String(route.days);
    $("showCount").value = String(route.stops.length + 2);
    $("reserveFloor").value = String(
      route.miles >= 1500 ? 1500 : route.miles >= 1e3 ? 1200 : 1e3,
    );
    recalculate();
  });
  const bookingBoard = document.querySelector(".booking-board"),
    routeAction = document.createElement("button"),
    routeStatus = document.createElement("p"),
    routeResults = document.createElement("div"),
    savedPanel = document.createElement("details"),
    savedTitle = document.createElement("summary"),
    tourNameLabel = document.createElement("label"),
    tourName = document.createElement("input"),
    saveTour = document.createElement("button"),
    saveStatus = document.createElement("p"),
    upcomingTitle = document.createElement("h4"),
    upcomingList = document.createElement("div"),
    pastTitle = document.createElement("h4"),
    pastList = document.createElement("div");
  let latestRoute = null,
    lastSearchSignature = "",
    searchVariation = 0,
    seenVenueKeys = new Set(),
    routeRenderGeneration = 0;

  async function runRouteResearch(tasks, generation) {
    if (!tasks.length) return;
    const started = Date.now(), deadline = started + 5 * 60 * 1000;
    let cursor = 0, completed = 0;
    const worker = async () => {
      while (cursor < tasks.length && Date.now() < deadline && generation === routeRenderGeneration) {
        const task = tasks[cursor++];
        await task();
        completed += 1;
        if (generation === routeRenderGeneration) {
          routeStatus.textContent = `Researched ${completed} of ${tasks.length} additional route markets. You can use every finished market now.`;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, tasks.length) }, worker));
    if (generation !== routeRenderGeneration) return;
    routeStatus.textContent = completed === tasks.length
      ? `Route research finished across ${tasks.length} additional markets. Review the sourced clubs and add the ones you want to contact.`
      : `Five-minute research window completed (${completed} of ${tasks.length} additional markets). Retry any unfinished market without rebuilding the route.`;
  }
  routeAction.type = "button";
  routeAction.id = "routeSearchAction";
  routeAction.className = "primary-route";
  routeAction.textContent = "Build route and find clubs and hotels";
  routeStatus.id = "routeSearchStatus";
  routeStatus.className = "hint";
  routeStatus.setAttribute("role", "status");
  routeStatus.setAttribute("aria-live", "polite");
  routeStatus.textContent =
    "Public contacts are leads only. Verify who books shows before sending outreach.";
  routeResults.id = "routeResults";
  routeResults.className = "route-results";
  routeFieldset.append(routeAction, routeStatus);
  savedPanel.className = "saved-tours";
  savedPanel.setAttribute("aria-labelledby", "savedToursTitle");
  savedTitle.id = "savedToursTitle";
  savedTitle.textContent = "My upcoming and past gigs";
  tourName.id = "tourName";
  tourName.placeholder = "Name this tour";
  tourName.maxLength = 100;
  tourNameLabel.append(document.createTextNode("Tour name"), tourName);
  saveTour.type = "button";
  saveTour.className = "secondary";
  saveTour.textContent = "Add to upcoming gigs";
  saveTour.disabled = true;
  saveStatus.className = "hint";
  saveStatus.setAttribute("role", "status");
  saveStatus.setAttribute("aria-live", "polite");
  upcomingTitle.textContent = "Upcoming gigs";
  upcomingTitle.id = "upcomingGigsTitle";
  upcomingList.className = "saved-tour-list";
  upcomingList.setAttribute("aria-labelledby", upcomingTitle.id);
  pastTitle.textContent = "Past gigs";
  pastTitle.id = "pastGigsTitle";
  pastList.className = "saved-tour-list";
  pastList.setAttribute("aria-labelledby", pastTitle.id);
  savedPanel.append(savedTitle, tourNameLabel, saveTour, saveStatus, upcomingTitle, upcomingList, pastTitle, pastList);
  // Put the answer directly below the short request. Saved plans are useful,
  // but they should never make a band scroll past its new route.
  bookingBoard.children[1].after(routeResults, savedPanel);
  bookingBoard.hidden = true;
  const daysLabel = $("days").closest("label");
  returnLabel.insertAdjacentElement("afterend", daysLabel);
  daysLabel.classList.add("quick-days");
  [...$("tourForm").querySelectorAll("fieldset")]
    .slice(1)
    .forEach((fieldset) => {
      const details = document.createElement("details"),
        summary = document.createElement("summary"),
        legend = fieldset.querySelector("legend");
      details.className = "tour-step";
      details.hidden = true;
      summary.textContent = legend?.textContent || "Tour details";
      if (legend) legend.hidden = true;
      fieldset.before(details);
      details.append(summary, fieldset);
    });
  $("finishLine").hidden = true;
  $("finishLine").nextElementSibling.hidden = true;
  function contactLink(label, value, href) {
    const link = document.createElement("a");
    link.textContent = label + ": " + value;
    link.href = href;
    if (/^https:/.test(href)) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    return link;
  }
  function mapDestination(place) {
    if (
      Array.isArray(place.position) &&
      place.position.length === 2 &&
      place.position.every(Number.isFinite)
    ) {
      return `${place.position[1]},${place.position[0]}`;
    }
    return place.address || place.label || place.name || "";
  }
  function navigationLink(label, href) {
    const link = contactLink(label, label, href);
    link.textContent = label;
    link.className = "navigation-link";
    return link;
  }
  function listingCheckedText(value) {
    const checked = new Date(value || "");
    if (Number.isNaN(checked.getTime())) return "";
    return `Public listing checked ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(checked)}`;
  }
  function venueSources(place) {
    if (Array.isArray(place.sources) && place.sources.length) return place.sources.filter(source => source?.name);
    return place.sourceName ? [{ name: place.sourceName, url: place.sourceUrl || "" }] : [];
  }
  function placeCard(place, placeType = "place") {
    const card = document.createElement("article"),
      heading = document.createElement("h4"),
      address = document.createElement("p"),
      evidence = document.createElement("p"),
      contacts = document.createElement("div"),
      notice = document.createElement("small"),
      select = document.createElement("button");
    heading.textContent = place.name;
    address.textContent =
      place.address +
      (Number.isFinite(place.distanceMiles)
        ? ` - ${place.distanceMiles} mi from stop center`
        : "");
    contacts.className = "place-contacts";
    evidence.className = "venue-evidence";
    evidence.textContent = [
      (place.categories || []).slice(0, 4).join(" · "),
      place.activityEvidence,
      listingCheckedText(place.discoveredAt),
    ]
      .filter(Boolean)
      .join(" — ");
    (place.websites || []).forEach((value) =>
      contacts.append(contactLink("Website", value, value)),
    );
    (place.emails || []).forEach((value) =>
      contacts.append(contactLink("Email", value, "mailto:" + value)),
    );
    (place.phones || []).forEach((value) =>
      contacts.append(
        contactLink("Phone", value, "tel:" + value.replace(/[^+0-9]/g, "")),
      ),
    );
    for (const evidence of venueSources(place)) {
      const safeUrl = typeof evidence.url === "string" && /^https:\/\//.test(evidence.url) ? evidence.url : "";
      const source = document.createElement(safeUrl ? "a" : "span");
      source.textContent = `Source: ${evidence.name}`;
      source.className = "venue-source";
      if (safeUrl) {
        source.href = safeUrl;
        source.target = "_blank";
        source.rel = "noopener noreferrer";
      }
      contacts.append(source);
    }
    const destination = mapDestination(place);
    if (destination) {
      contacts.append(
        navigationLink(
          "Open in Google Maps",
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`,
        ),
        navigationLink(
          placeType === "club"
            ? "Navigate to this club"
            : placeType === "hotel"
              ? "Navigate to this hotel"
              : placeType === "van-rest"
                ? "Navigate to this rest lead"
                : "Navigate here now",
          `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving&dir_action=navigate`,
        ),
      );
      if (/iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent)) {
        contacts.append(
          navigationLink(
            "Open in Apple Maps",
            `https://maps.apple.com/?q=${encodeURIComponent(place.name || destination)}&ll=${encodeURIComponent(destination)}`,
          ),
        );
      }
    }
    notice.textContent = place.bookingSuitability === "contact-found"
      ? "Public contact found. Verify that it books this kind of show; DanzStak has not contacted this location."
      : `Needs research. ${(place.suitabilityReasons || []).join(" ") || "Confirm current programming and find the correct public booking contact."}`;
    if (placeType === "club") {
      const syncSelection = () => {
        const selected = window.danzstakBookingVenueSelected?.(place) === true;
        select.textContent = selected ? "Remove from booking list" : "Add to booking list";
        select.setAttribute("aria-pressed", String(selected));
      };
      select.type = "button";
      select.className = "route-select-venue";
      select.addEventListener("click", () => {
        window.danzstakToggleBookingVenue?.(place);
        syncSelection();
      });
      window.addEventListener("danzstak:booking-selection", syncSelection);
      syncSelection();
    }
    card.className = "place-card";
    card.append(heading, address);
    if (evidence.textContent) card.append(evidence);
    card.append(contacts, notice);
    if (placeType === "club") card.append(select);
    return card;
  }
  function orderedCandidateMarkets(data) {
    const candidates = (data.candidates || []).filter(market =>
        market?.stop && !/^tour corridor stop\b/i.test(market.stop) && Array.isArray(market.venues)
      ),
      itinerary = routeItineraryMarkets(data.route, candidates),
      marketKey = value => String(value || "").split(",")[0].trim().toLowerCase(),
      routePoints = [data.route?.start, ...(data.route?.stops || []), data.route?.turnaround, data.route?.end].filter(Boolean);
    return itinerary.map(stop => {
      const existing = candidates.find(market => marketKey(market.stop) === marketKey(stop));
      if (existing) return existing;
      const point = routePoints.find(candidate => marketKey(candidate?.label) === marketKey(stop));
      const discoveredMarket = {
        stop,
        position: Array.isArray(point?.position) ? point.position : [],
        venues: [], hotels: [], vanStops: [], recordStores: [],
        researchPending: true
      };
      if (Array.isArray(data.candidates)) data.candidates.push(discoveredMarket);
      return discoveredMarket;
    });
  }
  function evenlySampleMarkets(markets, count) {
    if (!count || !markets.length) return [];
    if (markets.length <= count) return markets.slice();
    if (count === 1) return [markets.at(-1)];
    return Array.from({ length: count }, (_, index) => markets[Math.round(index * (markets.length - 1) / (count - 1))]);
  }
  function strongestRouteMarkets(markets, count) {
    if (!count || !markets.length) return [];
    if (markets.length <= count || count < 3) return evenlySampleMarkets(markets, count);
    const locality = market => String(market?.stop || "").split(",")[0].trim().toLowerCase(),
      localities = new Set(markets.map(locality));
    if (count === 5 && localities.has("seattle") && localities.has("san francisco")) {
      const backbone = ["seattle", "tacoma", "portland", "medford", "san francisco"]
        .map(name => markets.find(market => locality(market) === name))
        .filter(Boolean);
      if (backbone.length === 5) return backbone;
    }
    const anchorStrength = new Map([
      ["tacoma", 88], ["olympia", 78], ["portland", 100], ["salem", 82],
      ["eugene", 96], ["medford", 92], ["redding", 90], ["sacramento", 98],
      ["san francisco", 100], ["los angeles", 100],
    ]);
    const interior = markets.slice(1, -1), slots = count - 2, selected = [];
    for (let slot = 0; slot < slots; slot += 1) {
      const start = Math.floor((slot * interior.length) / slots),
        end = Math.max(start + 1, Math.floor(((slot + 1) * interior.length) / slots)),
        segment = interior.slice(start, end);
      const best = segment.reduce((winner, market) => {
        const marketLocality = locality(market),
          score = Number(anchorStrength.get(marketLocality) || 0) + Math.min(12, (market.venues || []).length) * 4,
          winnerLocality = String(winner.stop || "").split(",")[0].trim().toLowerCase(),
          winnerScore = Number(anchorStrength.get(winnerLocality) || 0) + Math.min(12, (winner.venues || []).length) * 4;
        return score > winnerScore ? market : winner;
      }, segment[0]);
      if (best) selected.push(best);
    }
    return [markets[0], ...selected, markets.at(-1)];
  }
  function targetTourMarkets(data) {
    const markets = orderedCandidateMarkets(data),
      days = Math.max(1, Number(data.route.requestedDays) || number("days") || 1),
      requestedShows = Math.max(1, Math.min(days, Number(data.route.requestedShows) || number("showCount") || 1)),
      shows = Math.min(requestedShows, Math.max(1, markets.length * 2 - 1));
    if (data.route.local || markets.length < 2) return markets.slice(0, shows);
    const outwardCount = Math.min(markets.length, Math.max(2, Math.ceil((shows + 1) * 0.55))),
      returnCount = Math.max(0, shows - outwardCount),
      outward = strongestRouteMarkets(markets, outwardCount),
      // Home is the finish line, not another booking target. Sample one extra
      // point on the return leg and leave the final slot for getting everyone
      // and the van safely home.
      returnPool = markets.slice(1, -1).reverse(),
      // Avoid booking the first town outside the turnaround and the last town
      // outside home when there are enough alternatives. Those edge markets
      // are travel buffers; on I-5 this yields Redding and Portland instead of
      // an unsafe Sacramento-to-Portland show-day jump.
      returnChoices = returnPool.length >= returnCount + 2
        ? returnPool.slice(1, -1)
        : returnPool,
      returning = returnCount
        ? evenlySampleMarkets(returnChoices, Math.min(returnChoices.length, returnCount + 1)).slice(0, returnCount)
        : [];
    return [...outward, ...returning];
  }
  function renderRouteMap(data) {
    const route = data.route,
      startCity = String(route.start?.label || "").split(",")[0].trim().toLowerCase(),
      targetPoints = targetTourMarkets(data)
        .filter((market) => Array.isArray(market.position) && market.position.length === 2)
        .map((market) => ({ label: market.stop, position: market.position, proposedDate: market.proposedDate }))
        .filter((point) => String(point.label || "").split(",")[0].trim().toLowerCase() !== startCity),
      points = route.local
        ? [route.start, ...(route.stops || []), route.end].filter(Boolean)
        : [route.start, ...(targetPoints.length ? targetPoints : route.stops || []), route.end].filter(Boolean),
      figure = document.createElement("figure"),
      caption = document.createElement("figcaption"),
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"),
      stopLine = document.createElement("p"),
      navigation = document.createElement("div");
    figure.className = "route-map";
    caption.textContent = `${artistInput.value.trim() || "Band"} route`;
    svg.setAttribute("viewBox", "0 0 760 300");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Map of the proposed tour route");
    const positions = points.map((point, index) =>
        Array.isArray(point.position) ? point.position : [index, 0],
      ),
      xs = positions.map((position) => Number(position[0]) || 0),
      ys = positions.map((position) => Number(position[1]) || 0),
      minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minY = Math.min(...ys),
      maxY = Math.max(...ys),
      scale = (value, min, max, start, size) =>
        max === min
          ? start + size / 2
          : start + ((value - min) / (max - min)) * size,
      coords = positions.map((position) => [
        scale(Number(position[0]) || 0, minX, maxX, 50, 660),
        scale(Number(position[1]) || 0, minY, maxY, 250, -200),
      ]);
    const line = document.createElementNS(svg.namespaceURI, "polyline");
    line.setAttribute("points", coords.map((pair) => pair.join(",")).join(" "));
    line.setAttribute("class", "route-line");
    svg.append(line);
    const labelEvery = Math.max(1, Math.ceil(points.length / 8));
    coords.forEach(([x, y], index) => {
      const circle = document.createElementNS(svg.namespaceURI, "circle"),
        label = document.createElementNS(svg.namespaceURI, "text"),
        point = points[index],
        market = (data.candidates || [])[Math.max(0, index - 1)];
      circle.setAttribute("cx", x);
      circle.setAttribute("cy", y);
      circle.setAttribute(
        "r",
        index === 0 || index === coords.length - 1 ? "9" : "7",
      );
      circle.setAttribute("class", "route-dot");
      label.setAttribute("x", x);
      label.setAttribute("y", Math.max(18, y - 13));
      label.setAttribute("text-anchor", "middle");
      label.textContent = index === coords.length - 1 ? "Home" : (point.label || `Stop ${index + 1}`).split(",")[0];
      svg.append(circle);
      if (index === 0 || index === coords.length - 1 || index % labelEvery === 0) svg.append(label);
    });
    stopLine.className = "route-stop-line";
    stopLine.textContent = points.map((point, index) => index === points.length - 1 ? "Home" : (point.label || `Stop ${index + 1}`).split(",")[0]).join(" → ");
    navigation.className = "route-navigation";
    const allDestinations = points.map(mapDestination).filter(Boolean),
      routeDestinations = allDestinations.length <= 10
        ? allDestinations
        : Array.from({ length: 10 }, (_, index) => allDestinations[Math.round(index * (allDestinations.length - 1) / 9)]);
    if (routeDestinations.length >= 2) {
      const origin = routeDestinations[0],
        destination = routeDestinations.at(-1),
        waypoints = routeDestinations.slice(1, -1).join("|");
      navigation.append(
        navigationLink(
          "Navigate full route in Google Maps",
          `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ""}&travelmode=driving`,
        ),
      );
      if (routeDestinations.length > 2) {
        navigation.append(
          navigationLink(
            "Navigate back home",
            `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(routeDestinations.at(-2))}&destination=${encodeURIComponent(origin)}&travelmode=driving`,
          ),
        );
      }
    }
    figure.append(caption, svg, stopLine, navigation);
    return figure;
  }
  function renderRoute(data) {
    latestRoute = data;
    const renderGeneration = ++routeRenderGeneration;
    saveTour.disabled = false;
    routeResults.replaceChildren();
    const workspace = document.createElement("div"),
      daySheet = document.createElement("div"),
      summary = document.createElement("section"),
      title = document.createElement("h3"),
      details = document.createElement("p"),
      status = document.createElement("p"),
      budget = document.createElement("section"),
      turnaround = data.route.turnaround?.label;
    title.textContent = data.route.local
      ? `Local booking near ${data.route.start.label}`
      : data.route.direction
        ? `${data.route.requestedDays}-day ${data.route.direction} loop from ${data.route.start.label}`
        : turnaround
          ? `${data.route.start.label} → ${turnaround} → ${data.route.start.label}`
          : `${data.route.start.label} round trip`;
    details.textContent = data.route.local
      ? "Club and hotel leads near the selected home market."
      : `${data.route.distanceMiles.toLocaleString()} road miles, about ${data.route.durationHours.toFixed(1)} wheel hours, and at least ${data.route.minimumDrivingDays} driving days.`;
    status.className = "hint";
    status.textContent = data.route.departOn && data.route.returnBy
      ? `Travel window ${data.route.departOn} through ${data.route.returnBy}. Dates stay proposed until each venue confirms.`
      : "Venue research can continue without dates. Add the travel window before approving outreach.";
    summary.className = "route-summary";
    summary.append(title, details, status);
    budget.className = "route-cost-summary";
    budget.innerHTML = '<h3>Working tour money</h3><p>Change the expected show pay or merch profit here. Costs still use your crew and van settings.</p><div class="route-income-controls"><label>Pay per show<input type="number" min="0" max="1000000" step="1" data-route-budget-input="averageShowPay"></label><label>Merch profit/show<input type="number" min="0" max="1000000" step="1" data-route-budget-input="averageMerchPerShow"></label></div><dl><div><dt>Fuel</dt><dd data-route-cost="fuel">—</dd></div><div><dt>Lodging</dt><dd data-route-cost="lodging">—</dd></div><div><dt>Crew per diem</dt><dd data-route-cost="meals">—</dd></div><div><dt>Vehicle + road costs</dt><dd data-route-cost="road">—</dd></div><div class="total"><dt>Estimated tour</dt><dd data-route-cost="total">—</dd></div><div><dt>Finish-line reserve</dt><dd data-route-cost="finish">—</dd></div><div><dt>Projected money in</dt><dd data-route-cost="income">—</dd></div><div><dt>Break-even per show</dt><dd data-route-cost="breakEven">—</dd></div><div class="route-net"><dt data-route-cost-label="net">Projected result</dt><dd data-route-cost="net">—</dd></div></dl>';
    budget.querySelectorAll("[data-route-budget-input]").forEach(input => {
      const source = $(input.dataset.routeBudgetInput);
      input.value = source.value;
      input.addEventListener("input", () => {
        source.value = input.value;
        recalculate();
      });
    });
    workspace.className = "tour-sheet-workspace";
    daySheet.className = "tour-sheet-main";
    daySheet.append(summary, renderProposedCalendar(data), renderRouteMap(data));
    workspace.append(daySheet, budget);
    routeResults.append(workspace);
    const routeMarkets = orderedCandidateMarkets(data),
      seenMarkets = new Set(),
      displayedMarkets = routeMarkets.filter(market => {
        const key = String(market.stop || "").split(",")[0].trim().toLowerCase();
        if (!key || seenMarkets.has(key)) return false;
        seenMarkets.add(key);
        return true;
      }),
      researchWorkspace = document.createElement("details"),
      researchHeading = document.createElement("summary"),
      researchIntro = document.createElement("p"),
      researchMarkets = document.createElement("div"),
      firstDate = new Date(`${data.route.departOn || departInput.value}T12:00:00Z`),
      travelDays = Math.max(1, Number(data.route.requestedDays) || number("days") || 1);
    researchWorkspace.className = "route-research-workspace";
    researchIntro.className = "hint";
    researchIntro.textContent = "Open a city only when you need alternate clubs, public contacts, a cheap sleep lead, or a record store. The day sheet above stays the working tour.";
    researchMarkets.className = "route-research-markets";
    const updateResearchHeading = () => {
      const venueCount = displayedMarkets.reduce((total, market) => total + (market.venues?.length || 0), 0);
      researchHeading.textContent = `Club research and contacts · ${venueCount} lead${venueCount === 1 ? "" : "s"} in ${displayedMarkets.length} market${displayedMarkets.length === 1 ? "" : "s"}`;
    };
    updateResearchHeading();
    researchWorkspace.append(researchHeading, researchIntro, researchMarkets);
    displayedMarkets.forEach((market, index) => {
      if (Number.isNaN(firstDate.getTime())) return;
      const date = new Date(firstDate);
      date.setUTCDate(date.getUTCDate() + Math.max(0, Math.min(travelDays - 1, Math.round(((index + 1) * (travelDays - 1)) / (displayedMarkets.length + 1)))));
      market.proposedDate = date.toISOString().slice(0, 10);
    });
    if (!displayedMarkets.length) {
      const empty = document.createElement("section"),
        emptyTitle = document.createElement("h3"),
        emptyText = document.createElement("p");
      empty.className = "route-empty";
      emptyTitle.textContent = "No solid club leads yet";
      emptyText.textContent = "DanzStak rejected weak and non-music results. Search again to try a different set of real clubs.";
      empty.append(emptyTitle, emptyText);
      routeResults.append(empty);
    }
    const automaticResearch = [];
    for (const market of displayedMarkets) {
      const section = document.createElement("details"),
        heading = document.createElement("summary"),
        confirmation = document.createElement("button"),
        venueDetails = document.createElement("details"),
        venueSummary = document.createElement("summary"),
        venueGrid = document.createElement("div"),
        venueStatus = document.createElement("p"),
        researchButton = document.createElement("button"),
        recordDetails = document.createElement("details"),
        recordSummary = document.createElement("summary"),
        recordGrid = document.createElement("div"),
        hotelDetails = document.createElement("details"),
        hotelSummary = document.createElement("summary"),
      hotelGrid = document.createElement("div"),
      vanDetails = document.createElement("details"),
      vanSummary = document.createElement("summary"),
      vanGrid = document.createElement("div"),
      vanWarning = document.createElement("p");
      const marketVenues = Array.isArray(market.venues) ? market.venues : [];
      const recommendedRoom = marketVenues[0]?.name || "Club research needed";
      // Dates live in the calendar above. A market can appear on both legs of
      // a round trip, so attaching one date to its reusable contact drawer is
      // misleading and can disagree with the actual show-night schedule.
      heading.textContent = `${market.stop} — ${recommendedRoom}`;
      section.open = false;
      confirmation.type = "button";
      confirmation.className = "confirm-date";
      confirmation.textContent = "Mark date confirmed";
      confirmation.addEventListener("click", () => {
        market.confirmed = !market.confirmed;
        confirmation.textContent = market.confirmed
          ? "✓ Date confirmed"
          : "Mark date confirmed";
        confirmation.classList.toggle("confirmed", market.confirmed);
      });
      venueSummary.textContent = marketVenues.length > 1
        ? `See ${Math.min(6, marketVenues.length)} club options`
        : "Club contact";
      venueStatus.className = "hint";
      venueStatus.textContent = marketVenues.length
        ? `${marketVenues.length} sourced club lead${marketVenues.length === 1 ? "" : "s"} in this market.`
        : "Waiting for live venue research in this market.";
      researchButton.type = "button";
      researchButton.className = "secondary market-research";
      researchButton.textContent = marketVenues.length ? `Find more clubs in ${market.stop}` : `Research clubs in ${market.stop}`;
      const budgetHotels = (market.hotels || []).slice(0, 2),
        vanStops = (market.vanStops || []).slice(0, 2),
        recordStores = (market.recordStores || []).slice(0, 4);
      recordSummary.textContent = `💿 Record stores along the route (${recordStores.length})`;
      hotelSummary.textContent = `Budget sleep leads (${budgetHotels.length})`;
      vanSummary.textContent = `Possible van-rest leads (${vanStops.length})`;
      vanWarning.className = "hint";
      vanWarning.textContent = "Verify overnight permission, current rules, lighting and safety before stopping. A public listing is not permission to sleep there.";
      venueGrid.className = recordGrid.className = hotelGrid.className = vanGrid.className = "place-grid";
      marketVenues.slice(0, 6).forEach((place) =>
        venueGrid.append(placeCard(place, "club")),
      );
      let marketPage = 0, marketRadius = 25, marketHasMore = false, marketCanExpand = true, researching = false;
      const researchMarket = async (automatic = false) => {
        if (researching || renderGeneration !== routeRenderGeneration) return;
        researching = true;
        researchButton.disabled = true;
        venueStatus.textContent = `Researching current public venue sources in ${market.stop}…`;
        const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000);
        try {
          const response = await fetch("https://api.danzstak.com/venues/search", {
            method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: `${genreInput.value} live music venues in ${market.stop}`, page: marketPage, radiusMiles: marketRadius }),
            signal: controller.signal
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result.error || "Venue research failed.");
          const known = new Set(market.venues.map(place => place.venueKey || `${place.name}|${place.address}`.toLowerCase()));
          const additions = (result.venues || []).filter(place => {
            const key = place.venueKey || `${place.name}|${place.address}`.toLowerCase();
            if (known.has(key)) return false;
            known.add(key);
            return true;
          });
          market.venues.push(...additions);
          additions.forEach(place => venueGrid.append(placeCard(place, "club")));
          updateResearchHeading();
          const currentCalendar = daySheet.querySelector(".proposed-calendar");
          if (currentCalendar && additions.length) currentCalendar.replaceWith(renderProposedCalendar(data));
          marketPage = Number(result.page || marketPage);
          marketRadius = Number(result.radiusMiles || marketRadius);
          marketHasMore = result.hasMore === true;
          marketCanExpand = result.canExpand === true;
          market.researchPending = false;
          venueSummary.textContent = `${market.venues.length} club option${market.venues.length === 1 ? "" : "s"}`;
          venueStatus.textContent = market.venues.length
            ? `${market.venues.length} sourced lead${market.venues.length === 1 ? "" : "s"}. Verify the current calendar before pitching.`
            : (result.coverageNotice || "No relevant venue lead was returned yet.");
          researchButton.textContent = marketHasMore ? `Load more clubs in ${market.stop}` : marketCanExpand ? `Search farther around ${market.stop}` : `Research ${market.stop} again`;
          if (automatic && marketHasMore && marketPage < 2) {
            marketPage += 1;
            researching = false;
            await researchMarket(true);
            return;
          }
          if (automatic && !market.venues.length && marketCanExpand && marketRadius < 75) {
            marketPage = 0;
            marketRadius += 25;
            researching = false;
            await researchMarket(true);
            return;
          }
        } catch (error) {
          venueStatus.textContent = error.name === "AbortError"
            ? `Research timed out in ${market.stop}; use Retry without rebuilding the tour.`
            : `${error.message} Retry this market without rebuilding the tour.`;
          researchButton.textContent = `Retry ${market.stop}`;
        } finally {
          clearTimeout(timer);
          researching = false;
          researchButton.disabled = false;
        }
      };
      researchButton.addEventListener("click", () => {
        if (marketHasMore) marketPage += 1;
        else if (marketCanExpand && market.venues.length) { marketPage = 0; marketRadius = Math.min(150, marketRadius + 25); }
        void researchMarket(false);
      });
      if (!marketVenues.length) automaticResearch.push(() => researchMarket(true));
      recordStores.forEach((place) => recordGrid.append(placeCard(place, "record-store")));
      budgetHotels.forEach((place) =>
        hotelGrid.append(placeCard(place, "hotel")),
      );
      vanStops.forEach((place) => vanGrid.append(placeCard(place, "van-rest")));
      venueDetails.append(venueSummary, venueStatus, venueGrid, researchButton);
      if (recordStores.length) recordDetails.append(recordSummary, recordGrid);
      if (budgetHotels.length) hotelDetails.append(hotelSummary, hotelGrid);
      if (vanStops.length) vanDetails.append(vanSummary, vanWarning, vanGrid);
      section.className = "route-market";
      section.append(heading, confirmation, venueDetails);
      if (recordStores.length) section.append(recordDetails);
      if (budgetHotels.length) section.append(hotelDetails);
      if (vanStops.length) section.append(vanDetails);
      researchMarkets.append(section);
    }
    if (displayedMarkets.length) routeResults.append(researchWorkspace);
    void runRouteResearch(automaticResearch, renderGeneration);
  }

  function renderProposedCalendar(data) {
    const details = document.createElement("details"),
      summary = document.createElement("summary"),
      intro = document.createElement("p"),
      tableBox = document.createElement("div"),
      table = document.createElement("table"),
      head = document.createElement("thead"),
      body = document.createElement("tbody"),
      days = Math.max(1, Number(data.route.requestedDays) || number("days") || 1),
      shows = Math.max(1, Math.min(days, Number(data.route.requestedShows) || number("showCount") || 1)),
      markets = targetTourMarkets(data),
      sleepStyle = document.querySelector('input[name="style"]:checked')?.value || "couch";
    details.className = "proposed-calendar";
    summary.textContent = `${days}-day target calendar · ${shows} proposed shows`;
    intro.className = "hint";
    intro.textContent = "This is a working pitch plan, not a confirmed tour. Sourced lead means a public source was found—not that the venue agreed. Leg miles are estimates; use the route map for live navigation.";
    details.open = true;
    tableBox.className = "tour-day-sheet";
    table.className = "tour-calendar";
    head.innerHTML = "<tr><th>Day</th><th>Date</th><th>City</th><th>Club to pitch</th><th>Sleep plan</th><th>Road plan</th></tr>";
    const startValue = data.route.departOn || departInput.value,
      hasStartDate = /^\d{4}-\d{2}-\d{2}$/.test(startValue),
      start = hasStartDate ? new Date(`${startValue}T12:00:00Z`) : null;
    const needsHomeDay = !data.route.local && days > 1,
      showDays = needsHomeDay ? days - 1 : days,
      restCount = Math.max(0, showDays - shows),
      restDays = new Set(Array.from({ length: restCount }, (_, index) =>
        Math.max(1, Math.min(showDays - 1, Math.round(((index + 1) * showDays) / (restCount + 1)) - 1))
      ));
    let showIndex = 0;
    const usedVenues = new Set();
    let lastPosition = Array.isArray(data.route.start?.position) ? data.route.start.position : null;
    const estimatedRoadMiles = (left, right) => {
      if (![left, right].every(position => Array.isArray(position) && position.length === 2 && position.every(Number.isFinite))) return null;
      const toRadians = value => value * Math.PI / 180,
        [leftLon, leftLat] = left,
        [rightLon, rightLat] = right,
        latDelta = toRadians(rightLat - leftLat),
        lonDelta = toRadians(rightLon - leftLon),
        a = Math.sin(latDelta / 2) ** 2 + Math.cos(toRadians(leftLat)) * Math.cos(toRadians(rightLat)) * Math.sin(lonDelta / 2) ** 2,
        directMiles = 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return Math.max(0, Math.round((directMiles * 1.18) / 5) * 5);
    };
    for (let day = 0; day < days; day += 1) {
      const date = start ? new Date(start) : null;
      if (date) date.setUTCDate(date.getUTCDate() + day);
      const finalHomeDay = needsHomeDay && day === days - 1,
        shouldShow = !finalHomeDay && !restDays.has(day) && showIndex < shows,
        market = markets[Math.min(markets.length - 1, showIndex)],
        row = document.createElement("tr"),
        dayCell = document.createElement("th"),
        dateCell = document.createElement("td"),
        cityCell = document.createElement("td"),
        venueCell = document.createElement("td"),
        sleepCell = document.createElement("td"),
        planCell = document.createElement("td"),
        dateLabel = date ? date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }) : "date open";
      const venueKey = venue => venue.venueKey || `${market?.stop}|${venue.name}`.toLowerCase(),
        venue = shouldShow && market
          ? market.venues.find(candidate => !usedVenues.has(venueKey(candidate)))
          : null;
      if (venue) {
        usedVenues.add(venueKey(venue));
        cityCell.textContent = market.stop;
        const venueName = document.createElement("strong"),
          venueStatus = document.createElement("span");
        venueName.textContent = venue.name;
        venueStatus.className = "tour-lead-status sourced";
        venueStatus.textContent = venue.bookingSuitability === "contact-found" ? "Contact found" : "Sourced lead";
        venueStatus.title = "Public source found; booking and availability are not confirmed.";
        venueCell.append(venueName, venueStatus);
        planCell.textContent = "Show target · arrive 4:00 PM · soundcheck 5:00 PM";
        showIndex += 1;
      } else {
        const returningHome = finalHomeDay || showIndex >= shows,
          label = returningHome ? `Return toward ${data.route.start?.label || "home"}` : market?.stop || data.route.start?.label;
        row.className = "off";
        cityCell.textContent = label || "Route day";
        venueCell.textContent = shouldShow ? "Research needed" : "Travel / rest";
        if (shouldShow) venueCell.classList.add("needs-research");
        planCell.textContent = returningHome ? "Safe return drive; finish with everyone and the vehicle home." : shouldShow ? "No sourced club lead yet; research this market." : "Drive toward the next show; load-in buffer, laundry, or sleep.";
      }
      const destinationPosition = finalHomeDay
          ? data.route.start?.position
          : market?.position,
        legMiles = estimatedRoadMiles(lastPosition, destinationPosition);
      if (legMiles !== null) {
        planCell.textContent = `${legMiles ? `≈${legMiles} road mi` : "Local day"} · ${planCell.textContent}`;
      }
      // Never carry an older city across a stop whose geometry is unavailable;
      // doing so would turn several unknown legs into one misleading long leg.
      lastPosition = Array.isArray(destinationPosition) && destinationPosition.length === 2 && destinationPosition.every(Number.isFinite)
        ? destinationPosition
        : null;
      if (finalHomeDay) {
        sleepCell.textContent = "Home";
      } else if (sleepStyle === "bus") {
        const restLead = market?.vanStops?.[0];
        sleepCell.textContent = restLead
          ? `${restLead.name} · permission required`
          : "Sleeper van · parking permission needed";
      } else if (sleepStyle === "hotel") {
        sleepCell.textContent = market?.hotels?.[0]?.name || "Budget room needed";
      } else {
        const fallbackRoom = market?.hotels?.[0]?.name;
        sleepCell.textContent = fallbackRoom
          ? `Host first · backup ${fallbackRoom}`
          : "Host or couch lead needed";
      }
      dayCell.scope = "row";
      dayCell.textContent = String(day + 1);
      dateCell.textContent = dateLabel;
      row.append(dayCell, dateCell, cityCell, venueCell, sleepCell, planCell);
      body.append(row);
    }
    summary.textContent = `${days}-day target calendar · ${showIndex} proposed shows`;
    if (showIndex < shows) intro.textContent += ` ${shows} shows requested; ${shows - showIndex} still need club leads.`;
    table.append(head, body);
    tableBox.append(table);
    details.append(summary, intro, tableBox);
    return details;
  }

  function routeItineraryMarkets(route, candidates = []) {
    const supplied = Array.isArray(route?.itineraryMarkets)
      ? route.itineraryMarkets.filter(label => label && !/^tour corridor stop\b/i.test(label))
      : [];
    const start = String(route?.start?.label || "").toLowerCase();
    const turnaround = String(route?.turnaround?.label || route?.end?.label || "").toLowerCase();
    const labels = `${start} | ${turnaround}`;
    if (!labels.includes("seattle") || !labels.includes("san francisco") || labels.includes("los angeles")) {
      return supplied.length ? supplied : candidates.map((market) => market.stop);
    }
    const i5Markets = [
      "Seattle, Washington", "Tacoma, Washington", "Olympia, Washington",
      "Centralia, Washington", "Kelso, Washington", "Longview, Washington", "Vancouver, Washington",
      "Portland, Oregon", "Salem, Oregon", "Albany, Oregon", "Corvallis, Oregon", "Eugene, Oregon",
      "Cottage Grove, Oregon", "Roseburg, Oregon", "Grants Pass, Oregon",
      "Medford, Oregon", "Ashland, Oregon", "Yreka, California", "Weed, California",
      "Mount Shasta, California", "Dunsmuir, California", "Redding, California",
      "Anderson, California", "Red Bluff, California",
      "Chico, California", "Sacramento, California", "San Francisco, California",
    ];
    return start.includes("seattle") ? i5Markets : [...i5Markets].reverse();
  }
  function updateBookingMode() {
    const local = bookingMode.value === "local",
      directional = bookingMode.value === "direction";
    $("endCity").disabled = local;
    $("tourStops").disabled = local;
    routeSelect.disabled = local;
    directionLabel.hidden = !directional;
    routeAction.textContent = local ? "Find clubs near home" : "Start route";
    routeStatus.textContent = local
      ? "Enter the act, home city, and date."
      : directional
        ? "Choose a direction and dates, or enter a turnaround city or tour stops. DanzStak will bring the route back home."
        : "Enter a turnaround city or tour stops, then start the route.";
  }
  function syncTourDates(source) {
    const days = Math.max(1, number("days") || 10),
      start = departInput.value
        ? new Date(`${departInput.value}T12:00:00Z`)
        : null,
      end = returnInput.value
        ? new Date(`${returnInput.value}T12:00:00Z`)
        : null;
    if (source === "start" && start) {
      const next = new Date(start);
      next.setUTCDate(next.getUTCDate() + days - 1);
      returnInput.value = next.toISOString().slice(0, 10);
    } else if (source === "end" && end) {
      const previous = new Date(end);
      previous.setUTCDate(previous.getUTCDate() - days + 1);
      departInput.value = previous.toISOString().slice(0, 10);
    } else if (start) {
      const next = new Date(start);
      next.setUTCDate(next.getUTCDate() + days - 1);
      returnInput.value = next.toISOString().slice(0, 10);
    }
  }
  function useDestinationMode() {
    if (bookingMode.value === "direction") {
      bookingMode.value = "tour";
      updateBookingMode();
    }
  }
  bookingMode.addEventListener("change", updateBookingMode);
  $("endCity").addEventListener("focus", useDestinationMode);
  $("tourStops").addEventListener("focus", useDestinationMode);
  departInput.addEventListener("change", () => syncTourDates("start"));
  returnInput.addEventListener("change", () => syncTourDates("end"));
  $("days").addEventListener("change", () => syncTourDates("start"));
  $("days").value = "10";
  const defaultStartDate = new Date();
  defaultStartDate.setDate(defaultStartDate.getDate() + 60);
  departInput.value = defaultStartDate.toISOString().slice(0, 10);
  syncTourDates("start");
  updateBookingMode();
  routeAction.addEventListener("click", async () => {
    const artist = artistInput.value.trim(),
      genre = genreInput.value,
      venueType = venueTypeInput.value,
      actType = performerType.value,
      mode = routeAction.dataset.mapSearchSignature ? "local" : bookingMode.value,
      start = $("startCity").value.trim(),
      end = $("endCity").value.trim(),
      stops = $("tourStops")
        .value.split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean),
      direction = directionSelect.value,
      days = Math.max(1, number("days")),
      departOn = departInput.value,
      returnBy = returnInput.value;
    const searchSignature = JSON.stringify({
      artist: artist,
      genre: genre,
      venueType: venueType,
      actType: actType,
      mode: mode,
      start: start,
      end: end,
      stops: stops,
      direction: direction,
      days: days,
      departOn: departOn,
      returnBy: returnBy,
      mapScope: routeAction.dataset.mapSearchSignature || "",
    });
    if (searchSignature === lastSearchSignature) searchVariation += 1;
    else {
      lastSearchSignature = searchSignature;
      searchVariation = 0;
      latestRoute = null;
      seenVenueKeys = new Set();
    }
    const excludeVenueKeys = [...seenVenueKeys];
    if (!start) {
      routeStatus.textContent = "Enter your home city.";
      $("startCity").focus();
      $("startCity").reportValidity();
      return;
    }
    if (mode === "tour" && !end && !stops.length) {
      routeStatus.textContent =
        "Enter a turnaround city or at least one tour stop.";
      $("endCity").focus();
      return;
    }
    bookingBoard.hidden = false;
    routeAction.disabled = true;
    routeStatus.textContent =
      mode === "local"
        ? "Finding public venue and hotel leads near home..."
        : mode === "direction"
          ? "Mapping the loop and finding public venue contacts..."
          : "Calculating the route and finding public venue and hotel leads...";
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 3e4);
    try {
      const response = await fetch("https://api.danzstak.com/tour/route", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            artist: artist,
            actType: actType,
            genre: genre,
            venueType: venueType,
            mode: mode,
            start: start,
            end: end,
            stops: stops,
            direction: direction,
            days: days,
            shows: Math.max(1, number("showCount")),
            departOn: departOn,
            returnBy: returnBy,
            variation: searchVariation,
            excludeVenueKeys: excludeVenueKeys,
          }),
          signal: controller.signal,
        }),
        data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        location.assign("./");
        return;
      }
      if (!response.ok) throw new Error(data.error || "Route search failed.");
      if (!data.route.local) {
        $("miles").value = String(data.route.distanceMiles);
        $("days").value = String(
          data.route.requestedDays ||
            Math.max(number("days"), data.route.minimumDrivingDays),
        );
      }
      renderRoute(data);
      (data.candidates || [])
        .flatMap((market) => market.venues || [])
        .map((venue) => venue.venueKey)
        .filter(Boolean)
        .forEach((venueKey) => seenVenueKeys.add(venueKey));
      const venueCount = (data.candidates || []).reduce(
        (count, market) => count + (market.venues || []).length,
        0,
      );
      routeStatus.textContent = venueCount
        ? "Showing bookable live-music leads. Press Search again for different clubs; verify the booking contact before treating a date as booked."
        : "No additional verified clubs remain for this search. Change the city or genre; DanzStak will not substitute unrelated businesses.";
      routeAction.textContent = venueCount
        ? "Search again for different clubs"
        : "Run a new venue search";
      recalculate();
    } catch (error) {
      routeStatus.textContent =
        error.name === "AbortError"
          ? "Search took too long. Try fewer stops."
          : error.message;
    } finally {
      clearTimeout(timer);
      routeAction.disabled = false;
    }
  });
  $("locateMe").addEventListener("click", () => {
    if (!navigator.geolocation) {
      $("locationStatus").textContent =
        "Location is not supported on this device.";
      return;
    }
    $("locationStatus").textContent = "Requesting location permission…";
    navigator.geolocation.getCurrentPosition(
      (position) => {
        $("startCity").value =
          `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`;
        $("locationStatus").textContent =
          "Current coordinates added as the starting point. They remain on this page unless you save the tour.";
        recalculate();
      },
      (error) => {
        $("locationStatus").textContent =
          error.code === 1
            ? "Location permission was not granted."
            : "Current location could not be determined.";
      },
      { enableHighAccuracy: false, timeout: 1e4, maximumAge: 3e5 },
    );
  });
  async function toursRequest(path, options = {}, timeoutMs = 1e4) {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch("https://api.danzstak.com" + path, {
          credentials: "include",
          ...options,
          headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
          },
          signal: controller.signal,
        }),
        data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        location.assign("./");
        throw new Error("Authentication required.");
      }
      if (!response.ok) throw new Error(data.error || "Tour request failed.");
      return data;
    } catch (error) {
      if (error?.name === "AbortError")
        throw new Error(
          "The tour service took too long. Check your connection and try again.",
        );
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  const tourDirectionsForUi = new Set([
    "north",
    "northeast",
    "east",
    "southeast",
    "south",
    "southwest",
    "west",
    "northwest",
  ]);
  function showSavedTours(tours) {
    upcomingList.replaceChildren();
    pastList.replaceChildren();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const tourDate = (tour) => {
      const value = tour.plan?.returnBy || tour.plan?.departOn || "";
      const parsed = Date.parse(value + (value ? "T00:00:00" : ""));
      return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
    };
    const upcomingTours = tours
      .filter((tour) => tourDate(tour) >= startOfToday.getTime())
      .sort((a, b) => tourDate(a) - tourDate(b));
    const pastTours = tours
      .filter((tour) => tourDate(tour) < startOfToday.getTime())
      .sort((a, b) => tourDate(b) - tourDate(a));
    function showEmpty(list, message) {
      const empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = message;
      list.append(empty);
    }
    function renderTours(list, entries) {
      for (const tour of entries) {
      const card = document.createElement("article"),
        title = document.createElement("strong"),
        details = document.createElement("span"),
        open = document.createElement("button"),
        remove = document.createElement("button");
      title.textContent = tour.name;
      details.textContent = [
        tour.plan?.artist,
        tour.plan?.genre,
        tour.plan?.start,
        tour.plan?.departOn && tour.plan?.returnBy
          ? `${tour.plan.departOn} to ${tour.plan.returnBy}`
          : "",
        tour.plan?.distanceMiles
          ? `${tour.plan.distanceMiles.toLocaleString()} mi`
          : "",
      ]
        .filter(Boolean)
        .join(" · ");
      open.type = remove.type = "button";
      open.textContent = "Open";
      remove.textContent = "🗑️";
      remove.title = "Delete saved tour";
      remove.setAttribute("aria-label", "Delete saved tour");
      open.addEventListener("click", () => {
        artistInput.value = tour.plan?.artist || "";
        if (
          tour.plan?.actType &&
          [...performerType.options].some(
            (option) => option.value === tour.plan.actType,
          )
        )
          performerType.value = tour.plan.actType;
        if (
          tour.plan?.genre &&
          [...genreInput.options].some(
            (option) => option.value === tour.plan.genre,
          )
        )
          genreInput.value = tour.plan.genre;
        if (
          tour.plan?.venueType &&
          [...venueTypeInput.options].some(
            (option) => option.value === tour.plan.venueType,
          )
        )
          venueTypeInput.value = tour.plan.venueType;
        $("startCity").value = tour.plan?.start || "";
        $("days").value = String(tour.plan?.days || 7);
        if (tour.plan?.departOn) departInput.value = tour.plan.departOn;
        if (tour.plan?.returnBy) returnInput.value = tour.plan.returnBy;
        if (
          tour.plan?.direction &&
          tourDirectionsForUi.has(tour.plan.direction)
        ) {
          bookingMode.value = "direction";
          directionSelect.value = tour.plan.direction;
          updateBookingMode();
        }
        routeResults.replaceChildren();
        const summary = document.createElement("section"),
          heading = document.createElement("h3"),
          copy = document.createElement("p");
        summary.className = "route-summary";
        heading.textContent = tour.name;
        copy.textContent = `Gig plan with ${(tour.plan?.markets || []).length} proposed markets. Rebuild the route to refresh current venue and hotel contacts.`;
        summary.append(heading, copy);
        routeResults.append(summary);
        recalculate();
      });
      remove.addEventListener("click", async () => {
        if (!(await window.danzstakConfirm(`The saved gig plan “${tour.name}” will be removed from your account.`, { title: "Delete gig plan?", confirmLabel: "Delete plan", danger: true }))) return;
        try {
          await toursRequest("/tours/" + encodeURIComponent(tour.tourId), {
            method: "DELETE",
          });
          await loadSavedTours();
        } catch (error) {
          saveStatus.textContent = error.message;
        }
      });
      card.append(title, details, open, remove);
      list.append(card);
      }
    }
    renderTours(upcomingList, upcomingTours);
    renderTours(pastList, pastTours);
    if (!upcomingTours.length)
      showEmpty(upcomingList, "No upcoming gigs yet. Build a route and add it here.");
    if (!pastTours.length)
      showEmpty(pastList, "Completed gig plans will appear here.");
  }
  async function loadSavedTours() {
    try {
      const data = await toursRequest("/tours");
      showSavedTours(data.tours || []);
    } catch (error) {
      saveStatus.textContent = error.message;
    }
  }
  saveTour.addEventListener("click", async () => {
    const name = tourName.value.trim();
    if (!latestRoute || !name) {
      saveStatus.textContent = "Build a route and give it a name first.";
      return;
    }
    saveTour.disabled = true;
    saveStatus.textContent = "Saving tour…";
    const route = latestRoute.route,
      markets = (latestRoute.candidates || []).map((market) => ({
        stop: market.stop,
        proposedDate: market.proposedDate || "",
        confirmed: market.confirmed === true,
        venue: null,
      }));
    try {
      await toursRequest("/tours", {
        method: "POST",
        body: JSON.stringify({
          name: name,
          artist: artistInput.value.trim(),
          actType: performerType.value,
          genre: genreInput.value,
          venueType: venueTypeInput.value,
          start: route.start?.label || $("startCity").value.trim(),
          direction: route.direction || "custom",
          departOn: route.departOn || departInput.value,
          returnBy: route.returnBy || returnInput.value,
          days: route.requestedDays || number("days"),
          distanceMiles: route.distanceMiles || number("miles"),
          markets: markets,
        }),
      });
      saveStatus.textContent = "Gig plan added to Upcoming gigs.";
      tourName.value = "";
      await loadSavedTours();
    } catch (error) {
      saveStatus.textContent = error.message;
    } finally {
      saveTour.disabled = false;
    }
  });
  loadSavedTours();
  $("printPlan").addEventListener("click", () => window.print());
  recalculate();
})();
