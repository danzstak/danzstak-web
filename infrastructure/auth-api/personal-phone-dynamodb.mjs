const accountKey = userId => ({ recordKey: { S: `ACCOUNT#${userId}` } });
const claimKey = phoneHash => ({ recordKey: { S: `PHONE#${phoneHash}` } });

function value(item, name, fallback = "") {
  return item?.[name]?.S ?? (item?.[name]?.N !== undefined ? Number(item[name].N) : fallback);
}

function recordFromItem(item) {
  if (!item) return null;
  return {
    userId: value(item, "userId"),
    phoneHash: value(item, "phoneHash"),
    challengeId: value(item, "challengeId"),
    challengeHash: value(item, "challengeHash"),
    status: value(item, "status"),
    createdAt: value(item, "createdAt"),
    verifiedAt: value(item, "verifiedAt"),
    expiresAt: value(item, "expiresAt", 0),
    resendAfter: value(item, "resendAfter", 0),
    attempts: value(item, "attempts", 0),
    maskedNumber: value(item, "maskedNumber"),
    previousPhoneHash: value(item, "previousPhoneHash"),
    previousMaskedNumber: value(item, "previousMaskedNumber"),
    previousVerifiedAt: value(item, "previousVerifiedAt")
  };
}

function putAccountItem(record) {
  const item = {
    ...accountKey(record.userId),
    recordType: { S: "account" },
    userId: { S: record.userId },
    phoneHash: { S: record.phoneHash },
    challengeId: { S: record.challengeId },
    challengeHash: { S: record.challengeHash },
    status: { S: "pending" },
    createdAt: { S: record.createdAt },
    expiresAt: { N: String(record.expiresAt) },
    ttl: { N: String(record.expiresAt + 86400) },
    resendAfter: { N: String(record.resendAfter) },
    attempts: { N: "0" },
    maskedNumber: { S: record.maskedNumber }
  };
  if (record.previousPhoneHash) item.previousPhoneHash = { S: record.previousPhoneHash };
  if (record.previousMaskedNumber) item.previousMaskedNumber = { S: record.previousMaskedNumber };
  if (record.previousVerifiedAt) item.previousVerifiedAt = { S: record.previousVerifiedAt };
  return item;
}

function rateUpdate(recordKey, maximum, expiresAt) {
  return {
    Update: {
      Key: { recordKey: { S: recordKey } },
      UpdateExpression: "ADD #count :one SET #ttl = :ttl",
      ConditionExpression: "attribute_not_exists(#count) OR #count < :maximum",
      ExpressionAttributeNames: { "#count": "count", "#ttl": "ttl" },
      ExpressionAttributeValues: { ":one": { N: "1" }, ":maximum": { N: String(maximum) }, ":ttl": { N: String(expiresAt) } }
    }
  };
}

export function createPersonalPhoneDynamoAdapter({ db, tableName, commands, now = () => Date.now() }) {
  if (!db || !tableName || !commands) throw new TypeError("Phone verification DynamoDB dependencies are required");
  const { GetItemCommand, TransactWriteItemsCommand, UpdateItemCommand } = commands;
  const table = operation => {
    if (operation.Put) operation.Put.TableName = tableName;
    if (operation.Update) operation.Update.TableName = tableName;
    if (operation.Delete) operation.Delete.TableName = tableName;
    return operation;
  };

  async function getByUser(userId) {
    const found = await db.send(new GetItemCommand({ TableName: tableName, Key: accountKey(userId), ConsistentRead: true }));
    return recordFromItem(found.Item);
  }

  async function reserveChallenge(record) {
    const currentHour = Math.floor(now() / 3600000), currentDay = Math.floor(now() / 86400000);
    const rateScope = [
      rateUpdate(`RATE#ACCOUNT#${record.userId}#HOUR#${currentHour}`, 3, Math.floor(now() / 1000) + 7200),
      rateUpdate(`RATE#ACCOUNT#${record.userId}#DAY#${currentDay}`, 6, Math.floor(now() / 1000) + 172800),
      rateUpdate(`RATE#PHONE#${record.phoneHash}#HOUR#${currentHour}`, 3, Math.floor(now() / 1000) + 7200)
    ];
    if (record.requestKey) rateScope.push(rateUpdate(`RATE#REQUEST#${record.requestKey}#HOUR#${currentHour}`, 12, Math.floor(now() / 1000) + 7200));
    const items = [
      ...rateScope,
      { Put: { TableName: tableName, Item: { ...claimKey(record.phoneHash), recordType: { S: "phone_claim" }, userId: { S: record.userId }, challengeId: { S: record.challengeId }, status: { S: "pending" }, ttl: { N: String(record.expiresAt + 86400) } }, ConditionExpression: "attribute_not_exists(recordKey) OR userId = :userId", ExpressionAttributeValues: { ":userId": { S: record.userId } } } },
      { Put: { TableName: tableName, Item: putAccountItem(record) } }
    ].map(table);
    try {
      await db.send(new TransactWriteItemsCommand({ TransactItems: items }));
      return { accepted: true };
    } catch (error) {
      if (error?.name === "TransactionCanceledException" || error?.name === "ConditionalCheckFailedException") return { accepted: false, rateLimited: true };
      throw error;
    }
  }

  async function markSent(record) {
    await db.send(new UpdateItemCommand({ TableName: tableName, Key: accountKey(record.userId), UpdateExpression: "SET providerAcceptedAt = :sent", ConditionExpression: "challengeId = :challenge AND #status = :pending", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":sent": { S: new Date(now()).toISOString() }, ":challenge": { S: record.challengeId }, ":pending": { S: "pending" } } }));
  }

  async function cancelChallenge(record) {
    const existing = await getByUser(record.userId);
    if (!existing || existing.challengeId !== record.challengeId) return;
    const operations = [{ Delete: { TableName: tableName, Key: claimKey(record.phoneHash), ConditionExpression: "userId = :userId AND challengeId = :challenge", ExpressionAttributeValues: { ":userId": { S: record.userId }, ":challenge": { S: record.challengeId } } } }];
    if (existing.previousPhoneHash) {
      operations.push({ Put: { TableName: tableName, Item: { ...accountKey(record.userId), recordType: { S: "account" }, userId: { S: record.userId }, phoneHash: { S: existing.previousPhoneHash }, maskedNumber: { S: existing.previousMaskedNumber }, status: { S: "verified" }, verifiedAt: { S: existing.previousVerifiedAt || new Date(now()).toISOString() } } } });
    } else {
      operations.push({ Delete: { TableName: tableName, Key: accountKey(record.userId), ConditionExpression: "challengeId = :challenge", ExpressionAttributeValues: { ":challenge": { S: record.challengeId } } } });
    }
    await db.send(new TransactWriteItemsCommand({ TransactItems: operations }));
  }

  async function recordFailedAttempt(record) {
    await db.send(new UpdateItemCommand({ TableName: tableName, Key: accountKey(record.userId), UpdateExpression: "ADD attempts :one", ConditionExpression: "challengeId = :challenge AND #status = :pending AND attempts < :maximum", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":one": { N: "1" }, ":challenge": { S: record.challengeId }, ":pending": { S: "pending" }, ":maximum": { N: "5" } } }));
  }

  async function markVerified(record) {
    const operations = [
      { Update: { TableName: tableName, Key: accountKey(record.userId), UpdateExpression: "SET #status = :verified, verifiedAt = :verifiedAt REMOVE challengeHash, expiresAt, resendAfter, attempts, previousPhoneHash, previousMaskedNumber, previousVerifiedAt, ttl", ConditionExpression: "challengeId = :challenge AND #status = :pending", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":challenge": { S: record.challengeId }, ":pending": { S: "pending" }, ":verified": { S: "verified" }, ":verifiedAt": { S: new Date(now()).toISOString() } } } },
      { Update: { TableName: tableName, Key: claimKey(record.phoneHash), UpdateExpression: "SET #status = :verified REMOVE ttl", ConditionExpression: "userId = :userId AND challengeId = :challenge", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":userId": { S: record.userId }, ":challenge": { S: record.challengeId }, ":verified": { S: "verified" } } } }
    ];
    if (record.previousPhoneHash && record.previousPhoneHash !== record.phoneHash) operations.push({ Delete: { TableName: tableName, Key: claimKey(record.previousPhoneHash), ConditionExpression: "userId = :userId", ExpressionAttributeValues: { ":userId": { S: record.userId } } } });
    try { await db.send(new TransactWriteItemsCommand({ TransactItems: operations })); return true; }
    catch (error) { if (error?.name === "TransactionCanceledException" || error?.name === "ConditionalCheckFailedException") return false; throw error; }
  }

  async function remove(userId) {
    const record = await getByUser(userId);
    if (!record) return;
    await db.send(new TransactWriteItemsCommand({ TransactItems: [
      { Delete: { TableName: tableName, Key: accountKey(userId), ConditionExpression: "userId = :userId", ExpressionAttributeValues: { ":userId": { S: userId } } } },
      { Delete: { TableName: tableName, Key: claimKey(record.phoneHash), ConditionExpression: "userId = :userId", ExpressionAttributeValues: { ":userId": { S: userId } } } }
    ] }));
  }

  return { getByUser, reserveChallenge, markSent, cancelChallenge, recordFailedAttempt, markVerified, remove };
}

export const phoneVerificationKeys = { accountKey, claimKey };
