const assert = require("node:assert/strict");

(async () => {
  const { createTourManagerBilling } = await import("./infrastructure/auth-api/tour-manager-billing.mjs");
  class Command { constructor(input) { this.input = input; } }
  class GetItemCommand extends Command {}
  class PutItemCommand extends Command {}
  class QueryCommand extends Command {}
  class TransactWriteItemsCommand extends Command {}
  class UpdateItemCommand extends Command {}
  const commands = { GetItemCommand, PutItemCommand, QueryCommand, TransactWriteItemsCommand, UpdateItemCommand };
  const records = new Map(), keyOf = key => `${key.userId.S}|${key.tourId.S}`;
  const userId = "user_12345678", creditKey = `${userId}|TOUR_MANAGER#BOOKING_EMAIL_CREDITS`;
  records.set(creditKey, { userId: { S: userId }, tourId: { S: "TOUR_MANAGER#BOOKING_EMAIL_CREDITS" }, credits: { N: "0" }, purchasedCredits: { N: "0" } });
  const number = (item, field) => Number(item[field]?.N || 0);
  const db = { async send(command) {
    if (command instanceof GetItemCommand) return { Item: records.get(keyOf(command.input.Key)) };
    if (command instanceof PutItemCommand) {
      const key = keyOf(command.input.Item);
      if (records.has(key)) throw new Error("condition");
      records.set(key, structuredClone(command.input.Item));
      return {};
    }
    if (command instanceof TransactWriteItemsCommand) {
      const [transaction, quoteUpdate, creditUpdate, ledger] = command.input.TransactItems;
      const transactionKey = keyOf(transaction.Put.Item), quoteKey = keyOf(quoteUpdate.Update.Key), quote = records.get(quoteKey);
      if (records.has(transactionKey) || quote?.status?.S !== "pending") throw new Error("condition");
      records.set(transactionKey, structuredClone(transaction.Put.Item));
      quote.status = { S: "paid" };
      const credit = records.get(keyOf(creditUpdate.Update.Key)), quantity = Number(creditUpdate.Update.ExpressionAttributeValues[":quantity"].N);
      credit.credits = { N: String(number(credit, "credits") + quantity) };
      credit.purchasedCredits = { N: String(number(credit, "purchasedCredits") + quantity) };
      records.set(keyOf(ledger.Put.Item), structuredClone(ledger.Put.Item));
      return {};
    }
    throw new Error("Unexpected command");
  } };
  const now = Date.parse("2026-11-03T12:00:00.000Z"), transactionHash = `0x${"ab".repeat(32)}`;
  let transferData = "";
  const fetcher = async (url, options = {}) => {
    if (url === "https://rates.example/sfs") return { ok: true, json: async () => ({ usd: "0.04", observedAt: "2026-11-03T11:55:00.000Z" }) };
    const body = JSON.parse(options.body), result = body.method === "eth_chainId" ? "0x1"
      : body.method === "eth_getTransactionByHash" ? { hash: transactionHash, to: "0x1111111111111111111111111111111111111111", input: transferData }
      : body.method === "eth_getTransactionReceipt" ? { status: "0x1", blockNumber: "0x59" }
      : body.method === "eth_blockNumber" ? "0x64" : null;
    return { ok: true, json: async () => ({ jsonrpc: "2.0", id: body.id, result }) };
  };
  const corsHeaders = origin => origin === "https://danzstak.com" ? { "access-control-allow-origin": origin } : {};
  const env = { SFS_RPC_URL: "https://rpc.example", SFS_RATE_URL: "https://rates.example/sfs", SFS_TOKEN_CONTRACT: "0x1111111111111111111111111111111111111111", SFS_TREASURY_ADDRESS: "0x2222222222222222222222222222222222222222", SFS_CHAIN_ID: "0x1", SFS_TOKEN_DECIMALS: "18", SFS_MIN_CONFIRMATIONS: "12" };
  const service = createTourManagerBilling({ db, commands, authenticate: async () => userId, corsHeaders, tableName: "Tours", env, fetcher, clock: () => now, sendBookingEmail: async () => ({ messageId: "unused" }) });
  const event = (path, body) => ({ requestContext: { http: { method: "POST" } }, rawPath: path, headers: { origin: "https://danzstak.com" }, body: JSON.stringify(body) });
  const quoted = await service(event("/tour-manager/sfs/quote", { quantity: 100 }));
  assert.equal(quoted.statusCode, 200);
  const quote = JSON.parse(quoted.body);
  assert.equal(quote.totalUsdCents, 15000);
  assert.equal(quote.tokenAmount, "3750");
  assert.equal(quote.chainId, "0x1");
  transferData = quote.transferData;
  const paid = await service(event("/tour-manager/sfs/verify", { quoteId: quote.quoteId, transactionHash }));
  assert.equal(paid.statusCode, 200);
  assert.equal(JSON.parse(paid.body).creditsIssued, 100);
  assert.equal(number(records.get(creditKey), "credits"), 100);
  const duplicate = await service(event("/tour-manager/sfs/verify", { quoteId: quote.quoteId, transactionHash }));
  assert.equal(duplicate.statusCode, 200, "A repeated transaction must return its settled state without issuing credits again");
  assert.equal(JSON.parse(duplicate.body).duplicate, true);
  assert.equal(number(records.get(creditKey), "credits"), 100, "Repeated submissions must not duplicate credits");
  const ledger = [...records.values()].find(item => item.paymentMethod?.S === "sfs");
  assert.equal(ledger.delta.N, "100");
  console.log("Tour Manager SFS checks passed: verified rate quote, exact token transfer, chain and confirmation validation, persistent credit grant, ledger history, and duplicate prevention.");
})().catch(error => { console.error(error); process.exit(1); });
