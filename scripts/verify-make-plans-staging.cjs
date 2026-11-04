"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),{chromium}=require("playwright-core");
const base=process.env.DANZSTAK_MAKE_PLANS_STAGING_URL||"https://codex-issue-24.d31oovi2mos5iz.amplifyapp.com",edge=process.env.DANZSTAK_EDGE_PATH||"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",output=path.resolve(process.env.DANZSTAK_MAKE_PLANS_STAGING_OUTPUT||"docs/screenshots/issue-24-make-plans/staging-live-390.png");
if(!/^https:\/\/codex-issue-24\.[a-z0-9]+\.amplifyapp\.com$/i.test(base))throw Error("Refusing to run the staging mutation check outside the isolated Issue 24 Amplify branch.");
fs.mkdirSync(path.dirname(output),{recursive:true});
const suffix=crypto.randomInt(100000,999999),users={a:`browsera${suffix}`,b:`browserb${suffix}`,c:`browserc${suffix}`},password=`Review!${crypto.randomBytes(8).toString("hex")}A1`;
(async()=>{const browser=await chromium.launch({headless:true,executablePath:edge});const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"allow"});const page=await context.newPage();page.on("requestfailed",request=>console.error(`request failed: ${request.url()} — ${request.failure()?.errorText||"unknown"}`));page.on("console",message=>{if(message.type()==="error")console.error(`browser console: ${message.text()}`)});
  async function open(){await page.goto(`${base}/plans-review.html?e2e=${Date.now()}`,{waitUntil:"networkidle"});}
  async function waitForApp(action){try{await page.locator("#app").waitFor({state:"visible",timeout:15000})}catch{throw Error(`${action} failed: ${await page.locator("#authStatus").textContent()}`)}}
  async function signup(username){await open();await page.locator("#username").fill(username);await page.locator("#password").fill(password);await page.locator('button[value="signup"]').click();await waitForApp(`sign-up for ${username}`);}
  async function signin(username){await open();await page.locator("#username").fill(username);await page.locator("#password").fill(password);await page.locator('button[value="signin"]').click();await waitForApp(`sign-in for ${username}`);}
  async function signout(){await page.locator("#signOut").click();await page.locator("#authCard").waitFor({state:"visible"});}
  try{
    await signup(users.a);await signout();await signup(users.b);await signout();await signup(users.c);await signout();
    await signin(users.a);await page.locator("#friendName").fill(users.b);await page.locator("#friendSearch button").click();await page.locator("#sendFriend").click();await page.getByText("Friend request sent.").waitFor();await signout();
    await signin(users.b);await page.locator(`[data-accept="${users.a}"]`).click();await page.locator(`[data-chat="${users.a}"]`).click();await page.locator("#makePlan").click();await page.locator("#planTitle").fill("Hosted staging rehearsal");await page.locator("#planStart").fill("2026-11-10T18:00");await page.locator("#planPlace").fill("Public rehearsal room");await page.locator("#planNote").fill("Bring the set list.");await page.locator("#planForm button[type=submit]").click();await page.getByText("Hosted staging rehearsal").waitFor();await signout();
    await signin(users.a);await page.locator('[data-view="plans"]').click();const card=page.locator(".plan-card").filter({hasText:"Hosted staging rehearsal"});await card.getByRole("button",{name:"Going"}).click();await card.getByText(/your response: going/i).waitFor();await page.screenshot({path:output,fullPage:true});await signout();
    await signin(users.c);await page.locator('[data-view="plans"]').click();assert.equal(await page.locator(".plan-card").count(),0,"unrelated C account saw the private plan");assert.equal(await page.locator("#planCount").textContent(),"0");
    console.log(JSON.stringify({base,accounts:3,friendship:"accepted",hostedInvite:"created",crossSessionResponse:"going",unrelatedAccountPlanCount:0,screenshot:output},null,2));
  }finally{await context.close();await browser.close()}
})().catch(error=>{console.error(error.stack||error.message);process.exitCode=1});
