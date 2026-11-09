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
const MAX_PRODUCT_CENTS = 5_000_000;
const MAX_SHIPPING_CENTS = 250_000;
const MAX_INVENTORY = 99_999;
const OFFICIAL_OWNER = "official";
const PRODUCT_ID = /^[a-f0-9-]{36}$/i;
const MEMBER_ID = /^[A-Za-z0-9_-]{8,128}$/;

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
    name: item.name?.S || (item.ownerId?.S === OFFICIAL_OWNER ? "DanzStak Store" : "Shop"),
    description: item.description?.S || "",
    status: item.status?.S || "draft",
    createdAt: item.createdAt?.S || "",
    updatedAt: item.updatedAt?.S || "",
    revision: own ? number(item, "revision") : undefined,
    products: products.map(product => productView(product, own))
  };
}

function productView(item, own) {
  const result = {
    id: String(item.sk?.S || "").replace(/^PRODUCT#/, ""),
    title: item.title?.S || "Product",
    description: item.description?.S || "",
    imageUrl: item.imageUrl?.S || "",
    productType: item.productType?.S || "physical",
    priceCents: number(item, "priceCents"),
    shippingCents: number(item, "shippingCents"),
    currency: item.currency?.S || "usd",
    available: number(item, "inventory") > 0 && item.status?.S === "published",
    createdAt: item.createdAt?.S || "",
    updatedAt: item.updatedAt?.S || ""
  };
  if (own) Object.assign(result, { inventory: number(item, "inventory"), status: item.status?.S || "draft", revision: number(item, "revision") });
  return result;
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
  const imageUrl = safeImageUrl(body.imageUrl);
  const priceCents = positiveInteger(body.priceCents, 50, MAX_PRODUCT_CENTS);
  const shippingCents = positiveInteger(body.shippingCents ?? 0, 0, MAX_SHIPPING_CENTS);
  const inventory = positiveInteger(body.inventory, 0, MAX_INVENTORY);
  const status = String(body.status || "draft");
  if (!title || description === null || imageUrl === null || priceCents === null || shippingCents === null || inventory === null || !["draft", "published", "sold_out"].includes(status)) return null;
  return { title, description, imageUrl, priceCents, shippingCents, inventory, status, productType: "physical", currency: "usd" };
}

export function marketplaceFeeCents(subtotalCents) {
  const subtotal = positiveInteger(subtotalCents, 0, Number.MAX_SAFE_INTEGER);
  if (subtotal === null) throw new TypeError("Subtotal must be integer cents");
  return Math.round(subtotal * 5 / 100);
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
      name: { S: "DanzStak Store" },
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
    const body = cleanProduct(parseBody(event));
    if (!body) return response(400, { error: "Enter a valid physical product, integer-cent price, inventory and HTTPS image." }, access.headers);
    const id = randomUUID(), at = nowIso(), item = { ...productKey(target, id), entityType: { S: "product" }, ownerId: { S: target }, productId: { S: id }, title: { S: body.title }, description: { S: body.description }, imageUrl: { S: body.imageUrl }, productType: { S: body.productType }, priceCents: { N: String(body.priceCents) }, shippingCents: { N: String(body.shippingCents) }, inventory: { N: String(body.inventory) }, currency: { S: body.currency }, status: { S: body.status }, revision: { N: "1" }, createdAt: { S: at }, updatedAt: { S: at } };
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
    const request = parseBody(event), body = cleanProduct(request), expectedRevision = positiveInteger(request?.revision, 1, Number.MAX_SAFE_INTEGER);
    if (!body || expectedRevision === null) return response(400, { error: "Valid product fields and revision are required." }, access.headers);
    if (number(existing.Item, "revision") !== expectedRevision) return response(409, { error: "This product changed on another device. Reload it before saving." }, access.headers);
    const item = { ...existing.Item, title: { S: body.title }, description: { S: body.description }, imageUrl: { S: body.imageUrl }, priceCents: { N: String(body.priceCents) }, shippingCents: { N: String(body.shippingCents) }, inventory: { N: String(body.inventory) }, status: { S: body.status }, revision: { N: String(expectedRevision + 1) }, updatedAt: { S: nowIso() } };
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
    const item = { ...existing.Item, status: { S: "archived" }, revision: { N: String(number(existing.Item, "revision") + 1) }, updatedAt: { S: nowIso() } };
    await db.send(new PutItemCommand({ TableName: tableName, Item: item, ConditionExpression: "attribute_exists(pk)" }));
    return response(200, { archived: true, productId }, access.headers);
  }

  return async function marketplace(event) {
    const method = event?.requestContext?.http?.method || "";
    const path = event?.rawPath || "";
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

export { cleanShop, cleanProduct, shopKey, productKey, productView, shopView };
