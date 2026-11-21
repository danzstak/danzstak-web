// Facebook's Sharing Debugger got 403 on profile links because robots.txt disallowed /profile.html for every
// crawler (owner 2026-11-21). Link-preview crawlers may read profiles; everyone else stays out.
const fs = require("fs");
const assert = require("assert");
const groups = fs.readFileSync(__dirname + "/robots.txt", "utf8").split(/\n\s*\n/).map(block => {
  const lines = block.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
  return { agents: lines.filter(l => /^user-agent:/i.test(l)).map(l => l.split(":")[1].trim().toLowerCase()),
    rules: lines.filter(l => /^(allow|disallow):/i.test(l)).map(l => l.toLowerCase().replace(/\s+/g, "")) };
}).filter(g => g.agents.length);
const groupFor = agent => groups.find(g => g.agents.includes(agent.toLowerCase())) || groups.find(g => g.agents.includes("*"));
for (const bot of ["facebookexternalhit", "Facebot", "Twitterbot", "WhatsApp", "TelegramBot"]) {
  const g = groupFor(bot);
  assert.ok(g.rules.includes("allow:/profile.html") && !g.rules.includes("disallow:/profile.html"), `${bot} must be allowed to read /profile.html`);
  assert.ok(g.rules.includes("disallow:/messages.html"), `${bot} must still stay out of messages`);
}
assert.ok(groupFor("Googlebot").rules.includes("disallow:/profile.html"), "search engines stay out of profiles");
console.log("preview bots robots ok");
