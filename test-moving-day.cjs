"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const parser = require("./assets/moving-day-parse.js");

(async () => {
  // Parsing a shop's own exports in the browser.
  const discogs = 'listing_id,artist,title,label,catno,format,release_id,status,price,listed,comments,media_condition,sleeve_condition,accept_offer,external_id,weight,format_quantity,flat_shipping,location\n'
    + '111,Eroticon,"More Machine Than Human",Sleeping Dragon,SDR001,"Vinyl, 12""",9,For Sale,25.00,2026-01-01,"Clean copy, plays great",Near Mint (NM or M-),Very Good Plus (VG+),N,,230,1,5.00,Crate A\n'
    + '112,Unknown,Thing,,,"CD",10,Sold,8.00,,,,,N,,,1,,\n'
    + '113,Someone,"Cheap, but",Lbl,C1,LP,11,For Sale,0.10,,,,,N,,,1,,\n';
  const parsed = parser.toItems(parser.parseCsv(discogs));
  assert.equal(parsed.source, "discogs");
  assert.equal(parsed.items.length, 3);
  const first = parsed.items[0];
  assert.equal(first.title, "Eroticon – More Machine Than Human");
  assert.equal(first.priceCents, 2500);
  assert.equal(first.shippingCents, 500);
  assert.equal(first.inventory, 1);
  assert.equal(first.sourceRef, "discogs:111");
  assert.match(first.description, /Format: Vinyl, 12"/);
  assert.match(first.description, /Label: Sleeping Dragon · SDR001/);
  assert.match(first.description, /Media: Near Mint/);
  assert.match(first.description, /Sleeve: Very Good Plus/);
  assert.equal(first.forSale, true);
  assert.equal(parsed.items[1].forSale, false, "sold Discogs rows are not picked by default");
  assert.deepEqual(parsed.items[2].problems, ["no price"], "prices under 0.50 need a fix");
  assert.ok(parsed.unused.includes("release_id") && parsed.unused.includes("location"), "unmapped columns are shown, not silently dropped");
  assert.equal(first.imageUrl, "", "no picture is invented or copied");

  const shopify = parser.toItems(parser.parseCsv("Handle,Title,Body (HTML),Variant Price,Variant Inventory Qty,Image Src\ntee,Tour Tee,<p>Black &amp; orange</p>,20,12,https://cdn.example/tee.jpg\n"));
  assert.equal(shopify.source, "shopify");
  assert.equal(shopify.items[0].description, "Black & orange");
  assert.equal(shopify.items[0].inventory, 12);
  assert.equal(shopify.items[0].imageUrl, "https://cdn.example/tee.jpg");
  assert.equal(parser.money("€ 12,50"), 1250, "European decimal commas");
  assert.equal(parser.money("1,250.00"), 125000);
  const tabbed = parser.toItems(parser.parseCsv("title\tprice\nA record\t9.99\nA record\t9.99\n"));
  assert.notEqual(tabbed.items[0].sourceRef, tabbed.items[1].sourceRef, "rows without ids still get distinct references");

  const page = fs.readFileSync("moving-day.html", "utf8");
  assert.match(page, /moving-day-parse\.js/);
  assert.doesNotMatch(page, /oauth|api\.discogs|discogs\.com\/oauth/i, "Moving Day never asks for a platform login or API");
  assert.match(fs.readFileSync("store.html", "utf8"), /href="moving-day\.html"/, "My Shop links to Moving Day");
  assert.match(fs.readFileSync("service-worker.js", "utf8"), /"\/moving-day\.html"/);
  assert.match(fs.readFileSync("aws-deploy-auth-api.ps1", "utf8"), /"POST \/marketplace\/products\/import"/);
  assert.doesNotMatch(fs.readFileSync("assets/moving-day.js", "utf8"), /innerHTML/, "imported text is never rendered as HTML");

  // Server import.
  const { createMarketplace, importProductId, MAX_SHOP_PRODUCTS } = await import("./infrastructure/auth-api/marketplace.mjs");
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
      const all = [...records.values()].filter(item => item.pk.S === prefix && item.sk.S.startsWith(sortPrefix)).sort((a, b) => a.sk.S.localeCompare(b.sk.S));
      const from = command.input.ExclusiveStartKey ? all.findIndex(item => item.sk.S === command.input.ExclusiveStartKey.sk.S) + 1 : 0;
      const page = all.slice(from, from + (command.input.Limit || all.length));
      return { Items: page, ...(from + page.length < all.length ? { LastEvaluatedKey: { pk: page.at(-1).pk, sk: page.at(-1).sk } } : {}) };
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
  const event = (method, path, body, origin = "https://danzstak.com", query) => ({ requestContext: { http: { method } }, rawPath: path, headers: { origin }, queryStringParameters: query, body: body === undefined ? "" : JSON.stringify(body) });
  const bodyOf = result => JSON.parse(result.body);
  const row = (n, extra = {}) => ({ sourceRef: `discogs:${n}`, title: `Artist – Record ${n}`, description: "Format: LP", priceCents: 1500, shippingCents: 400, inventory: 1, imageUrl: "", ...extra });

  assert.equal((await service(event("POST", "/marketplace/products/import", { items: [row(1)] }))).statusCode, 409, "a shop must be named first");
  assert.equal((await service(event("PUT", "/marketplace/shop", { name: "Crate Diggers", status: "published" }))).statusCode, 201);
  assert.equal((await service(event("POST", "/marketplace/products/import", { items: [row(1)] }, "https://evil.example"))).statusCode, 403);
  assert.equal((await service(event("POST", "/marketplace/products/import", { items: Array.from({ length: 101 }, (_, i) => row(i)) }))).statusCode, 400, "batches are capped at 100");

  const batch = Array.from({ length: 100 }, (_, i) => row(i + 1));
  batch[5] = row(6, { shippingCents: 9999 });
  batch[6] = row(7, { priceCents: 10 });
  const first100 = bodyOf(await service(event("POST", "/marketplace/products/import", { status: "published", items: batch })));
  assert.equal(first100.moved, 98);
  assert.equal(first100.errors, 2);
  assert.match(first100.results[5].error, /Shipping/);
  const again = bodyOf(await service(event("POST", "/marketplace/products/import", { status: "published", items: batch.slice(0, 10) })));
  assert.equal(again.moved, 0, "moving the same rows twice never duplicates");
  assert.equal(again.skipped, 8);
  assert.equal(first100.results[0].productId, importProductId("artist_12345678", "discogs:1"));

  for (let start = 101; start <= 1001; start += 100) {
    const result = bodyOf(await service(event("POST", "/marketplace/products/import", { status: "published", items: Array.from({ length: 100 }, (_, i) => row(start + i)) })));
    assert.equal(result.moved, 100);
  }
  const shop = bodyOf(await service(event("GET", "/marketplace/shop"))).shop;
  assert.equal(shop.products.length, 1098, "a 1,000+ record shop reads every page, not just the first 250");
  const bazaarPage = bodyOf(await service(event("GET", "/marketplace/bazaar", undefined, undefined, { offset: "0" })));
  assert.equal(bazaarPage.products.length, 60);
  assert.equal(bazaarPage.total, 1098);
  assert.equal(bazaarPage.nextOffset, 60);
  const lastPage = bodyOf(await service(event("GET", "/marketplace/bazaar", undefined, undefined, { offset: "1080" })));
  assert.equal(lastPage.products.length, 18);
  assert.equal(lastPage.nextOffset, null);
  const searched = bodyOf(await service(event("GET", "/marketplace/bazaar", undefined, undefined, { q: "record 1001" })));
  assert.equal(searched.total, 1);
  const drafts = bodyOf(await service(event("POST", "/marketplace/products/import", { items: [row(5000)] })));
  assert.equal(drafts.moved, 1);
  assert.equal(bodyOf(await service(event("GET", "/marketplace/bazaar", undefined, undefined, { q: "record 5000" }))).total, 0, "drafts stay out of the Bazaar");
  assert.ok(MAX_SHOP_PRODUCTS >= 5000);

  console.log("Moving Day checks passed: Discogs/eBay/Shopify/spreadsheet exports parsed in the browser, no platform login, unmapped columns shown, batches of 100, retries never duplicate, 1,000+ item shops page fully, Bazaar search and Show more.");
})().catch(error => { console.error(error); process.exit(1); });
