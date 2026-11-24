"use strict";
// EPK builder laminate (owner 2026-11-16): the backstage pass fills in as the artist types.
// Task 15-B: the band wears the hometown accent and motif; the card shows the city and its city-centre coordinates.
(() => {
  const name = document.getElementById("laminateName"), meta = document.getElementById("laminateMeta"), photo = document.getElementById("laminatePhoto");
  if (!name || !meta || !photo) return;
  const band = document.querySelector(".epk-laminate__band"), laminate = document.querySelector(".epk-laminate");
  let city = document.querySelector(".epk-laminate__city");
  if (!city && meta) { city = document.createElement("span"); city.className = "epk-laminate__city"; city.dataset.noTranslate = ""; meta.after(city); }
  const value = id => (document.getElementById(id)?.value || "").trim();
  const safeImage = url => /^https:\/\/[^\s"'()\\]+$/i.test(url) ? url : "";
  // Black or white text on the band, whichever reads better on the hometown accent.
  const bandText = accent => { const L = window.danzstakHometownLooks; return L && L.contrast("#0b0b0c", accent) >= L.contrast("#ffffff", accent) ? "#0b0b0c" : "#ffffff"; };
  let queued = false;
  function update() {
    queued = false;
    name.textContent = value("artistName") || (window.danzstakTranslate ? window.danzstakTranslate("Your act") : "Your act");
    meta.textContent = [value("genres").split(",")[0].trim(), value("hometown")].filter(Boolean).join(" · ") || "Genre · Home town";
    const hero = document.querySelector("#epkPreview .epk-hero"), heroImage = hero?.style.backgroundImage?.match(/url\(["']?(https:[^"')]+)["']?\)/)?.[1] || "";
    const image = safeImage(value("heroImage")) || safeImage(heroImage);
    photo.style.backgroundImage = image ? `url("${image}")` : "";
    const preview = document.getElementById("epkPreview"), home = preview?.dataset.hometown ? preview.dataset : null;
    if (city) city.textContent = home ? [home.hometownName, home.hometownCoords].filter(Boolean).join(" · ") : "";
    if (band) {
      if (home && home.hometownAccent) { band.style.backgroundColor = home.hometownAccent; band.style.color = bandText(home.hometownAccent); laminate?.style.setProperty("--home-motif", preview.style.getPropertyValue("--home-motif")); }
      else { band.style.removeProperty("background-color"); band.style.removeProperty("color"); laminate?.style.removeProperty("--home-motif"); }
    }
  }
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  document.getElementById("epkForm")?.addEventListener("input", schedule);
  document.getElementById("epkForm")?.addEventListener("change", schedule);
  const preview = document.getElementById("epkPreview");
  if (preview) new MutationObserver(schedule).observe(preview, { childList:true, subtree:true, attributes:true, attributeFilter:["style", "data-hometown"] });
  update();
})();
