"use strict";
// Owner 2026-11-19: shops take photos from the phone — a cover, a shop album every shop gets, and product photos —
// not only https links. Keys must be the member's own uploads; views show signed URLs; visitors never see keys.
const assert = require("node:assert/strict");

(async () => {
  const { createMarketplace } = await import("./infrastructure/auth-api/marketplace.mjs");
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
  const prefixes = { artist_12345678: "a".repeat(24), other_12345678: "b".repeat(24) };
  const service = createMarketplace({ db, commands, authenticate: async () => signedInUser, corsHeaders, tableName: "Marketplace", env: {},
    clock: () => Date.parse("2026-11-19T12:00:00.000Z"), mediaOwnerPrefix: async id => prefixes[id] || "", signMedia: key => "https://signed.example/" + key });
  const event = (method, path, body, origin = "https://danzstak.com") => ({ requestContext: { http: { method } }, rawPath: path, headers: { origin }, body: body === undefined ? "" : JSON.stringify(body) });
  const bodyOf = result => JSON.parse(result.body);
  const mine = n => `users/${"a".repeat(24)}/0000000${n}-0000-4000-8000-000000000000.jpg`;
  const theirs = `users/${"b".repeat(24)}/00000009-0000-4000-8000-000000000000.jpg`;

  // A new shop has an (empty) album from the start.
  let saved = await service(event("PUT", "/marketplace/shop", { name: "Night Shift Records", description: "", status: "published" }));
  assert.equal(saved.statusCode, 201);
  assert.deepEqual(bodyOf(saved).shop.album, [], "every shop gets an album");
  assert.equal(bodyOf(saved).shop.coverUrl, "");

  // Cover + album from the member's own uploads.
  saved = await service(event("PUT", "/marketplace/shop", { name: "Night Shift Records", description: "", status: "published", coverKey: mine(1), albumKeys: [mine(2), mine(3), mine(2)] }));
  assert.equal(saved.statusCode, 200);
  let shop = bodyOf(saved).shop;
  assert.equal(shop.coverUrl, "https://signed.example/" + mine(1));
  assert.deepEqual(shop.album.map(p => p.key), [mine(2), mine(3)], "album keeps order and drops duplicates");

  // Saving the name again keeps the cover and album.
  saved = await service(event("PUT", "/marketplace/shop", { name: "Night Shift", description: "", status: "published" }));
  assert.equal(bodyOf(saved).shop.coverUrl, "https://signed.example/" + mine(1), "cover survives a name change");
  assert.equal(bodyOf(saved).shop.album.length, 2, "album survives a name change");

  // Someone else's upload or a non-image is refused.
  assert.equal((await service(event("PUT", "/marketplace/shop", { name: "X", status: "draft", coverKey: theirs }))).statusCode, 400);
  assert.equal((await service(event("PUT", "/marketplace/shop", { name: "X", status: "draft", albumKeys: [mine(2).replace(".jpg", ".mp3")] }))).statusCode, 400);
  assert.equal((await service(event("PUT", "/marketplace/shop", { name: "X", status: "draft", albumKeys: Array.from({ length: 61 }, (_, i) => mine(1)) }))).statusCode, 400);

  // Product photo from the phone.
  let product = await service(event("POST", "/marketplace/products", { title: "Tee", description: "", imageUrl: "", imageKey: mine(4), priceCents: 2500, shippingCents: 500, inventory: 3, status: "published" }));
  assert.equal(product.statusCode, 201, product.body);
  const created = bodyOf(product).product;
  assert.equal(created.imageUrl, "https://signed.example/" + mine(4));
  assert.equal((await service(event("POST", "/marketplace/products", { title: "Bad", description: "", imageUrl: "", imageKey: theirs, priceCents: 2500, shippingCents: 0, inventory: 1, status: "draft" }))).statusCode, 400);

  // Visitors see URLs, never keys; the Bazaar copy shows the photo too.
  signedInUser = "other_12345678";
  const visitor = bodyOf(await service(event("GET", "/marketplace/shop/artist_12345678"))).shop;
  assert.equal(visitor.coverUrl, "https://signed.example/" + mine(1));
  assert.ok(visitor.album.every(p => p.url && !("key" in p)), "visitors never see storage keys");
  assert.equal(visitor.products[0].imageUrl, "https://signed.example/" + mine(4));
  assert.equal(visitor.products[0].imageKey, undefined);
  const bazaar = bodyOf(await service(event("GET", "/marketplace/bazaar"))).products;
  assert.equal(bazaar[0].imageUrl, "https://signed.example/" + mine(4), "Bazaar shows the uploaded product photo");

  // Removing the cover.
  signedInUser = "artist_12345678";
  saved = await service(event("PUT", "/marketplace/shop", { name: "Night Shift", status: "published", coverKey: "" }));
  assert.equal(bodyOf(saved).shop.coverUrl, "");
  console.log("Shop photo checks passed: cover, album (every shop gets one) and product photos from the member's own uploads; visitors see signed URLs only.");
})().catch(error => { console.error(error); process.exitCode = 1; });
