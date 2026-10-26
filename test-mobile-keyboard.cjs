const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let mutation,focus,key,submitted=0;
const field=()=>({nodeType:1,attrs:{},matches:()=>true,querySelectorAll:()=>[],setAttribute(k,v){this.attrs[k]=v;}});
const initial=field(),dynamic=field(),focused=field();
const document={readyState:'complete',body:{},querySelectorAll:()=>[initial],addEventListener(name,fn){if(name==='focusin')focus=fn;}};
vm.runInNewContext(fs.readFileSync('assets/mobile-keyboard.js','utf8'),{document,MutationObserver:class{constructor(fn){mutation=fn;}observe(){}}});
assert.equal(initial.attrs.enterkeyhint,'enter');mutation([{addedNodes:[dynamic,{nodeType:3}]}]);assert.equal(dynamic.attrs.enterkeyhint,'enter');focus({target:focused});assert.equal(focused.attrs.enterkeyhint,'enter');
const source=fs.readFileSync('assets/direct-messages.js','utf8');
const handler=source.slice(source.indexOf('messageInput?.addEventListener("keydown"'),source.indexOf('messageForm?.addEventListener("submit"'));
const input={disabled:false,addEventListener(name,fn){key=fn;}};
vm.runInNewContext(handler,{messageInput:input,messageForm:{requestSubmit(){submitted++;}}});
function press(extra={}){let prevented=false;key({key:'Enter',preventDefault(){prevented=true;},...extra});return prevented;}
assert.equal(press({isComposing:true}),false);assert.equal(press({keyCode:229}),false);assert.equal(submitted,0,'IME confirmation must not send');
assert.equal(press(),true);assert.equal(submitted,1);press({repeat:true});press({shiftKey:true});input.disabled=true;press();assert.equal(submitted,1,'repeat or disabled input must not send');
const markup=fs.readFileSync('messages.html','utf8');assert.match(markup,/<input id="messageInput"[^>]*enterkeyhint="enter"/);assert.match(markup,/<button type="submit" hidden disabled aria-label="Send message"/);
for(const page of ['index','feed','profile','messages'])assert.ok(fs.readFileSync(page+'.html','utf8').includes('assets/mobile-keyboard.js'),page+' must load keyboard hints');
console.log('Mobile keyboard checks passed: initial/dynamic fields, focus, Return submission, IME safety, repeats, disabled chat, and hidden submit control.');
