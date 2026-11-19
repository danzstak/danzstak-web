"use strict";
// EPK builder laminate (owner 2026-11-16): the backstage pass fills in as the artist types.
(() => {
  const name = document.getElementById("laminateName"), meta = document.getElementById("laminateMeta"), photo = document.getElementById("laminatePhoto");
  if (!name || !meta || !photo) return;
  const value = id => (document.getElementById(id)?.value || "").trim();
  const safeImage = url => /^https:\/\/[^\s"'()\\]+$/i.test(url) ? url : "";
  let queued = false;
  function update() {
    queued = false;
    name.textContent = value("artistName") || (window.danzstakTranslate ? window.danzstakTranslate("Your act") : "Your act");
    meta.textContent = [value("genres").split(",")[0].trim(), value("hometown")].filter(Boolean).join(" · ") || "Genre · Home town";
    const hero = document.querySelector("#epkPreview .epk-hero"), heroImage = hero?.style.backgroundImage?.match(/url\(["']?(https:[^"')]+)["']?\)/)?.[1] || "";
    const image = safeImage(value("heroImage")) || safeImage(heroImage);
    photo.style.backgroundImage = image ? `url("${image}")` : "";
  }
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  document.getElementById("epkForm")?.addEventListener("input", schedule);
  const preview = document.getElementById("epkPreview");
  if (preview) new MutationObserver(schedule).observe(preview, { childList:true, subtree:true, attributes:true, attributeFilter:["style"] });
  update();
})();
