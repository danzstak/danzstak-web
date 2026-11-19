"use strict";
// Example items for the Bazaar until it goes live (owner 2026-11-18: "all example until it goes live" — show what
// the Bazaar looks like full, including the Eroticon stuff, with nothing for sale). Every card is tagged EXAMPLE,
// says "Example shop · not for sale", has no buy action, and never reaches checkout. Real published items always
// come first; examples fill in while there are fewer than 24 real items, and never appear in search results.
(() => {
  const eroticon = "assets/shop/eroticon/", made = "assets/shop/examples/";
  window.danzstakBazaarExamples = Object.freeze([
    { id: "example-eroticon-mmth", title: "Eroticon – More Machine Than Human (12\" vinyl)", shopName: "Eroticon", kind: "Record", priceCents: 2500, shippingCents: 600, imageUrl: eroticon + "mmth.jpg" },
    { id: "example-static-ward-lp", title: "Static Ward – Concrete Hymns (LP)", shopName: "Static Ward", kind: "Record", priceCents: 2200, shippingCents: 600, imageUrl: made + "static-ward-lp.svg" },
    { id: "example-eroticon-tee-robot", title: "Eroticon robot tee (black)", shopName: "Eroticon", kind: "Shirt", priceCents: 2500, shippingCents: 500, imageUrl: eroticon + "tee-robot.jpg" },
    { id: "example-patch-set", title: "Hand-stitched patch set (3)", shopName: "Basement Dispatch", kind: "Craft", priceCents: 1200, shippingCents: 300, imageUrl: made + "patch-set.svg" },
    { id: "example-eroticon-latch-on", title: "Eroticon – Latch On (12\" vinyl)", shopName: "Eroticon", kind: "Record", priceCents: 2500, shippingCents: 600, imageUrl: eroticon + "latch-on.jpg" },
    { id: "example-night-tram", title: "Low Orbit Club – Night Tram (12\")", shopName: "Night Tram Records", kind: "Record", priceCents: 1600, shippingCents: 600, imageUrl: made + "night-tram-12.svg" },
    { id: "example-eroticon-slipmats", title: "Eroticon / Sleeping Dragon slipmats (pair)", shopName: "Eroticon", kind: "Gear", priceCents: 2000, shippingCents: 400, imageUrl: eroticon + "slipmats.jpg" },
    { id: "example-static-ward-tape", title: "Static Ward – Demo 2026 (cassette)", shopName: "Static Ward", kind: "Tape", priceCents: 800, shippingCents: 300, imageUrl: made + "static-ward-tape.svg" },
    { id: "example-eroticon-spermbot", title: "Eroticon – Spermbot (12\" vinyl)", shopName: "Eroticon", kind: "Record", priceCents: 2500, shippingCents: 600, imageUrl: eroticon + "spermbot.jpg" },
    { id: "example-zine", title: "Basement Dispatch #7 (photocopied zine)", shopName: "Basement Dispatch", kind: "Craft", priceCents: 500, shippingCents: 200, imageUrl: made + "zine.svg" },
    { id: "example-bone-choir", title: "Grave Orbit – Bone Choir (LP, VG+/VG+)", shopName: "Night Tram Records", kind: "Record", priceCents: 1800, shippingCents: 600, imageUrl: made + "bone-choir-lp.svg" },
    { id: "example-eroticon-tee-wordmark", title: "Eroticon wordmark tee (black)", shopName: "Eroticon", kind: "Shirt", priceCents: 2500, shippingCents: 500, imageUrl: eroticon + "tee-wordmark.jpg" },
    { id: "example-static-ward-tee", title: "Static Ward logo tee", shopName: "Static Ward", kind: "Shirt", priceCents: 2000, shippingCents: 500, imageUrl: made + "static-ward-tee.svg" },
    { id: "example-acid-garden", title: "Signal 303 – Acid Garden (12\")", shopName: "Night Tram Records", kind: "Record", priceCents: 1500, shippingCents: 600, imageUrl: made + "acid-garden-12.svg" },
    { id: "example-eroticon-cap", title: "Sleeping Dragon Records cap (white)", shopName: "Eroticon", kind: "Gear", priceCents: 2200, shippingCents: 500, imageUrl: eroticon + "cap.jpg" },
    { id: "example-button-pack", title: "Button pack (4)", shopName: "Basement Dispatch", kind: "Craft", priceCents: 600, shippingCents: 200, imageUrl: made + "button-pack.svg" }
  ].map(item => Object.freeze({ ...item, example: true })));
  window.danzstakBazaarExampleLimit = 24;
})();
