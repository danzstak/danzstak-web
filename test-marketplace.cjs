"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

(async () => {
  const storeScript = fs.readFileSync("assets/store.js", "utf8");
  const eventScript = fs.readFileSync("assets/event.js", "utf8");
  assert.match(storeScript, /store catalog is temporarily unavailable/i, "network failures must not expose raw browser errors in Store");
  assert.match(eventScript, /event details are temporarily unavailable/i, "network failures must not expose raw browser errors on public events");

  const { createMarketplace, marketplaceFeeCents, encodeBazaarCursor, decodeBazaarCursor, shippingFeeAvoidanceRisk } = await import("./infrastructure/auth-api/marketplace.mjs");

  class Command { constructor(input) { this.input = input; } }
  class GetItemCommand extends Command {}
  class PutItemCommand extends Command {}
  class QueryCommand extends Command {}
  const commands = { GetItemCommand, PutItemCommand, QueryCommand };
  const records = new Map();
  const keyOf = value => `${value.pk.S}|${value.sk.S}`;
  const db = { async send(command) {
    if (command instanceof GetItemCommand) return { Item: records.get(keyOf(command.input.Key)) };
    if (command instanceof QueryCommand) {
      if (command.input.IndexName === "BazaarIndex") {
        const partition = command.input.ExpressionAttributeValues[":bazaar"].S;
        const items = [...records.values()]
          .filter(item => item.bazaarPk?.S === partition)
          .sort((a, b) => b.bazaarSk.S.localeCompare(a.bazaarSk.S));
        return { Items: items.slice(0, command.input.Limit || 24) };
      }
      const prefix = command.input.ExpressionAttributeValues[":pk"].S;
      const sortPrefix = command.input.ExpressionAttributeValues[":product"].S;
      return { Items: [...records.values()].filter(item => item.pk.S === prefix && item.sk.S.startsWith(sortPrefix)).sort((a, b) => a.sk.S.localeCompare(b.sk.S)) };
    }
    if (command instanceof PutItemCommand) {
      const key = keyOf(command.input.Item), current = records.get(key);
      if (command.input.ConditionExpression === "attribute_not_exists(pk)" && current) {
        const error = new Error("exists"); error.name = "ConditionalCheckFailedException"; throw error;
      }
      if (command.input.ConditionExpression === "attribute_exists(pk)" && !current) {
        const error = new Error("missing"); error.name = "ConditionalCheckFailedException"; throw error;
      }
      if (command.input.ConditionExpression === "revision = :revision" && current?.revision?.N !== command.input.ExpressionAttributeValues[":revision"].N) {
        const error = new Error("stale"); error.name = "ConditionalCheckFailedException"; throw error;
      }
      records.set(key, structuredClone(command.input.Item));
      return {};
    }
    throw new Error(`Unexpected command ${command.constructor.name}`);
  } };

  let signedInUser = "artist_12345678";
  const corsHeaders = origin => origin === "https://danzstak.com" ? { "access-control-allow-origin": origin } : {};
  const service = createMarketplace({
    db,
    commands,
    authenticate: async () => signedInUser,
    corsHeaders,
    tableName: "Marketplace",
    env: { MARKETPLACE_ADMIN_USER_IDS: "admin_12345678" },
    clock: () => Date.parse("2026-11-09T12:00:00.000Z")
  });
  const event = (method, path, body, origin = "https://danzstak.com", queryStringParameters) => ({ requestContext: { http: { method } }, rawPath: path, headers: { origin }, body: body === undefined ? "" : JSON.stringify(body), queryStringParameters });
  const bodyOf = result => JSON.parse(result.body);
  const physicalProduct = (overrides = {}) => ({
    title: "Tour shirt",
    description: "Black cotton shirt\n\nPrinted by hand in Seattle.",
    images: ["https://cdn.example.com/shirt-front.webp", "https://cdn.example.com/shirt-back.webp"],
    itemSpecifics: { medium: "Heavyweight cotton", dimensions: "Size L", condition: "New", yearCreated: 2026, signatureStatus: "Unsigned" },
    priceCents: 2_500,
    shippingCents: 500,
    inventory: 12,
    status: "published",
    productType: "physical",
    ...overrides
  });

  assert.equal(marketplaceFeeCents(100), 5);
  assert.equal(marketplaceFeeCents(1_999), 100, "5% fee rounds to integer cents on the server");
  assert.equal(marketplaceFeeCents(1_999), 100, "seller-set shipping is never included in DanzStak's fee base");
  assert.notEqual(marketplaceFeeCents(1_999), marketplaceFeeCents(1_999 + 699), "shipping must not be passed into the marketplace fee calculation");
  assert.throws(() => marketplaceFeeCents(12.5), /integer cents/);
  assert.equal(shippingFeeAvoidanceRisk({ priceCents: 100, shippingCents: 1_500 }), true, "$1 item plus $15 shipping is blocked as a fee-avoidance risk");
  assert.equal(shippingFeeAvoidanceRisk({ priceCents: 1_000, shippingCents: 1_500 }), false, "ordinary seller-set shipping remains available");
  const cursorKey = { pk:{S:"SHOP#artist_12345678"}, sk:{S:"PRODUCT#11111111-1111-4111-8111-111111111111"}, bazaarPk:{S:"BAZAAR#PUBLISHED"}, bazaarSk:{S:"2026-11-09T12:00:00.000Z#artist_12345678#11111111-1111-4111-8111-111111111111"} };
  assert.deepEqual(decodeBazaarCursor(encodeBazaarCursor(cursorKey)), cursorKey, "Bazaar pagination cursors round-trip without exposing a mutable query");
  assert.equal(decodeBazaarCursor("not-a-valid-cursor"), undefined);

  const missing = await service(event("GET", "/marketplace/shop/artist_12345678"));
  assert.equal(missing.statusCode, 404);
  const rejectedOrigin = await service(event("PUT", "/marketplace/shop", { name: "Nope", status: "published" }, "https://evil.example"));
  assert.equal(rejectedOrigin.statusCode, 403);
  const invalidBazaarCursor = await service(event("GET", "/marketplace/bazaar", undefined, "https://danzstak.com", { cursor:"not-a-valid-cursor" }));
  assert.equal(invalidBazaarCursor.statusCode, 400);

  const opened = await service(event("PUT", "/marketplace/shop", { name: "Eroticon Records", description: "Independent releases and tour merchandise.", status: "published" }));
  assert.equal(opened.statusCode, 201);
  assert.equal(bodyOf(opened).shop.name, "Eroticon Records");
  assert.equal(bodyOf(opened).shop.revision, 1);

  const invalidAudio = await service(event("POST", "/marketplace/products", { title: "Audio file", priceCents: 500, inventory: 1, productType: "audio", imageUrl: "https://example.com/cover.jpg" }));
  assert.equal(invalidAudio.statusCode, 400, "audio products are rejected rather than silently converted");
  const missingSpecifics = await service(event("POST", "/marketplace/products", { ...physicalProduct(), itemSpecifics: undefined }));
  assert.equal(missingSpecifics.statusCode, 400, "published goods require marketplace item specifics");
  const invalidCondition = await service(event("POST", "/marketplace/products", physicalProduct({ itemSpecifics: { ...physicalProduct().itemSpecifics, condition: "Unknown" } })));
  assert.equal(invalidCondition.statusCode, 400, "condition values are server validated");
  const tooManyImages = await service(event("POST", "/marketplace/products", physicalProduct({ images: Array.from({ length: 9 }, (_, index) => `https://cdn.example.com/${index}.webp`) })));
  assert.equal(tooManyImages.statusCode, 400, "a listing accepts no more than eight HTTPS images");
  const inflatedShipping = await service(event("POST", "/marketplace/products", physicalProduct({ priceCents: 100, shippingCents: 1_500 })));
  assert.equal(inflatedShipping.statusCode, 422, "disproportionate shipping is blocked before the listing is stored");
  assert.match(bodyOf(inflatedShipping).error, /shipping is unusually high/i);

  const created = await service(event("POST", "/marketplace/products", physicalProduct()));
  assert.equal(created.statusCode, 201);
  const product = bodyOf(created).product;
  assert.equal(product.available, true);
  assert.equal(product.inventory, 12);
  assert.deepEqual(product.images, physicalProduct().images, "all validated product images survive the API round trip");
  assert.deepEqual(product.itemSpecifics, physicalProduct().itemSpecifics, "item specifics survive the API round trip");

  signedInUser = "viewer_12345678";
  const publicShop = await service(event("GET", "/marketplace/shop/artist_12345678"));
  assert.equal(publicShop.statusCode, 200);
  const publicData = bodyOf(publicShop).shop;
  assert.equal(publicData.name, "Eroticon Records");
  assert.equal(publicData.revision, undefined, "public shop responses do not expose owner revision state");
  assert.equal(publicData.products.length, 1, "draft products stay private");
  assert.equal(publicData.products[0].inventory, undefined, "public products expose availability rather than exact stock");
  const bazaar = await service(event("GET", "/marketplace/bazaar"));
  assert.equal(bazaar.statusCode, 200);
  assert.equal(bodyOf(bazaar).listings.length, 1, "a published available member item appears automatically in the Bazaar");
  assert.equal(bodyOf(bazaar).listings[0].shopName, "Eroticon Records", "Bazaar items name the original member shop");
  assert.equal(bodyOf(bazaar).listings[0].memberId, "artist_12345678", "Bazaar items link back to the seller shop");

  signedInUser = "artist_12345678";
  const stale = await service(event("PATCH", `/marketplace/products/${product.id}`, { ...product, revision: 99, inventory: 9, status: "published" }));
  assert.equal(stale.statusCode, 409);
  const updated = await service(event("PATCH", `/marketplace/products/${product.id}`, { ...product, revision: 1, inventory: 9, status: "published" }));
  assert.equal(updated.statusCode, 200);
  assert.equal(bodyOf(updated).product.revision, 2);
  assert.equal(bodyOf(updated).product.inventory, 9);

  signedInUser = "artist_12345678";
  const soldOut = await service(event("PATCH", `/marketplace/products/${product.id}`, { ...product, revision: 2, inventory: 0, status: "sold_out" }));
  assert.equal(soldOut.statusCode, 200);
  signedInUser = "viewer_12345678";
  assert.equal(bodyOf(await service(event("GET", "/marketplace/bazaar"))).listings.length, 0, "sold-out items leave the Bazaar automatically");
  signedInUser = "artist_12345678";
  const relisted = await service(event("PATCH", `/marketplace/products/${product.id}`, { ...product, revision: 3, inventory: 4, status: "published" }));
  assert.equal(relisted.statusCode, 200);
  signedInUser = "viewer_12345678";
  assert.equal(bodyOf(await service(event("GET", "/marketplace/bazaar"))).listings.length, 1, "restocked published items return to the Bazaar automatically");

  signedInUser = "artist_12345678";
  const archived = await service(event("DELETE", `/marketplace/products/${product.id}`));
  assert.equal(archived.statusCode, 200);
  signedInUser = "viewer_12345678";
  assert.equal(bodyOf(await service(event("GET", "/marketplace/shop/artist_12345678"))).shop.products.length, 0, "archived products disappear from the public shop");

  signedInUser = "artist_12345678";
  assert.equal((await service(event("POST", "/marketplace/store/products", { title: "Unauthorized", priceCents: 500, inventory: 1 }))).statusCode, 403);
  signedInUser = "admin_12345678";
  const officialStore = await service(event("PUT", "/marketplace/store", { name: "Wrong name", description: "Official DanzStak merchandise.", status: "published" }));
  assert.equal(officialStore.statusCode, 201);
  assert.equal(bodyOf(officialStore).shop.name, "DanzStak Official Store", "the official store name cannot be replaced by browser input");
  const officialProduct = await service(event("POST", "/marketplace/store/products", physicalProduct({ title: "Official shirt", inventory: 10 })));
  assert.equal(officialProduct.statusCode, 201);
  signedInUser = "viewer_12345678";
  const publicOfficialStore = await service(event("GET", "/marketplace/store"));
  assert.equal(publicOfficialStore.statusCode, 200);
  assert.equal(bodyOf(publicOfficialStore).shop.products.length, 1);
  assert.equal(bodyOf(await service(event("GET", "/marketplace/bazaar"))).listings.length, 0, "official-store products stay in the Official Store and never mix into the member Bazaar");

  const storePage = fs.readFileSync("store.html", "utf8");
  const feedPage = fs.readFileSync("feed.html", "utf8");
  assert.match(storePage, /id="bazaarSearch"/);
  for (const field of ["productImages", "productMedium", "productDimensions", "productCondition", "productYear", "productSignature"]) assert.match(storePage, new RegExp(`id="${field}"`));
  assert.match(storeScript, /\/marketplace\/bazaar/);
  assert.match(storeScript, /Sold by \$\{product\.shopName\}/);
  assert.match(storeScript, /memberProductUrl\(product\)/, "each Bazaar item must deep-link to its original member-shop item");
  assert.match(storeScript, /function renderProductDetail\(/, "the canonical seller listing has a real product-detail view");
  assert.match(storeScript, /descriptionBlocks\(product\.description\)/, "plain-text description paragraphs are rendered safely without HTML injection");
  assert.doesNotMatch(storePage + storeScript, /\b(?:bid|auction)\b/i, "the Bazaar is fixed-price only and must not expose bidding controls");
  assert.match(feedPage, /DanzStak Official Store/);
  assert.match(feedPage, /store\.html\?view=bazaar[\s\S]*DanzStak Bazaar/);

  console.log("Marketplace catalog checks passed: member-shop items flow into the fixed-price Bazaar, seller links remain canonical, item specifics and images are validated, inflated shipping is blocked, and the exact 5% item-price-only fee remains server-owned.");
})().catch(error => { console.error(error); process.exit(1); });
