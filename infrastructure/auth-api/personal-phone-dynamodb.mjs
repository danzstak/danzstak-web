const accountKey = userId => ({ recordKey: { S: `ACCOUNT#${userId}` } });
const claimKey = phoneHash => ({ recordKey: { S: `PHONE#${phoneHash}` } });
// One verified number may be linked to up to 10 DanzStak accounts (owner 2026-11-17: one person, several artist accounts).
// PHONE#<hash> holds the linked account ids as a string set; each account keeps its own ACCOUNT#<id> record with the
// owner-only masked last four. Legacy claims (before 2026-11-17) hold one userId and convert on their next change.
export const MAX_ACCOUNTS_PER_NUMBER = 10;
const claimRoom = "attribute_not_exists(accounts) OR contains(accounts, :me) OR size(accounts) < :maximum";
function claimMembers(item) {
  if (item?.accounts?.SS?.length) return item.accounts.SS;
  return item?.userId?.S && item?.status?.S === "verified" ? [item.userId.S] : [];
}
export function linkClaimOperation(tableName, phoneHash, userId, item) {
  const add = [...new Set([userId, ...(item?.accounts ? [] : claimMembers(item))])];
  return { Update: { TableName:tableName, Key:claimKey(phoneHash), UpdateExpression:"SET recordType = :claim ADD accounts :add REMOVE #ttl, challengeId, #status, userId", ConditionExpression:claimRoom, ExpressionAttributeNames:{"#ttl":"ttl","#status":"status"}, ExpressionAttributeValues:{":claim":{S:"phone_claim"},":add":{SS:add},":me":{S:userId},":maximum":{N:String(MAX_ACCOUNTS_PER_NUMBER)}} } };
}
export function unlinkClaimOperation(tableName, phoneHash, userId, item) {
  if (item?.accounts?.SS?.includes(userId)) return { Update: { TableName:tableName, Key:claimKey(phoneHash), UpdateExpression:"DELETE accounts :me", ExpressionAttributeValues:{":me":{SS:[userId]}} } };
  if (!item?.accounts && item?.userId?.S === userId) return { Delete: { TableName:tableName, Key:claimKey(phoneHash), ConditionExpression:"userId = :me AND attribute_not_exists(accounts)", ExpressionAttributeValues:{":me":{S:userId}} } };
  return null;
}
const value = (item, name, fallback = "") => item?.[name]?.S ?? (item?.[name]?.N !== undefined ? Number(item[name].N) : fallback);

function recordFromItem(item) {
  if (!item) return null;
  return Object.fromEntries([
    ["userId", value(item, "userId")], ["phoneHash", value(item, "phoneHash")], ["challengeId", value(item, "challengeId")],
    ["challengeHash", value(item, "challengeHash")], ["status", value(item, "status")], ["createdAt", value(item, "createdAt")],
    ["verifiedAt", value(item, "verifiedAt")], ["expiresAt", value(item, "expiresAt", 0)], ["resendAfter", value(item, "resendAfter", 0)],
    ["attempts", value(item, "attempts", 0)], ["maskedNumber", value(item, "maskedNumber")], ["purpose", value(item, "purpose", "account_trust")],
    ["deviceChallengeId", value(item, "deviceChallengeId")], ["deviceChallengeHash", value(item, "deviceChallengeHash")], ["previousPhoneHash", value(item, "previousPhoneHash")],
    ["previousMaskedNumber", value(item, "previousMaskedNumber")], ["previousVerifiedAt", value(item, "previousVerifiedAt")], ["verificationSid", value(item, "verificationSid")], ["sendWindowStart", value(item, "sendWindowStart", 0)], ["sendsInWindow", value(item, "sendsInWindow", 0)]
  ]);
}

function accountItem(record) {
  const item = { ...accountKey(record.userId), recordType:{S:"account"}, userId:{S:record.userId}, phoneHash:{S:record.phoneHash}, challengeId:{S:record.challengeId}, challengeHash:{S:record.challengeHash}, status:{S:"pending"}, createdAt:{S:record.createdAt}, expiresAt:{N:String(record.expiresAt)}, ttl:{N:String(record.expiresAt + 86400)}, resendAfter:{N:String(record.resendAfter)}, attempts:{N:"0"}, maskedNumber:{S:record.maskedNumber} };
  if (record.previousPhoneHash) item.previousPhoneHash = { S: record.previousPhoneHash };
  if (record.previousMaskedNumber) item.previousMaskedNumber = { S: record.previousMaskedNumber };
  if (record.previousVerifiedAt) item.previousVerifiedAt = { S: record.previousVerifiedAt };
  if (record.purpose) item.purpose = { S: record.purpose };
  // One resend: the first send of a 10-minute window and how many texts it has used (rule 11, owner 2026-11-17).
  if (record.sendWindowStart) item.sendWindowStart = { N: String(record.sendWindowStart) };
  if (record.sendsInWindow) item.sendsInWindow = { N: String(record.sendsInWindow) };
  if (record.deviceChallengeId) item.deviceChallengeId = { S: record.deviceChallengeId };
  if (record.deviceChallengeHash) item.deviceChallengeHash = { S: record.deviceChallengeHash };
  return item;
}

function rateUpdate(key, maximum, expiresAt, tableName) {
  return { Update: { TableName:tableName, Key:{recordKey:{S:key}}, UpdateExpression:"ADD #count :one SET #ttl = :ttl", ConditionExpression:"attribute_not_exists(#count) OR #count < :maximum", ExpressionAttributeNames:{"#count":"count","#ttl":"ttl"}, ExpressionAttributeValues:{":one":{N:"1"},":maximum":{N:String(maximum)},":ttl":{N:String(expiresAt)}} } };
}

export function createPersonalPhoneDynamoAdapter({ db, tableName, commands, now = () => Date.now() }) {
  const { GetItemCommand, TransactWriteItemsCommand, UpdateItemCommand } = commands;
  async function getClaim(phoneHash) { return (await db.send(new GetItemCommand({ TableName:tableName, Key:claimKey(phoneHash), ConsistentRead:true }))).Item || null; }
  // Room for this account on the number: already linked, or fewer than 10 accounts.
  async function linkCapacity(phoneHash, userId) { const members = claimMembers(await getClaim(phoneHash)); return members.includes(userId) || members.length < MAX_ACCOUNTS_PER_NUMBER; }
  async function getByUser(userId) { return recordFromItem((await db.send(new GetItemCommand({ TableName:tableName, Key:accountKey(userId), ConsistentRead:true }))).Item); }
  async function reserveChallenge(record) {
    const seconds = Math.floor(now()/1000), hour = Math.floor(now()/3600000), day = Math.floor(now()/86400000);
    const transactions = [
      rateUpdate(`RATE#ACCOUNT#${record.userId}#HOUR#${hour}`,3,seconds+7200,tableName),
      rateUpdate(`RATE#ACCOUNT#${record.userId}#DAY#${day}`,6,seconds+172800,tableName),
      rateUpdate(`RATE#PHONE#${record.phoneHash}#HOUR#${hour}`,3,seconds+7200,tableName)
    ];
    if (record.requestKey) transactions.push(rateUpdate(`RATE#REQUEST#${record.requestKey}#HOUR#${hour}`,12,seconds+7200,tableName));
    if (record.deviceChallengeHash) transactions.push(rateUpdate(`RATE#DEVICE#${record.deviceChallengeHash}#HOUR#${hour}`,3,seconds+7200,tableName));
    // Rule 11: at most a text and one resend per 10 minutes, per number and per device.
    const tenMinutes = Math.floor(now()/600000);
    transactions.push(rateUpdate(`RATE#PHONE10#${record.phoneHash}#${tenMinutes}`,2,seconds+1800,tableName));
    if (record.deviceChallengeHash) transactions.push(rateUpdate(`RATE#DEVICE10#${record.deviceChallengeHash}#${tenMinutes}`,2,seconds+1800,tableName));
    transactions.push(
      // The number must have room for this account (10 max). The account joins the number only when its code is confirmed.
      { ConditionCheck:{TableName:tableName,Key:claimKey(record.phoneHash),ConditionExpression:claimRoom,ExpressionAttributeValues:{":me":{S:record.userId},":maximum":{N:String(MAX_ACCOUNTS_PER_NUMBER)}}} },
      // One text per tap: a second tap while the first code is still in its resend cooldown fails here, atomically.
      { Put:{TableName:tableName,Item:accountItem(record),ConditionExpression:"attribute_not_exists(recordKey) OR #status <> :pending OR resendAfter <= :nowSeconds",ExpressionAttributeNames:{"#status":"status"},ExpressionAttributeValues:{":pending":{S:"pending"},":nowSeconds":{N:String(seconds)}}} }
    );
    // The counters this send used, so a send that fails on DanzStak's side can give them back (directive L2).
    const rateKeys = transactions.filter(item => item.Update && String(item.Update.Key?.recordKey?.S || "").startsWith("RATE#")).map(item => item.Update.Key.recordKey.S);
    try { await db.send(new TransactWriteItemsCommand({TransactItems:transactions})); return {accepted:true,rateKeys}; }
    catch (error) { if (["TransactionCanceledException","ConditionalCheckFailedException"].includes(error?.name)) return {accepted:false,rateLimited:true}; throw error; }
  }
  // Directive L2 (owner 2026-11-19): a send that fails on our side (provider down, 5xx) never uses up the member's
  // hourly, daily or resend limits. Each counter goes back down by one, never below zero.
  async function releaseRateCounters(keys = []) {
    await Promise.all(keys.filter(key => /^RATE#/.test(String(key))).map(key => db.send(new UpdateItemCommand({TableName:tableName,Key:{recordKey:{S:key}},UpdateExpression:"ADD #count :minus",ConditionExpression:"#count > :zero",ExpressionAttributeNames:{"#count":"count"},ExpressionAttributeValues:{":minus":{N:"-1"},":zero":{N:"0"}}})).catch(error => { if (error?.name !== "ConditionalCheckFailedException") throw error; })));
  }
  async function markSent(record) {
    // Twilio Verify: keep only the verification SID (VE...), never the code or the number.
    const sid = /^VE[0-9a-f]{32}$/i.test(String(record.verificationSid || "")) ? record.verificationSid : "";
    await db.send(new UpdateItemCommand({TableName:tableName,Key:accountKey(record.userId),UpdateExpression:sid ? "SET providerAcceptedAt = :sent, verificationSid = :sid" : "SET providerAcceptedAt = :sent",ConditionExpression:"challengeId = :challenge AND #status = :pending",ExpressionAttributeNames:{"#status":"status"},ExpressionAttributeValues:{":sent":{S:new Date(now()).toISOString()},":challenge":{S:record.challengeId},":pending":{S:"pending"},...(sid ? {":sid":{S:sid}} : {})}}));
  }
  async function cancelChallenge(record) {
    const existing = await getByUser(record.userId); if (!existing || existing.challengeId !== record.challengeId) return;
    const operations = [];
    if (existing.previousPhoneHash) operations.push({Put:{TableName:tableName,Item:{...accountKey(record.userId),recordType:{S:"account"},userId:{S:record.userId},phoneHash:{S:existing.previousPhoneHash},maskedNumber:{S:existing.previousMaskedNumber},status:{S:"verified"},verifiedAt:{S:existing.previousVerifiedAt||new Date(now()).toISOString()}}}});
    else operations.push({Delete:{TableName:tableName,Key:accountKey(record.userId),ConditionExpression:"challengeId = :challenge",ExpressionAttributeValues:{":challenge":{S:record.challengeId}}}});
    await db.send(new TransactWriteItemsCommand({TransactItems:operations}));
  }
  async function recordFailedAttempt(record) { if (!record) return; await db.send(new UpdateItemCommand({TableName:tableName,Key:accountKey(record.userId),UpdateExpression:"ADD attempts :one",ConditionExpression:"challengeId = :challenge AND #status = :pending AND attempts < :maximum",ExpressionAttributeNames:{"#status":"status"},ExpressionAttributeValues:{":one":{N:"1"},":challenge":{S:record.challengeId},":pending":{S:"pending"},":maximum":{N:"5"}}})); }
  async function markVerified(record, grant = null) {
    const operations = [
      {Update:{TableName:tableName,Key:accountKey(record.userId),UpdateExpression:"SET #status = :verified, verifiedAt = :verifiedAt REMOVE challengeHash, expiresAt, resendAfter, attempts, previousPhoneHash, previousMaskedNumber, previousVerifiedAt, #ttl",ConditionExpression:"challengeId = :challenge AND #status = :pending",ExpressionAttributeNames:{"#status":"status","#ttl":"ttl"},ExpressionAttributeValues:{":challenge":{S:record.challengeId},":pending":{S:"pending"},":verified":{S:"verified"},":verifiedAt":{S:new Date(now()).toISOString()}}}},
      linkClaimOperation(tableName, record.phoneHash, record.userId, await getClaim(record.phoneHash))
    ];
    if (grant) operations.push({Put:{TableName:tableName,Item:{recordKey:{S:`DEVICE_GRANT#${grant.grantId}`},recordType:{S:"device_enrollment_grant"},userId:{S:record.userId},grantTokenHash:{S:grant.grantTokenHash},phoneHash:{S:record.phoneHash},deviceChallengeId:{S:record.deviceChallengeId},deviceChallengeHash:{S:record.deviceChallengeHash},maskedNumber:{S:record.maskedNumber},verifiedAt:{S:grant.verifiedAt},expiresAt:{N:String(grant.expiresAt)},ttl:{N:String(grant.expiresAt+86400)}},ConditionExpression:"attribute_not_exists(recordKey)"}});
    if (record.previousPhoneHash && record.previousPhoneHash !== record.phoneHash) { const unlink = unlinkClaimOperation(tableName, record.previousPhoneHash, record.userId, await getClaim(record.previousPhoneHash)); if (unlink) operations.push(unlink); }
    try { await db.send(new TransactWriteItemsCommand({TransactItems:operations})); return true; } catch(error) { if (["TransactionCanceledException","ConditionalCheckFailedException"].includes(error?.name)) return false; throw error; }
  }
  async function remove(userId) {
    const record=await getByUser(userId); if(!record)return;
    // Removes the number from this account only; the other linked accounts keep it.
    const unlink = record.phoneHash ? unlinkClaimOperation(tableName, record.phoneHash, userId, await getClaim(record.phoneHash)) : null;
    await db.send(new TransactWriteItemsCommand({TransactItems:[{Delete:{TableName:tableName,Key:accountKey(userId),ConditionExpression:"userId = :userId",ExpressionAttributeValues:{":userId":{S:userId}}}},...(unlink?[unlink]:[])]}));
  }
  // Rule 11: one wrong code ends the challenge. The record stays (status "canceled") so the resend window still counts.
  async function cancelAfterWrongCode(record) {
    if (record.previousPhoneHash) return cancelChallenge(record); // restore the member's earlier verified number
    try { await db.send(new UpdateItemCommand({TableName:tableName,Key:accountKey(record.userId),UpdateExpression:"SET #status = :canceled, canceledAt = :at",ConditionExpression:"challengeId = :challenge AND #status = :pending",ExpressionAttributeNames:{"#status":"status"},ExpressionAttributeValues:{":canceled":{S:"canceled"},":at":{S:new Date(now()).toISOString()},":challenge":{S:record.challengeId},":pending":{S:"pending"}}})); }
    catch (error) { if (error?.name !== "ConditionalCheckFailedException") throw error; }
  }
  // Code checks: at most 30 an hour per IP and 10 an hour per account, on top of 5 tries per code.
  async function limitCheck({ userId, requestKey = "" }) {
    const seconds = Math.floor(now()/1000), hour = Math.floor(now()/3600000);
    const transactions = [rateUpdate(`RATE#CHECK#ACCOUNT#${userId}#HOUR#${hour}`,10,seconds+7200,tableName)];
    if (requestKey) transactions.push(rateUpdate(`RATE#CHECK#REQUEST#${requestKey}#HOUR#${hour}`,30,seconds+7200,tableName));
    try { await db.send(new TransactWriteItemsCommand({TransactItems:transactions})); return true; }
    catch (error) { if (["TransactionCanceledException","ConditionalCheckFailedException"].includes(error?.name)) return false; throw error; }
  }
  return { getByUser, reserveChallenge, releaseRateCounters, markSent, cancelChallenge, recordFailedAttempt, markVerified, remove, limitCheck, cancelAfterWrongCode, linkCapacity };
}
