"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

(async () => {
  const storeScript = fs.readFileSync("assets/store.js", "utf8");
  const eventScript = fs.readFileSync("assets/event.js", "utf8");
  assert.match(storeScript, /store catalog is temporarily unavailable/i, "network failures must not expose raw browser errors in Store");
  assert.match(eventScript, /event details are temporarily unavailable/i, "network failures must not expose raw browser errors on public events");

  const { createMarketplace, marketplaceFeeCents } = await import("./infrastructure/auth-api/marketplace.mjs");

  class Command { constructor(input) { this.input = input; } }
  class GetItemCommand extends Command {}
  class PutItemCommand extends Command {}
  class QueryCommand extends Command {}
  class TransactWriteItemsCommand extends Command {}
  const commands = { GetItemCommand, PutItemCommand, QueryCommand, TransactWriteItemsCommand };
  const records = new Map();
  const keyOf = value => `${value.pk.S}|${value.sk.S}`;
  function applyPut(input, source = records) {
    const key = keyOf(input.Item), current = source.get(key);
    if (input.ConditionExpression === "attribute_not_exists(pk)" && current) {
      const error = new Error("exists"); error.name = "ConditionalCheckFailedException"; throw error;
    }
    if (input.ConditionExpression === "attribute_exists(pk)" && !current) {
      const error = new Error("missing"); error.name = "ConditionalCheckFailedException"; throw error;
    }
    if (input.ConditionExpression === "revision = :revision" && current?.revision?.N !== input.ExpressionAttributeValues[":revision"].N) {
      const error = new Error("stale"); error.name = "ConditionalCheckFailedException"; throw error;
    }
    source.set(key, structuredClone(input.Item));
  }
  const db = { async send(command) {
    if (command instanceof GetItemCommand) return { Item: records.get(keyOf(command.input.Key)) };
    if (command instanceof QueryCommand) {
      const prefix = command.input.ExpressionAttributeValues[":pk"].S;
      const sortPrefix = command.input.ExpressionAttributeValues[":product"].S;
      return { Items: [...records.values()].filter(item => item.pk.S === prefix && item.sk.S.startsWith(sortPrefix)).sort((a, b) => a.sk.S.localeCompare(b.sk.S)) };
    }
    if (command instanceof PutItemCommand) { applyPut(command.input); return {}; }
    if (command instanceof TransactWriteItemsCommand) {
      const staged = new Map([...records.entries()].map(([key, value]) => [key, structuredClone(value)]));
      try {
        for (const operation of command.input.TransactItems) {
          if (operation.Put) applyPut(operation.Put, staged);
          else if (operation.Delete) staged.delete(keyOf(operation.Delete.Key));
          else throw new Error("Unsupported transaction operation");
        }
      } catch (error) { error.name = "TransactionCanceledException"; throw error; }
      records.clear(); for (const [key, value] of staged) records.set(key, value);
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
  const event = (method, path, body, origin = "https://danzstak.com") => ({ requestContext: { http: { method } }, rawPath: path, headers: { origin }, body: body === undefined ? "" : JSON.stringify(body) });
  const bodyOf = result => JSON.parse(result.body);

  assert.equal(marketplaceFeeCents(100), 5);
  assert.equal(marketplaceFeeCents(1_999), 100, "5% fee rounds to integer cents on the server");
  assert.throws(() => marketplaceFeeCents(12.5), /integer cents/);

  const missing = await service(event("GET", "/marketplace/shop/artist_12345678"));
  assert.equal(missing.statusCode, 404);
  const rejectedOrigin = await service(event("PUT", "/marketplace/shop", { name: "Nope", status: "published" }, "https://evil.example"));
  assert.equal(rejectedOrigin.statusCode, 403);

  const opened = await service(event("PUT", "/marketplace/shop", { name: "Eroticon Records", description: "Independent releases and tour merchandise.", status: "published" }));
  assert.equal(opened.statusCode, 201);
  assert.equal(bodyOf(opened).shop.name, "Eroticon Records");
  assert.equal(bodyOf(opened).shop.revision, 1);

  const invalidAudio = await service(event("POST", "/marketplace/products", { title: "Audio file", priceCents: 500, inventory: 1, productType: "audio", imageUrl: "https://example.com/cover.jpg" }));
  assert.equal(invalidAudio.statusCode, 400, "audio products are rejected rather than silently converted");
  const inflatedShipping = await service(event("POST", "/marketplace/products", { title: "Hidden price", priceCents: 100, shippingCents: 1_500, inventory: 1, status: "published", imageUrl: "https://cdn.example.com/item.webp" }));
  assert.equal(inflatedShipping.statusCode, 400, "shipping cannot be used to hide the item price");
  assert.match(bodyOf(inflatedShipping).error, /shipping cannot cost more/i);

  const created = await service(event("POST", "/marketplace/products", { title: "Tour shirt", description: "Black cotton shirt", priceCents: 2_500, shippingCents: 500, inventory: 12, status: "published", imageUrl: "https://cdn.example.com/shirt.webp" }));
  assert.equal(created.statusCode, 201);
  const product = bodyOf(created).product;
  assert.equal(product.available, true);
  assert.equal(product.inventory, 12);
  assert.equal(product.danzstakFeeCents, 125, "DanzStak earns 5% of item price only");

  const bazaar = bodyOf(await service(event("GET", "/marketplace/bazaar")));
  assert.equal(bazaar.products.length, 1);
  assert.equal(bazaar.products[0].shopName, "Eroticon Records");
  assert.equal(bazaar.products[0].shippingCents, 500);
  assert.equal(bazaar.products[0].danzstakFeeCents, 125);
  const bazaarProduct = bodyOf(await service(event("GET", `/marketplace/bazaar/${product.id}`))).product;
  assert.equal(bazaarProduct.memberId, "artist_12345678");

  signedInUser = "viewer_12345678";
  const publicShop = await service(event("GET", "/marketplace/shop/artist_12345678"));
  assert.equal(publicShop.statusCode, 200);
  const publicData = bodyOf(publicShop).shop;
  assert.equal(publicData.name, "Eroticon Records");
  assert.equal(publicData.revision, undefined, "public shop responses do not expose owner revision state");
  assert.equal(publicData.products.length, 1, "draft products stay private");
  assert.equal(publicData.products[0].inventory, undefined, "public products expose availability rather than exact stock");

  signedInUser = "artist_12345678";
  const stale = await service(event("PATCH", `/marketplace/products/${product.id}`, { ...product, revision: 99, inventory: 9, status: "published" }));
  assert.equal(stale.statusCode, 409);
  const updated = await service(event("PATCH", `/marketplace/products/${product.id}`, { ...product, revision: 1, inventory: 9, status: "published" }));
  assert.equal(updated.statusCode, 200);
  assert.equal(bodyOf(updated).product.revision, 2);
  assert.equal(bodyOf(updated).product.inventory, 9);

  const archived = await service(event("DELETE", `/marketplace/products/${product.id}`));
  assert.equal(archived.statusCode, 200);
  signedInUser = "viewer_12345678";
  assert.equal(bodyOf(await service(event("GET", "/marketplace/shop/artist_12345678"))).shop.products.length, 0, "archived products disappear from the public shop");
  assert.equal(bodyOf(await service(event("GET", "/marketplace/bazaar"))).products.length, 0, "archived products disappear from the Bazaar");
  assert.equal((await service(event("GET", `/marketplace/bazaar/${product.id}`))).statusCode, 404);

  signedInUser = "artist_12345678";
  assert.equal((await service(event("POST", "/marketplace/store/products", { title: "Unauthorized", priceCents: 500, inventory: 1 }))).statusCode, 403);
  signedInUser = "admin_12345678";
  const officialStore = await service(event("PUT", "/marketplace/store", { name: "Wrong name", description: "Official DanzStak merchandise.", status: "published" }));
  assert.equal(officialStore.statusCode, 201);
  assert.equal(bodyOf(officialStore).shop.name, "DanzStak Store", "the official store name cannot be replaced by browser input");
  const officialProduct = await service(event("POST", "/marketplace/store/products", { title: "Official shirt", priceCents: 2_500, inventory: 10, status: "published" }));
  assert.equal(officialProduct.statusCode, 201);
  signedInUser = "viewer_12345678";
  const publicOfficialStore = await service(event("GET", "/marketplace/store"));
  assert.equal(publicOfficialStore.statusCode, 200);
  assert.equal(bodyOf(publicOfficialStore).shop.products.length, 1);

  console.log("Marketplace catalog checks passed: Bazaar projection, one member shop, official-store authorization, physical-only products, shipping-abuse blocking, safe public views, inventory, optimistic edits and exact item-only 5% fee math.");
})().catch(error => { console.error(error); process.exit(1); });
