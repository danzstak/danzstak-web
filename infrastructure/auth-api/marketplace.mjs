import { randomUUID } from "node:crypto";

const SECURITY_HEADERS = Object.freeze({
  "content-type": "application/json",
  "cache-control": "no-store",
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer"
});

const SHOP_NAME_MAX = 60;
const SHOP_DESCRIPTION_MAX = 500;
const PRODUCT_TITLE_MAX = 120;
const PRODUCT_DESCRIPTION_MAX = 2000;
const PRODUCT_MEDIUM_MAX = 80;
const PRODUCT_DIMENSIONS_MAX = 120;
const PRODUCT_SIGNATURE_MAX = 100;
const MAX_PRODUCT_IMAGES = 8;
const MAX_PRODUCT_CENTS = 5_000_000;
const MAX_SHIPPING_CENTS = 250_000;
const MAX_INVENTORY = 99_999;
const OFFICIAL_OWNER = "official";
const BAZAAR_PARTITION = "BAZAAR#PUBLISHED";
const BAZAAR_PAGE_SIZE = 24;
const BAZAAR_PAGE_MAX = 48;
const PRODUCT_ID = /^[a-f0-9-]{36}$/i;
const MEMBER_ID = /^[A-Za-z0-9_-]{8,128}$/;
const PRODUCT_CONDITIONS = new Set(["New", "Mint", "Excellent", "Good"]);

function response(statusCode, data, headers = {}) {
  return { statusCode, headers: { ...SECURITY_HEADERS, ...headers }, body: JSON.stringify(data) };
}

function parseBody(event) {
  try {
    const raw = event?.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : event?.body || "{}";
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function boundedText(value, maximum, { required = false } = {}) {
  const text = String(value || "").trim().replace(/\r\n?/g, "\n");
  if ((required && !text) || text.length > maximum) return null;
  return text;
}

function positiveInteger(value, minimum, maximum) {
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum ? number : null;
}

function safeImageUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length > 2048) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function safeImageUrls(body) {
  const source = Array.isArray(body?.images)
    ? body.images
    : Array.isArray(body?.imageUrls)
      ? body.imageUrls
      : body?.imageUrl
        ? [body.imageUrl]
        : [];
  if (!source.length || source.length > MAX_PRODUCT_IMAGES) return null;
  const images = [];
  for (const value of source) {
    const image = safeImageUrl(value);
    if (!image) return null;
    if (!images.includes(image)) images.push(image);
  }
  return images.length ? images : null;
}

function ownerKey(ownerId) {
  return ownerId === OFFICIAL_OWNER ? "STORE#OFFICIAL" : `SHOP#${ownerId}`;
}

function shopKey(ownerId) {
  return { pk: { S: ownerKey(ownerId) }, sk: { S: "META" } };
}

function productKey(ownerId, productId) {
  return { pk: { S: ownerKey(ownerId) }, sk: { S: `PRODUCT#${productId}` } };
}

function number(item, name) {
  const value = Number(item?.[name]?.N);
  return Number.isFinite(value) ? value : 0;
}

function shopView(item, products, own) {
  return {
    memberId: item.ownerId?.S === OFFICIAL_OWNER ? "" : item.ownerId?.S || "",
    official: item.ownerId?.S === OFFICIAL_OWNER,
    name: item.ownerId?.S === OFFICIAL_OWNER ? "DanzStak Official Store" : item.name?.S || "Shop",
    description: item.description?.S || "",
    status: item.status?.S || "draft",
    createdAt: item.createdAt?.S || "",
    updatedAt: item.updatedAt?.S || "",
    revision: own ? number(item, "revision") : undefined,
    products: products.map(product => productView(product, own))
  };
}

function productView(item, own) {
  const images = Array.isArray(item.images?.L)
    ? item.images.L.map(value => value?.S || "").filter(Boolean)
    : item.imageUrl?.S
      ? [item.imageUrl.S]
      : [];
  const result = {
    id: String(item.sk?.S || "").replace(/^PRODUCT#/, ""),
    title: item.title?.S || "Product",
    description: item.description?.S || "",
    imageUrl: images[0] || "",
    images,
    productType: item.productType?.S || "physical",
    priceCents: number(item, "priceCents"),
    shippingCents: number(item, "shippingCents"),
    currency: item.currency?.S || "usd",
    available: number(item, "inventory") > 0 && item.status?.S === "published",
    createdAt: item.createdAt?.S || "",
    updatedAt: item.updatedAt?.S || "",
    itemSpecifics: {
      medium: item.medium?.S || "",
      dimensions: item.dimensions?.S || "",
      condition: item.condition?.S || "",
      yearCreated: item.yearCreated?.N ? number(item, "yearCreated") : null,
      signatureStatus: item.signatureStatus?.S || ""
    }
  };
  if (own) Object.assign(result, { inventory: number(item, "inventory"), status: item.status?.S || "draft", revision: number(item, "revision") });
  return result;
}

function bazaarFields(ownerId, productId, product, updatedAt) {
  if (ownerId === OFFICIAL_OWNER || product.status !== "published" || product.inventory < 1) return {};
  return {
    bazaarPk: { S: BAZAAR_PARTITION },
    bazaarSk: { S: `${updatedAt}#${ownerId}#${productId}` }
  };
}

function withoutBazaarFields(item) {
  const { bazaarPk, bazaarSk, ...rest } = item;
  return rest;
}

function withoutMutableOptionalFields(item) {
  const { bazaarPk, bazaarSk, yearCreated, signatureStatus, ...rest } = item;
  return rest;
}

function encodeBazaarCursor(key) {
  if (!key?.pk?.S || !key?.sk?.S || !key?.bazaarPk?.S || !key?.bazaarSk?.S) return "";
  return Buffer.from(JSON.stringify({
    pk: key.pk.S,
    sk: key.sk.S,
    bazaarPk: key.bazaarPk.S,
    bazaarSk: key.bazaarSk.S
  }), "utf8").toString("base64url");
}

function decodeBazaarCursor(value) {
  const text = String(value || "");
  if (!text || text.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(text)) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(text, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object" || parsed.bazaarPk !== BAZAAR_PARTITION) return undefined;
    if (!String(parsed.pk || "").startsWith("SHOP#") || !String(parsed.sk || "").startsWith("PRODUCT#")) return undefined;
    if (!String(parsed.bazaarSk || "").includes("#")) return undefined;
    return {
      pk: { S: String(parsed.pk) },
      sk: { S: String(parsed.sk) },
      bazaarPk: { S: BAZAAR_PARTITION },
      bazaarSk: { S: String(parsed.bazaarSk) }
    };
  } catch {
    return undefined;
  }
}

function cleanShop(body) {
  if (!body || typeof body !== "object") return null;
  const name = boundedText(body.name, SHOP_NAME_MAX, { required: true });
  const description = boundedText(body.description, SHOP_DESCRIPTION_MAX);
  const status = String(body.status || "draft");
  if (!name || description === null || !["draft", "published", "closed"].includes(status)) return null;
  return { name, description, status };
}

function cleanProduct(body) {
  if (!body || typeof body !== "object") return null;
  if (body.productType !== undefined && body.productType !== "physical") return null;
  const title = boundedText(body.title, PRODUCT_TITLE_MAX, { required: true });
  const description = boundedText(body.description, PRODUCT_DESCRIPTION_MAX);
  const images = safeImageUrls(body);
  const specifics = body.itemSpecifics && typeof body.itemSpecifics === "object" ? body.itemSpecifics : body;
  const medium = boundedText(specifics.medium, PRODUCT_MEDIUM_MAX, { required: true });
  const dimensions = boundedText(specifics.dimensions, PRODUCT_DIMENSIONS_MAX, { required: true });
  const condition = String(specifics.condition || "");
  const yearProvided = specifics.yearCreated !== "" && specifics.yearCreated !== null && specifics.yearCreated !== undefined;
  const yearValue = yearProvided ? positiveInteger(specifics.yearCreated, 1000, new Date().getUTCFullYear() + 1) : null;
  const signatureStatus = boundedText(specifics.signatureStatus, PRODUCT_SIGNATURE_MAX);
  const priceCents = positiveInteger(body.priceCents, 50, MAX_PRODUCT_CENTS);
  const shippingCents = positiveInteger(body.shippingCents ?? 0, 0, MAX_SHIPPING_CENTS);
  const inventory = positiveInteger(body.inventory, 0, MAX_INVENTORY);
  const status = String(body.status || "draft");
  if (!title || description === null || !images || !medium || !dimensions || !PRODUCT_CONDITIONS.has(condition) || (yearProvided && yearValue === null) || signatureStatus === null || priceCents === null || shippingCents === null || inventory === null || !["draft", "published", "sold_out"].includes(status)) return null;
  return { title, description, images, imageUrl: images[0], medium, dimensions, condition, yearCreated: yearValue, signatureStatus, priceCents, shippingCents, inventory, status, productType: "physical", currency: "usd" };
}

function shippingFeeAvoidanceRisk(body) {
  const itemPrice = positiveInteger(body?.priceCents, 50, MAX_PRODUCT_CENTS);
  const shipping = positiveInteger(body?.shippingCents ?? 0, 0, MAX_SHIPPING_CENTS);
  return itemPrice !== null && shipping !== null && shipping >= 1_000 && shipping > itemPrice * 2;
}

function productAttributes(body) {
  return {
    imageUrl: { S: body.imageUrl },
    images: { L: body.images.map(image => ({ S: image })) },
    medium: { S: body.medium },
    dimensions: { S: body.dimensions },
    condition: { S: body.condition },
    ...(body.yearCreated === null ? {} : { yearCreated: { N: String(body.yearCreated) } }),
    ...(body.signatureStatus ? { signatureStatus: { S: body.signatureStatus } } : {})
  };
}

export function marketplaceFeeCents(itemPriceCents) {
  const itemPrice = positiveInteger(itemPriceCents, 0, Number.MAX_SAFE_INTEGER);
  if (itemPrice === null) throw new TypeError("Item price must be integer cents");
  return Math.round(itemPrice * 5 / 100);
}

export function createMarketplace({ db, commands, authenticate, corsHeaders, tableName, env = process.env, clock = Date.now }) {
  const { GetItemCommand, PutItemCommand, QueryCommand } = commands;
  const browserHeaders = event => corsHeaders(event?.headers?.origin || event?.headers?.Origin);
  const nowIso = () => new Date(clock()).toISOString();
  const admins = new Set(String(env.MARKETPLACE_ADMIN_USER_IDS || "").split(",").map(value => value.trim()).filter(Boolean));

  async function userId(event) {
    const value = await authenticate(event);
    return MEMBER_ID.test(String(value || "")) ? String(value) : "";
  }

  async function requireMutation(event) {
    const headers = browserHeaders(event);
    if (!headers?.["access-control-allow-origin"]) return { error: response(403, { error: "Forbidden origin" }, headers) };
    const id = await userId(event);
    if (!id) return { error: response(401, { error: "Authentication required." }, headers) };
    return { headers, id };
  }

  async function records(ownerId) {
    const [shopResult, productResult] = await Promise.all([
      db.send(new GetItemCommand({ TableName: tableName, Key: shopKey(ownerId), ConsistentRead: true })),
      db.send(new QueryCommand({ TableName: tableName, KeyConditionExpression: "pk = :pk AND begins_with(sk, :product)", ExpressionAttributeValues: { ":pk": { S: ownerKey(ownerId) }, ":product": { S: "PRODUCT#" } }, ConsistentRead: true, Limit: 250 }))
    ]);
    return { shop: shopResult.Item, products: productResult.Items || [] };
  }

  async function readShop(event, requestedOwner = "") {
    const headers = browserHeaders(event);
    const signedIn = await userId(event);
    const ownerId = requestedOwner || signedIn;
    if (!ownerId || (ownerId !== OFFICIAL_OWNER && !MEMBER_ID.test(ownerId))) return response(400, { error: "Valid shop owner required." }, headers);
    const own = ownerId !== OFFICIAL_OWNER && signedIn === ownerId;
    const { shop, products } = await records(ownerId);
    if (!shop || (!own && shop.status?.S !== "published")) return response(404, { error: "Shop not found." }, headers);
    const visible = own ? products : products.filter(item => item.status?.S === "published");
    return response(200, { shop: shopView(shop, visible, own) }, headers);
  }

  async function readBazaar(event) {
    const headers = browserHeaders(event);
    const requestedLimit = positiveInteger(event?.queryStringParameters?.limit ?? BAZAAR_PAGE_SIZE, 1, BAZAAR_PAGE_MAX) || BAZAAR_PAGE_SIZE;
    const cursorText = event?.queryStringParameters?.cursor;
    const exclusiveStartKey = cursorText ? decodeBazaarCursor(cursorText) : undefined;
    if (cursorText && !exclusiveStartKey) return response(400, { error: "The Bazaar page link is invalid. Start again from the Bazaar." }, headers);
    const result = await db.send(new QueryCommand({
      TableName: tableName,
      IndexName: "BazaarIndex",
      KeyConditionExpression: "bazaarPk = :bazaar",
      ExpressionAttributeValues: { ":bazaar": { S: BAZAAR_PARTITION } },
      ScanIndexForward: false,
      Limit: requestedLimit,
      ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {})
    }));
    const candidates = (result.Items || []).filter(item => item.ownerId?.S && item.ownerId.S !== OFFICIAL_OWNER && item.status?.S === "published" && number(item, "inventory") > 0);
    const ownerIds = [...new Set(candidates.map(item => item.ownerId.S))];
    const shops = new Map((await Promise.all(ownerIds.map(async ownerId => {
      const shop = await db.send(new GetItemCommand({ TableName: tableName, Key: shopKey(ownerId), ConsistentRead: true }));
      return [ownerId, shop.Item];
    }))).filter(([, shop]) => shop?.status?.S === "published"));
    const listings = candidates.flatMap(item => {
      const shop = shops.get(item.ownerId.S);
      if (!shop) return [];
      return [{
        ...productView(item, false),
        memberId: item.ownerId.S,
        shopName: shop.name?.S || "Member shop"
      }];
    });
    return response(200, {
      listings,
      nextCursor: encodeBazaarCursor(result.LastEvaluatedKey)
    }, headers);
  }

  async function saveShop(event) {
    const access = await requireMutation(event);
    if (access.error) return access.error;
    const body = cleanShop(parseBody(event));
    if (!body) return response(400, { error: `Shop name is required and must be at most ${SHOP_NAME_MAX} characters.` }, access.headers);
    const key = shopKey(access.id);
    const existing = await db.send(new GetItemCommand({ TableName: tableName, Key: key, ConsistentRead: true }));
    const at = nowIso(), revision = number(existing.Item, "revision") + 1;
    const item = { ...key, entityType: { S: "shop" }, ownerId: { S: access.id }, name: { S: body.name }, description: { S: body.description }, status: { S: body.status }, revision: { N: String(revision) }, createdAt: existing.Item?.createdAt || { S: at }, updatedAt: { S: at } };
    await db.send(new PutItemCommand({ TableName: tableName, Item: item }));
    return response(existing.Item ? 200 : 201, { shop: shopView(item, [], true) }, access.headers);
  }

  async function saveOfficialStore(event) {
    const access = await requireMutation(event);
    if (access.error) return access.error;
    if (!admins.has(access.id)) return response(403, { error: "Official Store access required." }, access.headers);
    const request = parseBody(event);
    const description = boundedText(request?.description, SHOP_DESCRIPTION_MAX);
    const status = String(request?.status || "draft");
    if (description === null || !["draft", "published", "closed"].includes(status)) {
      return response(400, { error: "Enter a valid store description and status." }, access.headers);
    }
    const key = shopKey(OFFICIAL_OWNER);
    const existing = await db.send(new GetItemCommand({ TableName: tableName, Key: key, ConsistentRead: true }));
    const at = nowIso(), revision = number(existing.Item, "revision") + 1;
    const item = {
      ...key,
      entityType: { S: "shop" },
      ownerId: { S: OFFICIAL_OWNER },
      name: { S: "DanzStak Official Store" },
      description: { S: description },
      status: { S: status },
      revision: { N: String(revision) },
      createdAt: existing.Item?.createdAt || { S: at },
      updatedAt: { S: at }
    };
    await db.send(new PutItemCommand({ TableName: tableName, Item: item }));
    return response(existing.Item ? 200 : 201, { shop: shopView(item, [], true) }, access.headers);
  }

  async function createProduct(event, ownerId = "") {
    const access = await requireMutation(event);
    if (access.error) return access.error;
    const target = ownerId || access.id;
    if (target === OFFICIAL_OWNER && !admins.has(access.id)) return response(403, { error: "Official Store access required." }, access.headers);
    if (target !== OFFICIAL_OWNER && target !== access.id) return response(403, { error: "You can manage only your own shop." }, access.headers);
    const shop = await db.send(new GetItemCommand({ TableName: tableName, Key: shopKey(target), ConsistentRead: true }));
    if (!shop.Item) return response(409, { error: "Open the shop before adding products." }, access.headers);
    const request = parseBody(event);
    if (shippingFeeAvoidanceRisk(request)) return response(422, { error: "Shipping is unusually high compared with the item price. Use the actual shipping cost and a realistic item price before publishing." }, access.headers);
    const body = cleanProduct(request);
    if (!body) return response(400, { error: `Enter a valid physical product, 1-${MAX_PRODUCT_IMAGES} HTTPS images, item specifics, integer-cent price and inventory.` }, access.headers);
    const id = randomUUID(), at = nowIso(), item = { ...productKey(target, id), entityType: { S: "product" }, ownerId: { S: target }, productId: { S: id }, title: { S: body.title }, description: { S: body.description }, ...productAttributes(body), productType: { S: body.productType }, priceCents: { N: String(body.priceCents) }, shippingCents: { N: String(body.shippingCents) }, inventory: { N: String(body.inventory) }, currency: { S: body.currency }, status: { S: body.status }, revision: { N: "1" }, createdAt: { S: at }, updatedAt: { S: at }, ...bazaarFields(target, id, body, at) };
    try {
      await db.send(new PutItemCommand({ TableName: tableName, Item: item, ConditionExpression: "attribute_not_exists(pk)" }));
    } catch (error) {
      if (error?.name === "ConditionalCheckFailedException") return response(409, { error: "Product could not be created. Try again." }, access.headers);
      throw error;
    }
    return response(201, { product: productView(item, true) }, access.headers);
  }

  async function updateProduct(event, productId, ownerId = "") {
    const access = await requireMutation(event);
    if (access.error) return access.error;
    if (!PRODUCT_ID.test(productId)) return response(400, { error: "Valid product required." }, access.headers);
    const target = ownerId || access.id;
    if (target === OFFICIAL_OWNER && !admins.has(access.id)) return response(403, { error: "Official Store access required." }, access.headers);
    if (target !== OFFICIAL_OWNER && target !== access.id) return response(403, { error: "You can manage only your own shop." }, access.headers);
    const key = productKey(target, productId), existing = await db.send(new GetItemCommand({ TableName: tableName, Key: key, ConsistentRead: true }));
    if (!existing.Item) return response(404, { error: "Product not found." }, access.headers);
    const request = parseBody(event);
    if (shippingFeeAvoidanceRisk(request)) return response(422, { error: "Shipping is unusually high compared with the item price. Use the actual shipping cost and a realistic item price before publishing." }, access.headers);
    const body = cleanProduct(request), expectedRevision = positiveInteger(request?.revision, 1, Number.MAX_SAFE_INTEGER);
    if (!body || expectedRevision === null) return response(400, { error: "Valid product fields, images, item specifics and revision are required." }, access.headers);
    if (number(existing.Item, "revision") !== expectedRevision) return response(409, { error: "This product changed on another device. Reload it before saving." }, access.headers);
    const updatedAt = nowIso();
    const item = { ...withoutMutableOptionalFields(existing.Item), title: { S: body.title }, description: { S: body.description }, ...productAttributes(body), priceCents: { N: String(body.priceCents) }, shippingCents: { N: String(body.shippingCents) }, inventory: { N: String(body.inventory) }, status: { S: body.status }, revision: { N: String(expectedRevision + 1) }, updatedAt: { S: updatedAt }, ...bazaarFields(target, productId, body, updatedAt) };
    try {
      await db.send(new PutItemCommand({ TableName: tableName, Item: item, ConditionExpression: "revision = :revision", ExpressionAttributeValues: { ":revision": { N: String(expectedRevision) } } }));
    } catch (error) {
      if (error?.name === "ConditionalCheckFailedException") return response(409, { error: "This product changed on another device. Reload it before saving." }, access.headers);
      throw error;
    }
    return response(200, { product: productView(item, true) }, access.headers);
  }

  async function archiveProduct(event, productId, ownerId = "") {
    const access = await requireMutation(event);
    if (access.error) return access.error;
    if (!PRODUCT_ID.test(productId)) return response(400, { error: "Valid product required." }, access.headers);
    const target = ownerId || access.id;
    if (target === OFFICIAL_OWNER && !admins.has(access.id)) return response(403, { error: "Official Store access required." }, access.headers);
    if (target !== OFFICIAL_OWNER && target !== access.id) return response(403, { error: "You can manage only your own shop." }, access.headers);
    const key = productKey(target, productId), existing = await db.send(new GetItemCommand({ TableName: tableName, Key: key, ConsistentRead: true }));
    if (!existing.Item) return response(404, { error: "Product not found." }, access.headers);
    const item = { ...withoutBazaarFields(existing.Item), status: { S: "archived" }, revision: { N: String(number(existing.Item, "revision") + 1) }, updatedAt: { S: nowIso() } };
    await db.send(new PutItemCommand({ TableName: tableName, Item: item, ConditionExpression: "attribute_exists(pk)" }));
    return response(200, { archived: true, productId }, access.headers);
  }

  return async function marketplace(event) {
    const method = event?.requestContext?.http?.method || "";
    const path = event?.rawPath || "";
    if (method === "GET" && path === "/marketplace/bazaar") return readBazaar(event);
    if (method === "GET" && path === "/marketplace/store") return readShop(event, OFFICIAL_OWNER);
    if (method === "PUT" && path === "/marketplace/store") return saveOfficialStore(event);
    if (method === "GET" && path === "/marketplace/shop") return readShop(event);
    if (method === "PUT" && path === "/marketplace/shop") return saveShop(event);
    const publicShop = path.match(/^\/marketplace\/shop\/([A-Za-z0-9_-]{8,128})$/);
    if (method === "GET" && publicShop) return readShop(event, publicShop[1]);
    if (method === "POST" && path === "/marketplace/products") return createProduct(event);
    const product = path.match(/^\/marketplace\/products\/([a-f0-9-]{36})$/i);
    if (method === "PATCH" && product) return updateProduct(event, product[1]);
    if (method === "DELETE" && product) return archiveProduct(event, product[1]);
    if (method === "POST" && path === "/marketplace/store/products") return createProduct(event, OFFICIAL_OWNER);
    const officialProduct = path.match(/^\/marketplace\/store\/products\/([a-f0-9-]{36})$/i);
    if (method === "PATCH" && officialProduct) return updateProduct(event, officialProduct[1], OFFICIAL_OWNER);
    if (method === "DELETE" && officialProduct) return archiveProduct(event, officialProduct[1], OFFICIAL_OWNER);
    return null;
  };
}

export { cleanShop, cleanProduct, shopKey, productKey, productView, shopView, bazaarFields, encodeBazaarCursor, decodeBazaarCursor, shippingFeeAvoidanceRisk };
