const fs=require('node:fs'),assert=require('node:assert/strict');
const pages=[['index.html','landingMain'],['feed.html','yourMixMain'],['messages.html','messagesMain'],['profile.html','profileMain']];
for(const [file,id] of pages){const html=fs.readFileSync(file,'utf8');assert.match(html,new RegExp('<a class="skip-link" href="#'+id+'">'),file+' needs a visible-on-focus skip link');assert.match(html,new RegExp('<main[^>]*id="'+id+'"[^>]*tabindex="-1"'),file+' main target must receive programmatic focus');assert.match(html,/assets\/soft-ui\.css\?v=363/,file+' must load the current accessible controls');}
const css=fs.readFileSync('assets/soft-ui.css','utf8');assert.match(css,/\.skip-link\{[^}]*position:fixed[^}]*transform:translateY\(-150%\)/);assert.match(css,/\.skip-link:focus\{[^}]*transform:translateY\(0\)/);
console.log('Skip navigation checks passed: landing, feed, messages, and profile bypass repeated navigation with visible focus.');
