// Directive F12: "Move to fit" on the profile cover opens the shared sheet (image-position.js) instead of dragging the
// cover in place. Checks moveProfileCover(): zero coordinates survive, Cancel saves nothing, a failed save puts the cover
// back, a cover is needed first, and a profile kept in this browser saves locally.
const fs = require("node:fs"), vm = require("node:vm"), assert = require("node:assert/strict");
const source = fs.readFileSync("assets/profile-editor.js", "utf8").replace(/\r\n/g, "\n"); // CRLF on Windows checkouts
// The saving flag is declared just above; "var" here so the check can read it from the context. Positions built inside
// the context are compared as plain JSON (another realm).
assert.match(source, /let coverPositionSaving = false;\nconst readLocalProfileMedia/);
const code = "var coverPositionSaving = false;\n" + source.slice(source.indexOf("const readLocalProfileMedia"), source.indexOf('repositionButton.addEventListener("click"'));
assert.ok(code.includes("async function moveProfileCover()"), "the cover is moved with the shared sheet");
assert.doesNotMatch(source, /coverElement\.addEventListener\("pointer(down|move|up)"/, "no second drag system on the cover itself");

function harness({ cloud = true, photo = true, chosen = { x: 0, y: 80, zoom: 1.5 }, saveError = false, storageError = false } = {}) {
  const saves = [], applied = [], alerts = [], opened = [];
  let stored = JSON.stringify({ cover: "data:image/png;base64,AAAA", coverX: 10, coverY: 20, coverZoom: 1 });
  const context = vm.createContext({
    window: { danzstakCurrentProfile: cloud ? { cloudProfile: true, cover: "https://cdn.example/users/a/cover.jpg", coverX: 30, coverY: 40, coverZoom: 1.2 } : { cloudProfile: false } },
    profileMediaKey: "media",
    localStorage: { getItem: () => stored, setItem: (_, value) => { if (storageError) throw Error("quota"); stored = value; } },
    coverElement: { classList: { contains: () => photo }, getBoundingClientRect: () => ({ width: 390, height: 130 }) },
    fitPictures: () => ({
      normalize: p => ({ x: p.x ?? 50, y: p.y ?? 50, zoom: p.zoom ?? 1 }),
      open: async options => { opened.push(options); return chosen; },
      apply: (element, position, url) => applied.push({ position, url })
    }),
    profilePlace: profile => ({ x: profile.coverX, y: profile.coverY, zoom: profile.coverZoom }),
    saveProfilePlace: async (kind, position) => { saves.push({ kind, position }); if (saveError) throw Error("Server rejected save"); return { cloudProfile: true, coverX: position.x, coverY: position.y, coverZoom: position.zoom }; },
    showProfileFeedback: message => alerts.push(message)
  });
  vm.runInContext(code, context);
  return { context, saves, applied, alerts, opened, stored: () => JSON.parse(stored) };
}

(async () => {
  let run = harness();
  await run.context.moveProfileCover();
  assert.equal(run.opened[0].aspect, 3, "the preview is the cover's own box (390 × 130)");
  assert.deepEqual(run.opened[0].position, { x: 30, y: 40, zoom: 1.2 }, "the sheet opens where the cover sits now");
  assert.deepEqual(run.saves[0], { kind: "cover", position: { x: 0, y: 80, zoom: 1.5 } }, "zero coordinates and the zoom are saved");
  assert.deepEqual(run.applied[0].position, { x: 0, y: 80, zoom: 1.5 });
  assert.equal(run.context.window.danzstakCurrentProfile.coverX, 0);
  assert.equal(run.context.coverPositionSaving, false);

  run = harness({ chosen: null });
  await run.context.moveProfileCover();
  assert.equal(run.saves.length, 0, "Cancel saves nothing");
  assert.equal(run.applied.length, 0, "Cancel leaves the cover as it was");

  run = harness({ saveError: true });
  await run.context.moveProfileCover();
  assert.deepEqual(JSON.parse(JSON.stringify(run.applied.map(entry => entry.position))), [{ x: 0, y: 80, zoom: 1.5 }, { x: 30, y: 40, zoom: 1.2 }], "a failed save puts the cover back");
  assert.deepEqual(run.alerts, ["Server rejected save"]);
  assert.equal(run.context.coverPositionSaving, false);

  run = harness({ photo: false });
  await run.context.moveProfileCover();
  assert.equal(run.opened.length, 0);
  assert.deepEqual(run.alerts, ["Add a cover photo first."]);

  run = harness({ cloud: false, chosen: { x: 5, y: 95, zoom: 2 } });
  await run.context.moveProfileCover();
  assert.deepEqual([run.stored().coverX, run.stored().coverY, run.stored().coverZoom], [5, 95, 2], "a browser-kept profile saves locally");
  assert.equal(run.saves.length, 0);

  run = harness({ cloud: false, storageError: true });
  await run.context.moveProfileCover();
  assert.deepEqual(JSON.parse(JSON.stringify(run.applied.map(entry => entry.position))), [{ x: 0, y: 80, zoom: 1.5 }, { x: 10, y: 20, zoom: 1 }], "a failed local save restores the prior cover");
  assert.equal(run.alerts.length, 1);
  console.log("Cover position checks passed: the shared sheet opens at the cover's box and position, zero coordinates and zoom save, Cancel saves nothing, failures restore the cover, browser-kept profiles save locally.");
})().catch(error => { console.error(error); process.exitCode = 1; });
