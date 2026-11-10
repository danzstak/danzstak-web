"use strict";
const {chromium}=require("playwright");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const widths=[320,360,375,390,414,430,768,1024,1366];
const base=String(process.env.DANZSTAK_BASE_URL||process.env.DANZSTAK_LOCAL_URL||"http://127.0.0.1:8016").replace(/\/$/,"");
const capture=process.env.DANZSTAK_CAPTURE_DIR?path.resolve(process.env.DANZSTAK_CAPTURE_DIR):"";

(async()=>{
  const browser=await chromium.launch({channel:"msedge",headless:true});
  try{
    for(const width of widths){
      const context=await browser.newContext({viewport:{width,height:width<700?844:900},serviceWorkers:"block"});
      const page=await context.newPage();
      page.setDefaultTimeout(8000);
      page.on("pageerror",error=>console.error(`Page error at ${width}px:`,error.message));
      console.log(`Checking ${width}px`);
      let startBody,verifyBody,assigned=false,registered=false;
      await page.route("https://api.danzstak.com/**",async route=>{
        const request=route.request(),pathname=new URL(request.url()).pathname;
        const json=body=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});
        if(pathname==="/sync/identity")return json({phoneVerified:false,phoneMasked:"",dsNumber:assigned?"DS-321-0042":"",dsEntitled:true,smsAvailable:true});
        if(pathname==="/sync/phone/start"){startBody=request.postDataJSON();return json({sent:true,phoneMasked:"+1••••••0042",expiresIn:600});}
        if(pathname==="/sync/phone/verify"){verifyBody=request.postDataJSON();return json({phoneVerified:true,phoneMasked:"+1••••••0042",dsNumber:"",dsEntitled:true,smsAvailable:true});}
        if(pathname==="/phone-number/entitlement")return json({entitled:true,status:"pending_provisioning"});
        if(pathname==="/sync/ds-number"){assigned=true;return json({phoneVerified:false,phoneMasked:"",dsNumber:"DS-321-0042",dsEntitled:true,smsAvailable:true});}
        if(pathname==="/calls/devices")return json({devices:registered?[{deviceId:"11111111-1111-4111-8111-111111111111",name:"My test device",allowCalls:true,registeredAt:new Date().toISOString(),lastUsedAt:new Date().toISOString(),revokedAt:"",thisDevice:true}]:[]});
        if(pathname==="/calls/devices/challenge")return json({challengeId:"22222222-2222-4222-8222-222222222222",challenge:"a".repeat(43)});
        if(pathname==="/calls/devices/register"){registered=true;return json({deviceId:"11111111-1111-4111-8111-111111111111",deviceToken:"b".repeat(43),name:"My test device",allowCalls:true,registeredAt:new Date().toISOString()});}
        if(pathname==="/conversations")return json({conversations:[]});
        if(pathname==="/friends")return json({friends:[]});
        if(pathname==="/calls/directory")return json({users:[]});
        if(pathname==="/auth/session")return json({authenticated:true,user:{email:"phone-ui@danzstak.test",sub:"11111111-1111-4111-8111-111111111111"}});
        return json({});
      });
      await page.goto(`${base}/messages.html`,{waitUntil:"domcontentloaded"});
      await page.waitForFunction(()=>typeof window.danzstakOpenCallingDevices==="function");
      const dialog=page.locator("#callingDevicesDialog");
      await dialog.waitFor({state:"visible"});
      await page.waitForFunction(()=>document.querySelector("#callingDevices")?.hasAttribute("data-setup-required"));
      assert.equal(await page.locator("#closeCallingDevices").isHidden(),true,`unregistered device can bypass SYNC at ${width}px`);
      assert.equal(await page.locator(".sync-number-setup").isHidden(),true,`number choices appeared before device registration at ${width}px`);
      if(capture&&(width===390||width===1366)){fs.mkdirSync(capture,{recursive:true});await page.screenshot({path:path.join(capture,`sync-device-required-${width}.png`)});}
      await page.locator("#deviceName").fill("My test device");
      await page.locator("#registerThisDevice").click();
      await dialog.waitFor({state:"hidden"});
      await page.locator("#callingDevices").click();
      await dialog.waitFor({state:"visible"});
      assert.equal(await page.locator(".sync-number-setup").isVisible(),true,`optional number choices stayed hidden after registration at ${width}px`);
      assert.equal(await dialog.evaluate(element=>element.scrollTop),0,`registered-device panel did not reopen at the top at ${width}px`);
      await page.locator("#deviceStatus").filter({hasText:"registered for SYNC"}).waitFor();
      await page.waitForTimeout(100);
      const registeredTop=await page.locator("#callingDevicesDialog > header").evaluate(element=>element.getBoundingClientRect().top);
      assert.ok(registeredTop>=0,`registered-device heading was clipped above the viewport at ${width}px`);
      if(capture&&(width===390||width===1366)){fs.mkdirSync(capture,{recursive:true});await page.screenshot({path:path.join(capture,`sync-device-registered-${width}.png`)});}
      await page.locator('input[name="syncNumberChoice"][value="personal"]').check();
      await page.locator("#phoneCountry").selectOption("US");
      await page.locator("#phoneLocalNumber").fill("415 555 0042");
      if(capture&&(width===390||width===1366)){fs.mkdirSync(capture,{recursive:true});await page.screenshot({path:path.join(capture,`sync-phone-personal-${width}.png`),fullPage:true});}
      await page.locator("#sendPhoneCode").click();
      await page.locator("#phoneCodePanel").waitFor({state:"visible"});
      assert.deepEqual(startBody,{country:"US",countryCode:"+1",localNumber:"415 555 0042"});
      await page.locator("#phoneCode").fill("123456");
      await page.locator("#verifyPhoneCode").click();
      await page.locator("#phoneNumberStatus").filter({hasText:"Verified mobile number"}).waitFor();
      assert.deepEqual(verifyBody,{code:"123456"});
      await page.locator('input[name="syncNumberChoice"][value="ds"]').check();
      await page.locator("#chooseDsNumber").click();
      await page.locator("#dsNumberValue").filter({hasText:"DS-321-0042"}).waitFor();
      const geometry=await page.evaluate(()=>{
        const d=document.querySelector("#callingDevicesDialog").getBoundingClientRect();
        const targets=[...document.querySelectorAll("#callingDevicesDialog button")].filter(x=>x.getClientRects().length>0).map(x=>{const r=x.getBoundingClientRect();return {w:r.width,h:r.height,text:x.textContent.trim()};});
        return {left:d.left,right:d.right,top:d.top,bottom:d.bottom,vw:innerWidth,vh:innerHeight,scrollWidth:document.documentElement.scrollWidth,targets};
      });
      assert.ok(geometry.left>=0&&geometry.right<=geometry.vw,`dialog horizontal overflow at ${width}px`);
      assert.ok(geometry.top>=0&&geometry.bottom<=geometry.vh+1,`dialog vertical overflow at ${width}px`);
      assert.equal(geometry.scrollWidth,width,`page horizontal overflow at ${width}px`);
      for(const target of geometry.targets)assert.ok(target.w>=44&&target.h>=44,`small target ${target.text} at ${width}px: ${target.w}x${target.h}`);
      if(capture&&(width===390||width===1366)){fs.mkdirSync(capture,{recursive:true});await page.screenshot({path:path.join(capture,`sync-phone-danzstak-${width}.png`),fullPage:true});}
      await context.close();
    }
    console.log(`SYNC phone/device browser checks passed at ${widths.join(", ")}px`);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
