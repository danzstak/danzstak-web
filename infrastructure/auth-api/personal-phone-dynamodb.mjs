const accountKey = userId => ({ recordKey: { S: `ACCOUNT#${userId}` } });
const claimKey = phoneHash => ({ recordKey: { S: `PHONE#${phoneHash}` } });
const value = (item, name, fallback = "") => item?.[name]?.S ?? (item?.[name]?.N !== undefined ? Number(item[name].N) : fallback);

function recordFromItem(item) {
  if (!item) return null;
  return Object.fromEntries([
    ["userId", value(item, "userId")], ["phoneHash", value(item, "phoneHash")], ["challengeId", value(item, "challengeId")],
    ["challengeHash", value(item, "challengeHash")], ["status", value(item, "status")], ["createdAt", value(item, "createdAt")],
    ["verifiedAt", value(item, "verifiedAt")], ["expiresAt", value(item, "expiresAt", 0)], ["resendAfter", value(item, "resendAfter", 0)],
    ["attempts", value(item, "attempts", 0)], ["maskedNumber", value(item, "maskedNumber")], ["purpose", value(item, "purpose", "account_trust")],
    ["deviceChallengeId", value(item, "deviceChallengeId")], ["deviceChallengeHash", value(item, "deviceChallengeHash")], ["previousPhoneHash", value(item, "previousPhoneHash")],
    ["previousMaskedNumber", value(item, "previousMaskedNumber")], ["previousVerifiedAt", value(item, "previousVerifiedAt")]
  ]);
}

function accountItem(record) {
  const item = { ...accountKey(record.userId), recordType:{S:"account"}, userId:{S:record.userId}, phoneHash:{S:record.phoneHash}, challengeId:{S:record.challengeId}, challengeHash:{S:record.challengeHash}, status:{S:"pending"}, createdAt:{S:record.createdAt}, expiresAt:{N:String(record.expiresAt)}, ttl:{N:String(record.expiresAt + 86400)}, resendAfter:{N:String(record.resendAfter)}, attempts:{N:"0"}, maskedNumber:{S:record.maskedNumber} };
  if (record.previousPhoneHash) item.previousPhoneHash = { S: record.previousPhoneHash };
  if (record.previousMaskedNumber) item.previousMaskedNumber = { S: record.previousMaskedNumber };
  if (record.previousVerifiedAt) item.previousVerifiedAt = { S: record.previousVerifiedAt };
  if (record.purpose) item.purpose = { S: record.purpose };
  if (record.deviceChallengeId) item.deviceChallengeId = { S: record.deviceChallengeId };
  if (record.deviceChallengeHash) item.deviceChallengeHash = { S: record.deviceChallengeHash };
  return item;
}

function rateUpdate(key, maximum, expiresAt, tableName) {
  return { Update: { TableName:tableName, Key:{recordKey:{S:key}}, UpdateExpression:"ADD #count :one SET #ttl = :ttl", ConditionExpression:"attribute_not_exists(#count) OR #count < :maximum", ExpressionAttributeNames:{"#count":"count","#ttl":"ttl"}, ExpressionAttributeValues:{":one":{N:"1"},":maximum":{N:String(maximum)},":ttl":{N:String(expiresAt)}} } };
}

export function createPersonalPhoneDynamoAdapter({ db, tableName, commands, now = () => Date.now() }) {
  const { GetItemCommand, TransactWriteItemsCommand, UpdateItemCommand } = commands;
  async function getByUser(userId) { return recordFromItem((await db.send(new GetItemCommand({ TableName:tableName, Key:accountKey(userId), ConsistentRead:true }))).Item); }
  async function reserveChallenge(record) {
    const seconds = Math.floor(now()/1000), hour = Math.floor(now()/3600000), day = Math.floor(now()/86400000);
    const transactions = [
      rateUpdate(`RATE#ACCOUNT#${record.userId}#HOUR#${hour}`,3,seconds+7200,tableName),
      rateUpdate(`RATE#ACCOUNT#${record.userId}#DAY#${day}`,6,seconds+172800,tableName),
      rateUpdate(`RATE#PHONE#${record.phoneHash}#HOUR#${hour}`,3,seconds+7200,tableName)
    ];
    if (record.requestKey) transactions.push(rateUpdate(`RATE#REQUEST#${record.requestKey}#HOUR#${hour}`,12,seconds+7200,tableName));
    transactions.push(
      { Put:{TableName:tableName,Item:{...claimKey(record.phoneHash),recordType:{S:"phone_claim"},userId:{S:record.userId},challengeId:{S:record.challengeId},status:{S:"pending"},ttl:{N:String(record.expiresAt+86400)}},ConditionExpression:"attribute_not_exists(recordKey) OR userId = :userId",ExpressionAttributeValues:{":userId":{S:record.userId}}}},
      { Put:{TableName:tableName,Item:accountItem(record)} }
    );
    try { await db.send(new TransactWriteItemsCommand({TransactItems:transactions})); return {accepted:true}; }
    catch (error) { if (["TransactionCanceledException","ConditionalCheckFailedException"].includes(error?.name)) return {accepted:false,rateLimited:true}; throw error; }
  }
  async function markSent(record) { await db.send(new UpdateItemCommand({TableName:tableName,Key:accountKey(record.userId),UpdateExpression:"SET providerAcceptedAt = :sent",ConditionExpression:"challengeId = :challenge AND #status = :pending",ExpressionAttributeNames:{"#status":"status"},ExpressionAttributeValues:{":sent":{S:new Date(now()).toISOString()},":challenge":{S:record.challengeId},":pending":{S:"pending"}}})); }
  async function cancelChallenge(record) {
    const existing = await getByUser(record.userId); if (!existing || existing.challengeId !== record.challengeId) return;
    const operations = [{Delete:{TableName:tableName,Key:claimKey(record.phoneHash),ConditionExpression:"userId = :userId AND challengeId = :challenge",ExpressionAttributeValues:{":userId":{S:record.userId},":challenge":{S:record.challengeId}}}}];
    if (existing.previousPhoneHash) operations.push({Put:{TableName:tableName,Item:{...accountKey(record.userId),recordType:{S:"account"},userId:{S:record.userId},phoneHash:{S:existing.previousPhoneHash},maskedNumber:{S:existing.previousMaskedNumber},status:{S:"verified"},verifiedAt:{S:existing.previousVerifiedAt||new Date(now()).toISOString()}}}});
    else operations.push({Delete:{TableName:tableName,Key:accountKey(record.userId),ConditionExpression:"challengeId = :challenge",ExpressionAttributeValues:{":challenge":{S:record.challengeId}}}});
    await db.send(new TransactWriteItemsCommand({TransactItems:operations}));
  }
  async function recordFailedAttempt(record) { if (!record) return; await db.send(new UpdateItemCommand({TableName:tableName,Key:accountKey(record.userId),UpdateExpression:"ADD attempts :one",ConditionExpression:"challengeId = :challenge AND #status = :pending AND attempts < :maximum",ExpressionAttributeNames:{"#status":"status"},ExpressionAttributeValues:{":one":{N:"1"},":challenge":{S:record.challengeId},":pending":{S:"pending"},":maximum":{N:"5"}}})); }
  async function markVerified(record, grant = null) {
    const operations = [
      {Update:{TableName:tableName,Key:accountKey(record.userId),UpdateExpression:"SET #status = :verified, verifiedAt = :verifiedAt REMOVE challengeHash, expiresAt, resendAfter, attempts, previousPhoneHash, previousMaskedNumber, previousVerifiedAt, ttl",ConditionExpression:"challengeId = :challenge AND #status = :pending",ExpressionAttributeNames:{"#status":"status"},ExpressionAttributeValues:{":challenge":{S:record.challengeId},":pending":{S:"pending"},":verified":{S:"verified"},":verifiedAt":{S:new Date(now()).toISOString()}}}},
      {Update:{TableName:tableName,Key:claimKey(record.phoneHash),UpdateExpression:"SET #status = :verified REMOVE ttl",ConditionExpression:"userId = :userId AND challengeId = :challenge",ExpressionAttributeNames:{"#status":"status"},ExpressionAttributeValues:{":userId":{S:record.userId},":challenge":{S:record.challengeId},":verified":{S:"verified"}}}}
    ];
    if (grant) operations.push({Put:{TableName:tableName,Item:{recordKey:{S:`DEVICE_GRANT#${grant.grantId}`},recordType:{S:"device_enrollment_grant"},userId:{S:record.userId},grantTokenHash:{S:grant.grantTokenHash},deviceChallengeId:{S:record.deviceChallengeId},deviceChallengeHash:{S:record.deviceChallengeHash},maskedNumber:{S:record.maskedNumber},verifiedAt:{S:grant.verifiedAt},expiresAt:{N:String(grant.expiresAt)},ttl:{N:String(grant.expiresAt+86400)}},ConditionExpression:"attribute_not_exists(recordKey)"}});
    if (record.previousPhoneHash && record.previousPhoneHash !== record.phoneHash) operations.push({Delete:{TableName:tableName,Key:claimKey(record.previousPhoneHash),ConditionExpression:"userId = :userId",ExpressionAttributeValues:{":userId":{S:record.userId}}}});
    try { await db.send(new TransactWriteItemsCommand({TransactItems:operations})); return true; } catch(error) { if (["TransactionCanceledException","ConditionalCheckFailedException"].includes(error?.name)) return false; throw error; }
  }
  async function remove(userId) {
    const record=await getByUser(userId); if(!record)return;
    await db.send(new TransactWriteItemsCommand({TransactItems:[{Delete:{TableName:tableName,Key:accountKey(userId),ConditionExpression:"userId = :userId",ExpressionAttributeValues:{":userId":{S:userId}}}},{Delete:{TableName:tableName,Key:claimKey(record.phoneHash),ConditionExpression:"userId = :userId",ExpressionAttributeValues:{":userId":{S:userId}}}}]}));
  }
  return { getByUser, reserveChallenge, markSent, cancelChallenge, recordFailedAttempt, markVerified, remove };
}
