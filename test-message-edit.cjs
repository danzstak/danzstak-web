const fs = require("node:fs");
const assert = require("node:assert/strict");

const source = fs.readFileSync("assets/direct-messages.js", "utf8");
const css = fs.readFileSync("assets/chat.css", "utf8");
const backend = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");

assert.match(source, /function openMessageEditor\(item, message\)/, "owned message text has an editor");
assert.match(source, /body: JSON\.stringify\(\{ action: "edit", contactEmail: directContact, messageId: message\.messageId, content \}\)/, "edits are saved through the API");
assert.match(source, /text\.textContent = message\.content/, "message text remains XSS-safe");
assert.match(source, /message\.senderEmail === currentEmail && message\.content/, "only sent text offers Edit");
assert.match(source, /edit\.textContent = "✎ Edit"/, "the long-press palette contains an Edit action");
assert.match(source, /for \(const emoji of \["👍","❤️","😂","😮","😢","😡"\]\)/, "long press retains emoji reactions");
assert.match(source, /message\.editedAt \? " · edited" : ""/, "edited messages are labeled");
assert.match(source, /event\.key\.toLowerCase\(\) === "e"/, "keyboard users can edit sent text");
assert.match(css, /\.message-edit-form\{/, "message editor is styled");
assert.match(css, /\.message-edit-choice\{/, "Edit action is styled in the reaction palette");
assert.match(source, /remove\.textContent = "⌫ Delete"/, "long press contains a delete action");
assert.match(source, /addChoice\("Delete for me", "me"\)/, "all participants can hide a message for themselves");
assert.match(source, /addChoice\("Delete for everyone", "everyone", true\)/, "senders can delete a message for everyone");
assert.match(source, /action: "delete", contactEmail: directContact, messageId: message\.messageId, scope/, "deletion is saved through the API");

assert.match(backend, /if\(body\.action==='edit'\)return editMessage\(body,user\)/, "message API routes edits");
assert.match(backend, /async function editMessage\(body,user\)/, "message edit backend exists");
assert.match(backend, /found\.Item\.senderEmail\?\.S!==user\.email/, "backend enforces sender ownership");
assert.match(backend, /UpdateExpression:'SET content = :c, editedAt = :e'/, "backend durably stores edited text and timestamp");
assert.match(backend, /editedAt:x\.editedAt\?\.S\|\|''/, "message reads return edit state");
assert.match(backend, /if\(body\.action==='delete'\)return deleteMessage\(body,user\)/, "message API routes deletions");
assert.match(backend, /async function deleteMessage\(body,user\)/, "message deletion backend exists");
assert.match(backend, /if\(scope==='me'\).*UpdateExpression:'ADD hiddenMessages :m'/, "delete for me is private to the requesting account");
assert.match(backend, /if\(found\.Item\.senderEmail\?\.S!==user\.email\)return json\(403,\{error:'Only the sender can delete for everyone'\}\)/, "delete for everyone enforces sender ownership");
assert.match(backend, /hiddenMessages=new Set\(state\.Item\?\.hiddenMessages\?\.SS\|\|\[\]\)/, "hidden messages remain deleted after refresh");

console.log("Message edit checks passed: long press offers WhatsApp-like reactions plus sender-only durable editing.");
