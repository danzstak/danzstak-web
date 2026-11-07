const assert = require("node:assert/strict");
const fs = require("node:fs");

const client = fs.readFileSync("assets/direct-messages.js", "utf8");
const styles = fs.readFileSync("assets/chat.css", "utf8");

assert.match(client, /function pendingMessageItem\(content, mediaFile\)/, "messaging needs an immediate sending bubble");
assert.match(client, /messageList\.appendChild\(pendingItem\)/, "the sending bubble must appear before the network request finishes");
assert.match(client, /meta\.textContent = messageTranslate\("Sending…"\)/, "pending delivery state must be visible in the selected language");
assert.match(client, /pendingItem\.replaceWith\(directMessageItem\(data\.message\)\)/, "the server-confirmed message must replace the pending bubble");
assert.match(client, /shownMessages\.add\(data\.message\.messageId\)/, "background polling must not duplicate a confirmed optimistic message");
assert.match(client, /clientMessageId = retry\?\.clientMessageId \|\| `\$\{String\(Date\.now\(\)\)\.padStart\(13, "0"\)\}#\$\{crypto\.randomUUID\(\)\}`/, "one user action must keep one stable client message ID across retries");
assert.match(client, /JSON\.stringify\(\{ recipientEmail, content, clientMessageId, \.\.\.attachment \}\)/, "online sends must carry the stable client message ID");
assert.match(client, /danzstakQueueOffline\("\/messages", \{ recipientEmail, content, clientMessageId \}\)/, "offline sends must preserve the same client message ID");
assert.match(client, /retryMessageSend = \{ recipientEmail, content, mediaFile, clientMessageId, attachment \}/, "ambiguous failures must retain the ID and any completed media upload");
assert.doesNotMatch(client, /if \(retryMessageSend && !retry\) \{\s*await discardMessageMedia/, "changing an uncertain send must not delete media the server may already have accepted");
assert.doesNotMatch(client, /if \(!response\.ok\) \{\s*await discardMessageMedia/, "a failed or lost response must not delete media from a possibly committed message");
assert.match(client, /if \(content && !messageInput\.value\.trim\(\)\) messageInput\.value = content/, "failed text must return to the composer");
assert.match(client, /Your message is still in the composer/, "failed delivery must explain that the draft was preserved");
assert.match(client, /callStatus\.textContent = messageTranslate\("Delivered"\)/, "a confirmed retry must replace stale failure text with a truthful delivered state");
assert.match(styles, /\.message-pending\{opacity:/, "pending messages need a distinct visual state");

console.log("Optimistic messaging checks passed: immediate sending state, confirmation replacement, deduplication, and draft recovery.");
