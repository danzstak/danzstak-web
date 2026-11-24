// Spec 47, Train A (owner 2026-11-24: "need a way to see my previous published epk").
// - The line under Publish says what venues see: the version published on a date, and whether the builder holds a draft.
// - "Published versions" lists what venues saw each time the artist published (the server keeps the newest 20):
//   View opens that version as venues saw it (only its owner can), Bring back loads it into the builder as a draft.
// The builder (assets/epk.js) hands over fill/request through window.danzstakEpkBuilder and calls show() after each
// load and save. Text goes through i18n.js like the rest of the page.
(() => {
  "use strict";
  const byId = id => document.getElementById(id);
  const builder = () => window.danzstakEpkBuilder || {};
  const when = iso => {
    const date = new Date(iso);
    if (!iso || Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(document.documentElement.lang || undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
  };

  function show(data = {}) {
    const line = byId("epkPublishState"), open = byId("epkVersionsOpen");
    if (open) open.hidden = !(data.publicId || data.kit);
    if (!line) return;
    const date = when(data.publishedAt);
    let text = "";
    if (data.published && data.draftChanged) text = date ? `Venues see the version you published on ${date}. Your changes are a draft.` : "Venues see your published EPK. Your changes are a draft.";
    else if (data.published) text = date ? `Published on ${date}.` : "Published.";
    line.textContent = text;
    line.hidden = !text;
  }

  async function load(url) {
    const { request, api } = builder();
    const response = await request(`${api}${url}`, { credentials: "include", cache: "no-store" }, 15000);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "The published versions could not be loaded.");
    return data;
  }

  async function bringBack(id, publishedAt) {
    const confirmed = await window.danzstakConfirm?.("The builder will show this version. Your saved draft stays as it is until you save again.", {
      title: "Bring back this version?", confirmLabel: "Bring it back", cancelLabel: "Cancel"
    });
    if (confirmed === false) return false;
    const data = await load(`/epk?version=${encodeURIComponent(id)}`);
    builder().fill?.(data.kit || {});
    const status = byId("epkStatus"), date = when(data.publishedAt || publishedAt);
    if (status) status.textContent = date ? `Brought back the version you published on ${date}. Save the draft, or publish it to make it live again.` : "Brought back a published version. Save the draft, or publish it to make it live again.";
    return true;
  }

  function versionRow(version, index) {
    const row = document.createElement("li");
    row.className = "epk-version";
    const label = document.createElement("span");
    label.className = "epk-version__when";
    label.textContent = when(version.publishedAt) || version.publishedAt;
    if (index === 0) {
      const latest = document.createElement("span");
      latest.className = "epk-version__latest";
      latest.textContent = "Latest";
      label.append(" ", latest);
    }
    const view = document.createElement("a");
    view.className = "epk-version__view";
    view.href = `epk.html?version=${encodeURIComponent(version.id)}`;
    view.textContent = "View";
    const back = document.createElement("button");
    back.type = "button";
    back.className = "epk-version__back primary";
    back.textContent = "Bring back";
    back.addEventListener("click", async () => {
      back.disabled = true;
      try { if (await bringBack(version.id, version.publishedAt)) close(); }
      catch (error) { byId("epkVersionsStatus").textContent = error.message; }
      finally { back.disabled = false; }
    });
    row.append(label, view, back);
    return row;
  }

  function close() {
    const dialog = byId("epkVersionsDialog");
    if (typeof dialog?.close === "function") dialog.close(); else dialog?.removeAttribute("open");
  }

  async function openList() {
    const dialog = byId("epkVersionsDialog"), list = byId("epkVersionsList"), status = byId("epkVersionsStatus");
    list.replaceChildren();
    status.textContent = "Loading your published versions...";
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
    try {
      const { versions = [] } = await load("/epk?versions=1");
      list.replaceChildren(...versions.map(versionRow));
      status.textContent = versions.length ? "" : "Nothing published yet. Each time you publish, that version is kept here.";
    } catch (error) { status.textContent = error.message; }
  }

  // A version opened from the list (epk.html?version=<id>) or a "Bring back" link from that page (?restore=<id>).
  async function restoreFromLink() {
    const id = new URLSearchParams(location.search).get("restore");
    if (!id) return;
    try { await bringBack(id, ""); }
    catch (error) { const status = byId("epkStatus"); if (status) status.textContent = error.message; }
    history.replaceState(history.state, "", "epk.html");
  }

  document.addEventListener("DOMContentLoaded", () => {
    byId("epkVersionsOpen")?.addEventListener("click", openList);
    byId("epkVersionsClose")?.addEventListener("click", close);
  });

  window.danzstakEpkVersions = { show, restoreFromLink, when };
})();
