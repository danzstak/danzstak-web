const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9800 + (process.pid % 150);
const sitePort = Number(process.env.DANZSTAK_QA_PORT || 8879);
const captureOnly = process.env.DANZSTAK_CAPTURE_ONLY === "1";
const screenshotName = process.env.DANZSTAK_SCREENSHOT || "mobile-menu-after-390.png";
const profile = path.join(process.env.TEMP, `danzstak-menu-qa-${process.pid}`);
const browser = spawn(chrome, ["--headless=new", "--no-first-run", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function retry(fn, attempts = 50) { let last; for (let i = 0; i < attempts; i += 1) { try { return await fn(); } catch (error) { last = error; await pause(100); } } throw last; }

async function main() {
  const target = await retry(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/new?http://127.0.0.1:${sitePort}/feed.html?view=feed`, { method: "PUT" });
    if (!response.ok) throw new Error(`CDP target failed: ${response.status}`);
    return response.json();
  });
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const callbacks = pending.get(message.id); pending.delete(message.id);
    if (message.error) callbacks.reject(new Error(message.error.message)); else callbacks.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const callId = ++id; pending.set(callId, { resolve, reject }); socket.send(JSON.stringify({ id: callId, method, params })); });
  await send("Page.enable"); await send("Runtime.enable");
  const widths = [320, 360, 390, 430, 768, 1280];
  for (const width of widths) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 844, deviceScaleFactor: 1, mobile: width <= 430 });
    await send("Page.navigate", { url: `http://127.0.0.1:${sitePort}/feed.html?view=feed` });
    await retry(async () => {
      const ready = await send("Runtime.evaluate", { expression: "document.readyState === 'complete' && Boolean(document.querySelector('.mobile-menu-control') && document.querySelector('#mobileNavMenu'))", returnByValue: true });
      if (!ready.result?.value) throw new Error("Menu DOM is not ready");
    });
    await pause(250);
    if (width <= 700) {
      await send("Runtime.evaluate", { expression: "document.querySelector('.mobile-menu-control').focus(); document.querySelector('.mobile-menu-control').click()" });
      await pause(280);
      if (width === 390) {
        const image = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
        fs.writeFileSync(path.join(process.cwd(), screenshotName), Buffer.from(image.data, "base64"));
      }
      if (captureOnly) continue;
      const measured = await send("Runtime.evaluate", { expression: `(() => {
        const drawer = document.querySelector('#mobileNavMenu'), backdrop = document.querySelector('.mobile-menu-backdrop');
        const rows = [...drawer.querySelectorAll('.menu-section>a,.menu-section>.menu-action')];
        const icons = [...drawer.querySelectorAll('.menu-icon')];
        const box = drawer.getBoundingClientRect();
        const header = drawer.querySelector('.menu-drawer-header').getBoundingClientRect(), menu = drawer.querySelector('.menu').getBoundingClientRect();
        return { open: document.body.classList.contains('mobile-menu-open'), expanded: document.querySelector('.mobile-menu-control').getAttribute('aria-expanded'), width: box.width, left: box.left, right: box.right, headerLeft: header.left, headerRight: header.right, headerTop: header.top, menuLeft: menu.left, menuRight: menu.right, menuTop: menu.top, rows: rows.length, minRow: Math.min(...rows.map(row => row.getBoundingClientRect().height)), maxRow: Math.max(...rows.map(row => row.getBoundingClientRect().height)), sections: drawer.querySelectorAll('.menu-section').length, icons: icons.length, iconWidths: [...new Set(icons.map(icon => Math.round(icon.getBoundingClientRect().width)))], overflow: drawer.scrollWidth - drawer.clientWidth, backdrop: getComputedStyle(backdrop).display, bodyOverflow: getComputedStyle(document.body).overflow, active: document.activeElement?.className || '' };
      })()`, returnByValue: true });
      const value = measured.result.value;
      assert.equal(value.open, true, `${width}px drawer did not open`);
      assert.equal(value.expanded, "true", `${width}px menu trigger did not expose expanded state`);
      assert.ok(value.width <= 340 && Math.abs(value.width - Math.min(340, width * .85)) <= 1, `${width}px drawer width is ${value.width}px`);
      assert.equal(value.left, 0, `${width}px drawer is not flush to the left edge`);
      assert.ok(value.right <= width, `${width}px drawer leaves the viewport`);
      assert.equal(value.headerLeft, value.left, `${width}px drawer header is not aligned to the drawer`);
      assert.equal(value.headerRight, value.right, `${width}px drawer header does not use the drawer width`);
      assert.equal(value.menuLeft, value.left, `${width}px navigation is horizontally displaced`);
      assert.equal(value.menuRight, value.right, `${width}px navigation does not use the drawer width`);
      assert.ok(value.menuTop > value.headerTop, `${width}px navigation is beside rather than below its header`);
      assert.ok(value.rows >= 17, `${width}px drawer lost navigation destinations`);
      assert.ok(value.minRow >= 48 && value.maxRow <= 52, `${width}px menu rows are ${value.minRow}-${value.maxRow}px tall`);
      assert.equal(value.sections, 3, `${width}px drawer does not have three logical groups`);
      assert.ok(value.icons >= 17 && value.iconWidths.length === 1 && value.iconWidths[0] === 22, `${width}px icons are inconsistent`);
      assert.ok(value.overflow <= 0, `${width}px drawer has horizontal overflow`);
      assert.notEqual(value.backdrop, "none", `${width}px backdrop is not visible`);
      assert.equal(value.bodyOverflow, "hidden", `${width}px background scrolling remains enabled`);
      assert.match(value.active, /mobile-menu-close/, `${width}px focus did not move into the drawer`);
      await send("Runtime.evaluate", { expression: "document.querySelector('.mobile-menu-close').click()" });
      await pause(40);
      const closed = await send("Runtime.evaluate", { expression: "!document.body.classList.contains('mobile-menu-open') && document.querySelector('.mobile-menu-control').getAttribute('aria-expanded') === 'false' && document.activeElement === document.querySelector('.mobile-menu-control')", returnByValue: true });
      assert.equal(closed.result.value, true, `${width}px close button did not restore the trigger and state`);
      if (width === 390) {
        const keyboardAndBackdrop = await send("Runtime.evaluate", { expression: `(() => {
          const trigger=document.querySelector('.mobile-menu-control'); trigger.focus(); trigger.click();
          const drawer=document.querySelector('#mobileNavMenu');
          const controls=[...drawer.querySelectorAll('a[href],button:not([disabled])')].filter(control=>control.getClientRects().length);
          controls.at(-1).focus(); document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true}));
          const wrappedForward=document.activeElement===controls[0];
          controls[0].focus(); document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true}));
          const wrappedBackward=document.activeElement===controls.at(-1);
          document.querySelector('.mobile-menu-backdrop').click();
          const backdropClosed=!document.body.classList.contains('mobile-menu-open');
          trigger.focus(); trigger.click(); document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
          const escapeClosed=!document.body.classList.contains('mobile-menu-open');
          return {wrappedForward,wrappedBackward,backdropClosed,escapeClosed};
        })()`, returnByValue: true });
        assert.deepEqual(keyboardAndBackdrop.result.value, { wrappedForward: true, wrappedBackward: true, backdropClosed: true, escapeClosed: true }, "390px drawer focus wrapping or dismissal failed");
      }
    } else if (!captureOnly) {
      const desktop = await send("Runtime.evaluate", { expression: `(() => { const drawer=document.querySelector('#mobileNavMenu'), close=document.querySelector('.mobile-menu-close'); return {drawerFound:Boolean(drawer), closeFound:Boolean(close), visible:Boolean(drawer?.getClientRects().length), closeVisible:Boolean(close?.getClientRects().length), overflow:document.documentElement.scrollWidth-innerWidth, rows:drawer ? [...drawer.querySelectorAll('.menu-section>a,.menu-section>.menu-action')].map(x=>x.getBoundingClientRect().height) : []} })()`, returnByValue: true });
      if (desktop.exceptionDetails) throw new Error(desktop.exceptionDetails.exception?.description || desktop.exceptionDetails.text);
      assert.ok(desktop.result?.value, `${width}px desktop navigation metrics could not be collected`);
      assert.equal(desktop.result.value.drawerFound, true, `${width}px desktop drawer markup disappeared`);
      assert.equal(desktop.result.value.closeFound, true, `${width}px desktop drawer header disappeared`);
      assert.equal(desktop.result.value.visible, true, `${width}px desktop navigation is hidden`);
      assert.equal(desktop.result.value.closeVisible, false, `${width}px desktop navigation shows a drawer close button`);
      assert.ok(desktop.result.value.overflow <= 0, `${width}px desktop layout overflows horizontally`);
      assert.ok(desktop.result.value.rows.every(height => height >= 48 && height <= 52), `${width}px desktop rows are inconsistent`);
    }
  }
  socket.close();
  console.log(captureOnly ? "Mobile menu screenshot captured at 390px." : `Mobile menu browser checks passed at ${widths.join(", ")}px.`);
}

main().finally(() => browser.kill()).catch(error => { console.error(error); process.exitCode = 1; });
