// Queue 5a2 (owner 2026-11-18): named photo and video albums on the profile Photos and Videos tabs
// ("Hellfest 2026", "Mike & Ana's wedding", a concert date…). Members create albums, upload many photos and videos
// at once into one, rename them, choose who sees them (Public / Friends / Only me) and delete them.
// Never music files: albums hold the same image and video uploads as posts (users/<owner prefix>/<uuid>.<ext> keys
// from the existing upload ticket), never audio.
//
// Records live in the tours table in their own partition, so a member's tour list never sees them:
//   ALBUMS#<memberId> / ALBUM#<albumId>                         the album (name, date, place, visibility, counts, cover)
//   ALBUMS#<memberId> / ITEM#<albumId>#<createdAt>#<itemId>     one photo or video in it
import { randomUUID } from "node:crypto";

export const MAX_ALBUMS = 100;
export const MAX_ITEMS_PER_ALBUM = 2000;
export const MAX_ITEMS_PER_REQUEST = 50;
export const VISIBILITY = ["public", "friends", "private"];
const PARTITION = "ALBUMS#";
const MEMBER = /^[a-f0-9-]{36}$/;
const ALBUM_ID = /^[a-f0-9]{32}$/;
const ITEM_ID = /^[a-f0-9]{32}$/;
const MEDIA = /^users\/([a-f0-9]{24})\/[a-f0-9-]{36}\.(jpg|png|webp|gif|mp4|webm|mov)$/;
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov"]);

const text = (value, max) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

// What a member typed for an album: a name (required), an optional date and place, and who can see it.
export function cleanAlbum(input = {}, { partial = false } = {}) {
  const out = {};
  if (!partial || input.name !== undefined) {
    const name = text(input.name, 80);
    if (!name) return { error: "Give the album a name." };
    out.name = name;
  }
  if (!partial || input.date !== undefined) {
    const date = String(input.date ?? "").trim();
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Use a date like 2026-06-21." };
    out.date = date;
  }
  if (!partial || input.place !== undefined) out.place = text(input.place, 120);
  if (!partial || input.visibility !== undefined) {
    const visibility = String(input.visibility ?? "friends");
    if (!VISIBILITY.includes(visibility)) return { error: "Choose Public, Friends or Only me." };
    out.visibility = visibility;
  }
  return { album: out };
}

// An uploaded file may join an album only if it is the owner's own image or video upload.
export function cleanItem(raw, ownerPrefix) {
  const mediaKey = String(raw?.mediaKey || ""), match = mediaKey.match(MEDIA);
  if (!match || match[1] !== ownerPrefix) return null;
  const mediaType = VIDEO_EXTENSIONS.has(match[2]) ? "video" : "image";
  if (raw?.mediaType && raw.mediaType !== mediaType) return null;
  return { mediaKey, mediaType };
}

// Who may see an album: the owner always; otherwise Public to any signed-in member, Friends to accepted friends,
// Only me to nobody else. Blocked pairs see nothing.
export function canSee(visibility, { isOwner, friends, blocked }) {
  if (isOwner) return true;
  if (blocked) return false;
  return visibility === "public" || (visibility === "friends" && friends);
}

const attr = (item, name) => item?.[name]?.S || "";
const num = (item, name) => Number(item?.[name]?.N || 0);

export function createAlbums({ db, commands, tableName, authenticate, accountEmail, mediaPrefix, signedUrl, deleteMedia, relationship, corsHeaders, originAllowed, clock = Date.now, newId = () => randomUUID().replace(/-/g, "") }) {
  const { GetItemCommand, PutItemCommand, QueryCommand, UpdateItemCommand, DeleteItemCommand, TransactWriteItemsCommand } = commands;
  const nowIso = () => new Date(clock()).toISOString();
  const albumKey = (ownerId, albumId) => ({ userId: { S: `${PARTITION}${ownerId}` }, tourId: { S: `ALBUM#${albumId}` } });
  const query = async (ownerId, prefix, limit = 5000) => {
    const items = [];
    let ExclusiveStartKey;
    do {
      const page = await db.send(new QueryCommand({ TableName: tableName, KeyConditionExpression: "userId = :p AND begins_with(tourId, :prefix)", ExpressionAttributeValues: { ":p": { S: `${PARTITION}${ownerId}` }, ":prefix": { S: prefix } }, ConsistentRead: true, ExclusiveStartKey }));
      items.push(...(page.Items || []));
      ExclusiveStartKey = page.LastEvaluatedKey;
    } while (ExclusiveStartKey && items.length < limit);
    return items.slice(0, limit);
  };
  const albumView = (item, withCover = true) => ({
    albumId: attr(item, "albumId"), name: attr(item, "name"), date: attr(item, "date"), place: attr(item, "place"),
    visibility: attr(item, "visibility") || "friends", photoCount: num(item, "photoCount"), videoCount: num(item, "videoCount"),
    cover: withCover && attr(item, "coverKey") ? { url: signedUrl(attr(item, "coverKey"), 3600), mediaType: attr(item, "coverType") || "image" } : null,
    createdAt: attr(item, "createdAt"), updatedAt: attr(item, "updatedAt")
  });
  const itemView = item => ({ itemId: attr(item, "itemId"), mediaType: attr(item, "mediaType"), url: signedUrl(attr(item, "mediaKey"), 3600), createdAt: attr(item, "createdAt") });

  // Resolves whose albums are asked for and what this viewer may see.
  async function audience(userId, member) {
    const ownerId = member && member !== userId ? member : userId;
    if (!MEMBER.test(ownerId) && ownerId !== userId) return { error: [400, "Valid member required."] };
    if (ownerId === userId) return { ownerId, isOwner: true, rules: { isOwner: true } };
    const [viewerEmail, ownerEmail] = await Promise.all([accountEmail(userId), accountEmail(ownerId)]);
    if (!ownerEmail) return { error: [404, "Member not found."] };
    const status = viewerEmail ? await relationship(viewerEmail, ownerEmail) : "";
    return { ownerId, isOwner: false, rules: { isOwner: false, friends: status === "friends", blocked: /^blocked/.test(status || "") } };
  }

  const routes = {
    // GET /albums[?member=][&kind=image|video][&full=1 owner export]
    async list({ userId, event }) {
      const params = event.queryStringParameters || {}, who = await audience(userId, String(params.member || "").toLowerCase());
      if (who.error) return who.error;
      const kind = ["image", "video"].includes(params.kind) ? params.kind : "";
      const albums = (await query(who.ownerId, "ALBUM#", MAX_ALBUMS)).filter(item => canSee(attr(item, "visibility"), who.rules)).map(item => albumView(item));
      const shown = kind ? albums.filter(album => (kind === "image" ? album.photoCount : album.videoCount) > 0 || (who.isOwner && !album.photoCount && !album.videoCount)) : albums;
      shown.sort((a, b) => (b.date || b.createdAt).localeCompare(a.date || a.createdAt));
      if (params.full === "1" && who.isOwner) {
        // Account export: album details plus which uploads are in each (media files themselves are not in the archive).
        const items = await query(who.ownerId, "ITEM#");
        return [200, { albums: shown.map(album => ({ ...album, cover: null, items: items.filter(item => attr(item, "albumId") === album.albumId).map(item => ({ itemId: attr(item, "itemId"), mediaType: attr(item, "mediaType"), mediaKey: attr(item, "mediaKey"), createdAt: attr(item, "createdAt") })) })) }];
      }
      return [200, { isOwner: who.isOwner, albums: shown }];
    },
    // GET /albums/{albumId}[?member=]
    async get({ userId, event, albumId }) {
      const who = await audience(userId, String(event.queryStringParameters?.member || "").toLowerCase());
      if (who.error) return who.error;
      const album = (await db.send(new GetItemCommand({ TableName: tableName, Key: albumKey(who.ownerId, albumId), ConsistentRead: true }))).Item;
      if (!album || !canSee(attr(album, "visibility"), who.rules)) return [404, "Album not found."];
      const items = (await query(who.ownerId, `ITEM#${albumId}#`, MAX_ITEMS_PER_ALBUM)).map(itemView).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return [200, { isOwner: who.isOwner, album: albumView(album), items }];
    },
    // POST /albums {name, date, place, visibility}
    async create({ userId, body }) {
      const cleaned = cleanAlbum(body);
      if (cleaned.error) return [400, cleaned.error];
      if ((await query(userId, "ALBUM#", MAX_ALBUMS + 1)).length >= MAX_ALBUMS) return [409, `You have ${MAX_ALBUMS} albums. Delete one to make another.`];
      const albumId = newId(), at = nowIso(), a = cleaned.album;
      await db.send(new PutItemCommand({ TableName: tableName, Item: { ...albumKey(userId, albumId), albumId: { S: albumId }, name: { S: a.name }, date: { S: a.date }, place: { S: a.place }, visibility: { S: a.visibility }, photoCount: { N: "0" }, videoCount: { N: "0" }, createdAt: { S: at }, updatedAt: { S: at } }, ConditionExpression: "attribute_not_exists(userId)" }));
      return [201, { album: { albumId, ...a, photoCount: 0, videoCount: 0, cover: null, createdAt: at, updatedAt: at } }];
    },
    // PATCH /albums/{albumId} {name?, date?, place?, visibility?, coverItemId?}
    async update({ userId, body, albumId }) {
      const cleaned = cleanAlbum(body, { partial: true });
      if (cleaned.error) return [400, cleaned.error];
      const sets = ["updatedAt = :at"], values = { ":at": { S: nowIso() } }, names = {};
      for (const [field, value] of Object.entries(cleaned.album)) { sets.push(`#${field} = :${field}`); names[`#${field}`] = field; values[`:${field}`] = { S: value }; }
      if (body.coverItemId !== undefined) {
        const items = await query(userId, `ITEM#${albumId}#`, MAX_ITEMS_PER_ALBUM), cover = items.find(item => attr(item, "itemId") === String(body.coverItemId));
        if (!cover) return [404, "That photo is not in this album."];
        sets.push("coverKey = :coverKey", "coverType = :coverType");
        values[":coverKey"] = { S: attr(cover, "mediaKey") }; values[":coverType"] = { S: attr(cover, "mediaType") };
      }
      try {
        await db.send(new UpdateItemCommand({ TableName: tableName, Key: albumKey(userId, albumId), UpdateExpression: `SET ${sets.join(", ")}`, ConditionExpression: "attribute_exists(userId)", ...(Object.keys(names).length ? { ExpressionAttributeNames: names } : {}), ExpressionAttributeValues: values }));
      } catch (error) { if (error.name === "ConditionalCheckFailedException") return [404, "Album not found."]; throw error; }
      return routes.get({ userId, event: { queryStringParameters: {} }, albumId });
    },
    // POST /albums/{albumId}/items {items:[{mediaKey, mediaType}]}: files already uploaded with the post upload ticket.
    async addItems({ userId, body, albumId }) {
      const prefix = await mediaPrefix(userId), raw = Array.isArray(body.items) ? body.items : [];
      if (!raw.length || raw.length > MAX_ITEMS_PER_REQUEST) return [400, `Add 1 to ${MAX_ITEMS_PER_REQUEST} photos or videos at a time.`];
      const items = raw.map(entry => cleanItem(entry, prefix));
      if (items.some(item => !item)) return [400, "Only your own photo and video uploads can go in an album. Music files never can."];
      const album = (await db.send(new GetItemCommand({ TableName: tableName, Key: albumKey(userId, albumId), ConsistentRead: true }))).Item;
      if (!album) return [404, "Album not found."];
      if (num(album, "photoCount") + num(album, "videoCount") + items.length > MAX_ITEMS_PER_ALBUM) return [409, `An album holds up to ${MAX_ITEMS_PER_ALBUM} photos and videos.`];
      const at = nowIso(), added = items.map((item, index) => ({ ...item, itemId: newId(), createdAt: new Date(clock() + index).toISOString() }));
      for (let offset = 0; offset < added.length; offset += 24) {
        const batch = added.slice(offset, offset + 24), photos = batch.filter(item => item.mediaType === "image").length, videos = batch.length - photos, first = batch[0];
        await db.send(new TransactWriteItemsCommand({ TransactItems: [
          ...batch.map(item => ({ Put: { TableName: tableName, Item: { userId: { S: `${PARTITION}${userId}` }, tourId: { S: `ITEM#${albumId}#${item.createdAt}#${item.itemId}` }, albumId: { S: albumId }, itemId: { S: item.itemId }, mediaKey: { S: item.mediaKey }, mediaType: { S: item.mediaType }, createdAt: { S: item.createdAt } }, ConditionExpression: "attribute_not_exists(userId)" } })),
          { Update: { TableName: tableName, Key: albumKey(userId, albumId), UpdateExpression: "ADD photoCount :photos, videoCount :videos SET updatedAt = :at, coverKey = if_not_exists(coverKey, :coverKey), coverType = if_not_exists(coverType, :coverType)", ConditionExpression: "attribute_exists(userId)", ExpressionAttributeValues: { ":photos": { N: String(photos) }, ":videos": { N: String(videos) }, ":at": { S: at }, ":coverKey": { S: first.mediaKey }, ":coverType": { S: first.mediaType } } } }
        ] }));
      }
      return [200, { added: added.map(item => ({ itemId: item.itemId, mediaType: item.mediaType, url: signedUrl(item.mediaKey, 3600), createdAt: item.createdAt })) }];
    },
    // DELETE /albums/{albumId}/items/{itemId}: the file leaves DanzStak's storage too (Delete everywhere).
    async removeItem({ userId, albumId, itemId }) {
      const item = (await query(userId, `ITEM#${albumId}#`, MAX_ITEMS_PER_ALBUM)).find(entry => attr(entry, "itemId") === itemId);
      if (!item) return [404, "That photo or video is not in this album."];
      if (!await deleteMedia([attr(item, "mediaKey")])) return [503, "The file could not be removed yet. Try again."];
      const album = (await db.send(new GetItemCommand({ TableName: tableName, Key: albumKey(userId, albumId), ConsistentRead: true }))).Item, wasCover = attr(album, "coverKey") === attr(item, "mediaKey");
      await db.send(new TransactWriteItemsCommand({ TransactItems: [
        { Delete: { TableName: tableName, Key: { userId: item.userId, tourId: item.tourId } } },
        { Update: { TableName: tableName, Key: albumKey(userId, albumId), UpdateExpression: `ADD ${attr(item, "mediaType") === "video" ? "videoCount" : "photoCount"} :minus SET updatedAt = :at${wasCover ? " REMOVE coverKey, coverType" : ""}`, ExpressionAttributeValues: { ":minus": { N: "-1" }, ":at": { S: nowIso() } } } }
      ] }));
      return [200, { removed: true, itemId }];
    },
    // DELETE /albums/{albumId}: every photo and video in it leaves DanzStak's storage first, then the records go.
    async remove({ userId, albumId }) {
      const album = (await db.send(new GetItemCommand({ TableName: tableName, Key: albumKey(userId, albumId), ConsistentRead: true }))).Item;
      if (!album) return [404, "Album not found."];
      const items = await query(userId, `ITEM#${albumId}#`, MAX_ITEMS_PER_ALBUM);
      if (items.length && !await deleteMedia(items.map(item => attr(item, "mediaKey")))) return [503, "Some files could not be removed yet. Nothing was deleted; try again."];
      for (let offset = 0; offset < items.length; offset += 25) await db.send(new TransactWriteItemsCommand({ TransactItems: items.slice(offset, offset + 25).map(item => ({ Delete: { TableName: tableName, Key: { userId: item.userId, tourId: item.tourId } } })) }));
      await db.send(new DeleteItemCommand({ TableName: tableName, Key: albumKey(userId, albumId) }));
      return [200, { deleted: true, albumId, files: items.length }];
    }
  };

  // Returns a Lambda response for /albums routes, or null for any other path.
  async function handle(event, method, path) {
    const parts = path.split("/").filter(Boolean);
    if (parts[0] !== "albums" || parts.length > 4) return null;
    const albumId = parts[1] || "", itemId = parts[3] || "";
    let route = "";
    if (parts.length === 1) route = method === "GET" ? "list" : method === "POST" ? "create" : "";
    else if (parts.length === 2) route = { GET: "get", PATCH: "update", DELETE: "remove" }[method] || "";
    else if (parts.length === 3 && parts[2] === "items" && method === "POST") route = "addItems";
    else if (parts.length === 4 && parts[2] === "items" && method === "DELETE") route = "removeItem";
    if (!route) return null;
    const origin = event.headers?.origin || event.headers?.Origin, headers = { ...corsHeaders(origin), "cache-control": "no-store, private" };
    const reply = (statusCode, data) => ({ statusCode, headers, body: JSON.stringify(data) });
    if (!originAllowed(origin)) return reply(403, { error: "Forbidden origin" });
    if (albumId && !ALBUM_ID.test(albumId)) return reply(404, { error: "Album not found." });
    if (itemId && !ITEM_ID.test(itemId)) return reply(404, { error: "That photo or video is not in this album." });
    const userId = await authenticate(event);
    if (!userId) return reply(401, { error: "Authentication required." });
    let body = {};
    if (["POST", "PATCH"].includes(method)) { try { body = JSON.parse(event.body || "{}") || {}; } catch { return reply(400, { error: "Invalid JSON" }); } }
    const [statusCode, data] = await routes[route]({ userId, event, body, albumId, itemId });
    return reply(statusCode, typeof data === "string" ? { error: data } : data);
  }

  return { handle, routes };
}
