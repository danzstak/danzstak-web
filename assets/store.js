"use strict";
(() => {
  const API = "https://api.danzstak.com";
  const params = new URLSearchParams(location.search);
  const memberId = params.get("member") || "";
  const managing = params.get("manage") === "1";
  const byId = id => document.getElementById(id);
  const t = text => (typeof window.danzstakTranslate === "function" ? window.danzstakTranslate(text) : text) || text;
  const products = byId("storeProducts"), status = byId("storeStatus"), manager = byId("shopManager"), productManager = byId("productManager");
  let currentShop = null;

  async function request(path, options = {}) {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${API}${path}`, { credentials:"include", cache:"no-store", ...options, signal:controller.signal, headers:{ ...(options.body ? {"content-type":"application/json"} : {}), ...(options.headers || {}) } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { const error = new Error(data.error || "The store could not be loaded."); error.status = response.status; throw error; }
      return data;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("The store took too long to respond. Try again.");
      if (error instanceof TypeError || error.message === "Failed to fetch") {
        throw new Error("The store catalog is temporarily unavailable. Your shop data is safe. Try again shortly.");
      }
      throw error;
    } finally { clearTimeout(timeout); }
  }

  function money(cents) { return new Intl.NumberFormat(undefined,{style:"currency",currency:"USD"}).format(Number(cents || 0) / 100); }
  function cents(value) {
    const match = String(value || "").trim().match(/^(\d{1,7})(?:\.(\d{1,2}))?$/);
    if (!match) return null;
    return Number(match[1]) * 100 + Number((match[2] || "").padEnd(2,"0"));
  }
  function updateFeePreview() {
    const price = cents(byId("productPrice").value);
    const shipping = cents(byId("productShipping").value) ?? 0, fees = window.DanzStakFees;
    byId("feePreview").textContent = price === null ? "Enter an item price" : fees ? fees.payoutPreview(price, shipping) : `You get ${money(price + shipping)}`;
  }
  // Owner 2026-11-19: shop photos come from the phone (cover, album, product photos), not only https links.
  const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  async function uploadPhoto(file, purpose = "post") {
    if (!file || !PHOTO_TYPES.includes(file.type)) throw new Error("Choose a JPEG, PNG, WebP or GIF photo.");
    if (file.size > 25 * 1024 * 1024) throw new Error("That photo is over 25 MB. Choose a smaller one.");
    const ticket = await request("/stories", { method: "POST", body: JSON.stringify({ contentType: file.type, purpose }) });
    if (!ticket.uploadUrl || !ticket.mediaKey) throw new Error("The photo upload could not start. Try again.");
    const upload = await fetch(ticket.uploadUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
    if (!upload.ok) throw new Error("The photo did not upload. Check your connection and try again.");
    return ticket.mediaKey;
  }
  const friendly = (error, fallback) => window.danzstakFriendlyError?.(error, fallback) ?? fallback;
  const say = text => { status.textContent = t(text); };
  const fit = () => window.danzstakImagePosition;
  const coverPlace = shop => shop?.coverPosition || fit()?.recall(shop?.coverUrl) || null;
  async function saveShopPhotos(changes, message) {
    if (!currentShop) return;
    const data = await request("/marketplace/shop", { method: "PUT", body: JSON.stringify({ name: currentShop.name, description: currentShop.description || "", status: currentShop.status || "draft", ...changes }) });
    currentShop = { ...currentShop, ...data.shop, products: currentShop.products };
    paintShopPhotos(currentShop); if (message) say(message);
    return currentShop;
  }
  function node(tag, text = "", className = "") { const item = document.createElement(tag); item.textContent = text; if (className) item.className = className; return item; }
  const icon = name => window.danzstakIcon ? window.danzstakIcon(name) : document.createElement("span");

  function paintShopPhotos(shop) {
    const cover = byId("storeCover");
    if (cover) { cover.hidden = !shop?.coverUrl; if (shop?.coverUrl) { cover.src = shop.coverUrl; fit()?.apply(cover, coverPlace(shop), shop.coverUrl); } }
    const album = (shop?.album || []).filter(photo => photo.url);
    const albumSection = byId("shopAlbum"), grid = byId("shopAlbumGrid");
    if (albumSection && grid) {
      grid.replaceChildren(...album.map(photo => { const img = document.createElement("img"); img.src = photo.url; img.alt = ""; img.loading = "lazy"; img.referrerPolicy = "no-referrer"; return img; }));
      albumSection.hidden = managing || !album.length;
    }
    if (!managing) return;
    const ready = Boolean(shop);
    byId("shopPhotosHint").hidden = ready;
    for (const id of ["chooseShopCover", "addAlbumPhotos"]) byId(id).disabled = !ready;
    // Shop front (F21): the picture fills its 16:7 box at the seller's own position (F12).
    const preview = byId("shopCoverPreview");
    preview.hidden = !shop?.coverUrl; byId("shopFrontEmpty").hidden = Boolean(shop?.coverUrl);
    if (shop?.coverUrl) { preview.src = shop.coverUrl; fit()?.apply(preview, coverPlace(shop), shop.coverUrl); }
    byId("removeShopCover").hidden = !shop?.coverUrl;
    byId("moveShopCover").hidden = !shop?.coverUrl || !fit();
    byId("chooseShopCover").querySelector("span").textContent = t(shop?.coverUrl ? "Change" : "Upload");
    const editor = byId("shopAlbumEditor");
    editor.replaceChildren(...album.map(photo => {
      const tile = node("figure", "", "ds-thumb"), img = document.createElement("img"), remove = node("button", "", "ds-icon-btn shop-album-remove");
      img.src = photo.url; img.alt = ""; img.loading = "lazy"; img.referrerPolicy = "no-referrer";
      remove.type = "button"; remove.setAttribute("aria-label", t("Remove this photo from the album")); remove.append(icon("x"));
      remove.addEventListener("click", async () => {
        remove.disabled = true;
        try { await saveShopPhotos({ albumKeys: (currentShop.album || []).map(p => p.key).filter(key => key && key !== photo.key) }, "Photo removed from your shop album."); }
        catch (error) { remove.disabled = false; say(friendly(error, "The photo could not be removed. Try again.")); }
      });
      tile.append(img, remove); return tile;
    }));
    byId("shopAlbumEmpty")?.remove();
    if (!album.length && ready) { const empty = node("p", t("Photos of your merch, your table at shows, your crates."), "ds-status"); empty.id = "shopAlbumEmpty"; editor.after(empty); }
  }

  // ---------- Choosing from a short list (who sees the shop, a listing's state): a kit sheet with one tap per choice.
  const SHOP_STATES = [["draft", "lock", "Private draft", "Only you can see it."], ["published", "globe", "Published on my profile", "On your profile and in the Bazaar."], ["closed", "x", "Closed", "Hidden. Your items and orders are kept."]];
  const LISTING_STATES = [["draft", "lock", "Draft", "Only you can see it."], ["published", "globe", "Published", "In your shop and the Bazaar."], ["sold_out", "x", "Sold out", "Shown, but nobody can order it."]];
  const label = (states, value) => (states.find(([key]) => key === value) || states[0])[2];
  function paintPick(inputId, valueId, states) { byId(valueId).textContent = t(label(states, byId(inputId).value)); }
  function choose(title, states, inputId, valueId) {
    const list = node("div", "", "ds-choices"); list.setAttribute("role", "radiogroup"); list.setAttribute("aria-label", t(title));
    let sheet = null;
    for (const [key, iconName, name, sub] of states) {
      const choice = node("button", "", "ds-choice"); choice.type = "button"; choice.setAttribute("role", "radio"); choice.dataset.value = key;
      choice.setAttribute("aria-checked", String(byId(inputId).value === key));
      const text = node("span", "", "ds-choice__text"); text.append(node("strong", t(name)), node("small", t(sub)));
      const check = node("span", "", "ds-choice__check"); check.append(icon("check"));
      choice.append(icon(iconName), text, check);
      choice.addEventListener("click", () => { byId(inputId).value = key; paintPick(inputId, valueId, states); sheet?.close(); });
      list.append(choice);
    }
    if (window.danzstakSheet) sheet = window.danzstakSheet.open({ title: t(title), content: list });
  }

  // ---------- Products: rows on My shop; a tap opens the product screen.
  const productScreen = byId("productScreen");
  let screenStep = 0;
  function openProductScreen(product) {
    resetProductForm();
    if (product) fillProduct(product);
    productScreen.hidden = false; document.body.classList.add("ds-form-screen-open");
    // The phone's Back closes the screen (one history step), as the Create event screen does.
    screenStep = Date.now(); history.pushState({ ...(history.state && typeof history.state === "object" ? history.state : {}), shopProduct: screenStep }, "");
    // A new product starts on its name; an edit opens without the keyboard jumping up.
    if (product) byId("closeProductScreen").focus({ preventScroll: true }); else byId("productTitle").focus({ preventScroll: true });
  }
  function closeProductScreen({ fromHistory = false } = {}) {
    if (productScreen.hidden) return;
    if (!fromHistory && history.state?.shopProduct === screenStep) { history.back(); return; }
    productScreen.hidden = true; document.body.classList.remove("ds-form-screen-open"); screenStep = 0;
    byId("addProduct")?.focus({ preventScroll: true });
  }
  addEventListener("popstate", () => {
    if (window.danzstakSheet?.isOpen()) return; // a sheet on the screen closes first
    if (!productScreen.hidden && history.state?.shopProduct !== screenStep) closeProductScreen({ fromHistory: true });
  });
  const screenSay = text => { byId("productScreenStatus").textContent = t(text); };
  function setProductPhoto(url) {
    const preview = byId("productPhotoPreview");
    preview.hidden = !url; byId("productPhotoEmpty").hidden = Boolean(url); if (url) preview.src = url; else preview.removeAttribute("src");
    byId("chooseProductPhoto").querySelector("span").textContent = t(url ? "Change photo" : "Choose photo");
  }
  function resetProductForm() {
    byId("productForm").reset(); byId("productId").value = ""; byId("productRevision").value = ""; byId("productShipping").value = "0.00"; byId("productStatus").value = "draft";
    byId("productFormTitle").textContent = t("Add a product"); byId("removeProduct").hidden = true;
    byId("productImageKey").value = ""; setProductPhoto(""); screenSay("");
    for (const id of ["productTitleError", "productNumbersError"]) byId(id).textContent = "";
    for (const id of ["productTitle", "productPrice", "productShipping"]) byId(id).removeAttribute("aria-invalid");
    paintPick("productStatus", "productStatusValue", LISTING_STATES); updateFeePreview();
  }
  let editing = null;
  function fillProduct(product) {
    editing = product;
    byId("productImageKey").value = product.imageKey || ""; setProductPhoto(product.imageUrl || "");
    byId("productId").value = product.id; byId("productRevision").value = product.revision; byId("productTitle").value = product.title; byId("productDescription").value = product.description; byId("productImage").value = product.imageKey ? "" : product.imageUrl;
    byId("productPrice").value = (product.priceCents / 100).toFixed(2); byId("productShipping").value = (product.shippingCents / 100).toFixed(2); byId("productInventory").value = product.inventory; byId("productStatus").value = product.status;
    byId("productFormTitle").textContent = `${t("Edit")} ${product.title}`; byId("removeProduct").hidden = false;
    paintPick("productStatus", "productStatusValue", LISTING_STATES); updateFeePreview();
  }
  // Asks in a kit sheet (no browser confirm box): Remove from shop / Keep it.
  function archiveProduct(product) {
    if (!window.danzstakSheet) return;
    const body = node("div"), actions = node("div", "", "ds-actions");
    const remove = node("button", t("Remove from shop"), "ds-btn ds-btn--danger ds-btn--block"); remove.type = "button"; remove.id = "confirmRemoveProduct";
    const keep = node("button", t("Keep it"), "ds-btn ds-btn--quiet ds-btn--block"); keep.type = "button";
    const note = node("p", t("Existing order records are kept."), "ds-note");
    actions.append(remove, keep); body.append(note, actions);
    let removed = false;
    // The screen closes once the sheet's own Back step has gone, so the two history steps unwind in order.
    const sheet = window.danzstakSheet.open({ title: `${t("Remove")} ${product.title}?`, content: body, onClose: () => { if (removed) closeProductScreen(); } });
    keep.addEventListener("click", () => sheet.close());
    remove.addEventListener("click", async () => {
      remove.disabled = keep.disabled = true;
      try {
        await request(`/marketplace/products/${encodeURIComponent(product.id)}`, {method:"DELETE"});
        removed = true; sheet.close(); say(`${product.title} ${t("removed.")}`); await load();
      } catch (error) { remove.disabled = keep.disabled = false; note.textContent = friendly(error, "Your shop could not be loaded or saved. Try again in a moment."); }
    });
  }
  function productRow(product) {
    const row = node("article", "", "ds-row ds-row--square");
    const target = node("button", "", "ds-row__target"); target.type = "button"; target.setAttribute("aria-label", `${t("Edit")} ${product.title}`);
    target.addEventListener("click", () => openProductScreen(product));
    const photo = node("span", "", "ds-row__avatar"), frame = node("span", "", "ds-row__photo");
    if (product.imageUrl) { const image = document.createElement("img"); image.src = product.imageUrl; image.alt = ""; image.loading = "lazy"; image.referrerPolicy = "no-referrer"; frame.append(image); }
    else frame.append(icon("image"));
    photo.append(frame);
    const body = node("span", "", "ds-row__body");
    body.append(node("strong", product.title, "ds-row__text"), node("span", [money(product.priceCents), `${product.inventory} ${t("in stock")}`, t(label(LISTING_STATES, product.status))].join(" · "), "ds-row__time"));
    const chev = node("span", "", "ds-row__chev"); chev.append(icon("chevron-right"));
    row.append(target, photo, body, chev);
    return row;
  }
  function renderProducts(shop) {
    if (managing) {
      const list = byId("productList");
      list.replaceChildren(...shop.products.map(productRow));
      if (!shop.products.length) list.append(node("p", t("No products yet. Add your first physical item."), "ds-status"));
      return;
    }
    products.replaceChildren();
    if (!shop.products.length) { products.append(node("p", "No products are available right now.")); return; }
    for (const product of shop.products) {
      const card = node("article","","product-card");
      if (product.imageUrl) { const image = document.createElement("img"); image.className="product-image"; image.src=product.imageUrl; image.alt=""; image.loading="lazy"; image.referrerPolicy="no-referrer"; card.append(image); }
      const copy=node("div","","product-card-copy"), heading=node("h2",product.title), description=node("p",product.description), price=node("p",money(product.priceCents),"product-price");
      copy.append(heading); if(product.description) copy.append(description); copy.append(price);
      if(product.shippingCents) copy.append(node("p",`Shipping: ${money(product.shippingCents)}`));
      copy.append(node("p",product.available ? "Secure ordering opens after seller verification and payout testing." : "Unavailable","product-note"));
      if(memberId && product.available) { const detail=node("a","View item","product-detail-link"); detail.href=`product.html?id=${encodeURIComponent(product.id)}`; copy.append(detail); }
      card.append(copy); products.append(card);
    }
  }
  function showShop(shop) {
    currentShop = shop; byId("storeTitle").textContent=shop.name; byId("storeDescription").textContent=shop.description || (shop.official ? "Official DanzStak merchandise." : "Physical goods from this DanzStak member."); byId("storeEyebrow").textContent=shop.official ? "Official store" : "Member shop"; document.title=`${shop.name} | DanzStak`; renderProducts(shop);
    paintShopPhotos(shop);
    if(managing) {
      byId("shopName").value=shop.name||""; byId("shopDescription").value=shop.description||""; byId("shopStatus").value=shop.status||"draft"; paintPick("shopStatus", "shopStatusValue", SHOP_STATES);
      productManager.hidden=false;
      if (shop.memberId) byId("viewShopLink").href = `profile.html?member=${encodeURIComponent(shop.memberId)}`;
    }
  }
  async function load() {
    // Owner 2026-11-15: there is no official DanzStak Store — the Bazaar is the one commerce destination.
    if(!managing && !memberId) { location.replace("bazaar.html"); return; }
    if(managing) { manager.hidden=false; byId("manageShopLink").hidden=true; }
    else if(!memberId) byId("manageShopLink").hidden=false;
    const path=managing?"/marketplace/shop":memberId?`/marketplace/shop/${encodeURIComponent(memberId)}`:"/marketplace/store";
    if (!managing) status.textContent="Loading store…";
    try {
      const data=await request(path); if(!data?.shop){ const missing=new Error("No shop yet"); missing.status=404; throw missing; }
      data.shop.products=Array.isArray(data.shop.products)?data.shop.products:[]; showShop(data.shop);
      if (!managing) status.textContent=data.shop.products.length?`${data.shop.products.length} product${data.shop.products.length===1?"":"s"}.`:"No products are available right now.";
    }
    catch(error) {
      // SHORTCUT (owner 2026-11-24): "My shop" on the app icon's long-hold opens here. Signed out → the landing page to
      // sign in, then home.js brings the member straight back to their shop manager (danzstak_return_to).
      if(managing && error.status===401) { try { sessionStorage.setItem("danzstak_return_to", "/store.html?manage=1"); } catch { /* sign-in still works */ } location.replace("index.html"); return; }
      if(managing && error.status===404) { currentShop=null; byId("productList").replaceChildren(); productManager.hidden=true; paintShopPhotos(null); say("Name your shop to open a private draft. Publish it only when it is ready."); return; }
      if(!memberId && !managing && error.status===404) { byId("storeTitle").textContent="DanzStak Store"; products.replaceChildren(); status.textContent="The official store is being stocked. No products are available right now."; return; }
      status.textContent=friendly(error, "Your shop could not be loaded or saved. Try again in a moment.");
    }
  }

  // ---------- Shop front (F21): upload in the shop, Move to fit, then offer it to the profile.
  const frontAspect = () => { const box = document.querySelector(".shop-front")?.getBoundingClientRect(); return box?.width && box.height ? box.width / box.height : 16 / 7; };
  async function placeFront(src, position) {
    const place = fit();
    if (!place) return { x: 50, y: 50, zoom: 1 };
    return await place.open({ src, aspect: frontAspect(), position, title: "Move your shop front" });
  }
  // "Use this as your shop front on your profile?" Replace puts the same picture (its own copy, so either can be
  // changed or deleted alone) in the profile's photo band at the same position; Keep shop only leaves the profile.
  function offerToProfile(file, position, url) {
    if (!window.danzstakSheet) return;
    const body = node("div");
    // The same 16:7 frame as the profile band, clipped, so the zoom the seller chose shows as it will on the profile.
    const preview = node("span", "", "ds-sheet__preview"), picture = document.createElement("img"); picture.alt = ""; picture.src = url; fit()?.apply(picture, position, url); preview.append(picture);
    const actions = node("div", "", "ds-actions");
    const replace = node("button", t("Replace"), "ds-btn ds-btn--go ds-btn--block"); replace.type = "button"; replace.id = "shopFrontReplace";
    const keep = node("button", t("Keep shop only"), "ds-btn ds-btn--quiet ds-btn--block"); keep.type = "button"; keep.id = "shopFrontKeep";
    const note = node("p", t("It will replace the photo on your profile (and its link)."), "ds-note");
    actions.append(replace, keep);
    body.append(preview, note, actions);
    const sheet = window.danzstakSheet.open({ title: t("Use this as your shop front on your profile?"), content: body });
    keep.addEventListener("click", () => { sheet.close(); say("Shop front saved. Your profile is unchanged."); });
    replace.addEventListener("click", async () => {
      replace.disabled = keep.disabled = true; replace.textContent = t("Saving…");
      try {
        const key = await uploadPhoto(file, "profile"), p = fit()?.normalize(position) || { x: 50, y: 50, zoom: 1 };
        await request("/profiles", { method: "POST", body: JSON.stringify({ showcaseKey: key, showcaseX: p.x, showcaseY: p.y, showcaseZoom: p.zoom }) });
        sheet.close(); say("Shop front saved and on your profile.");
      } catch (error) {
        replace.disabled = keep.disabled = false; replace.textContent = t("Replace");
        note.textContent = friendly(error, "Your profile couldn't be updated. Your shop front is saved. Try again.");
      }
    });
  }

  function fieldError(inputId, errorId, text) {
    byId(errorId).textContent = text ? t(text) : "";
    if (text) { byId(inputId).setAttribute("aria-invalid", "true"); byId(inputId).focus(); } else byId(inputId).removeAttribute("aria-invalid");
  }
  byId("shopForm").addEventListener("submit", async event => {
    event.preventDefault();
    if(!byId("shopName").value.trim()){ fieldError("shopName", "shopNameError", "Give your shop a name first."); return; }
    fieldError("shopName", "shopNameError", ""); say("Saving shop…");
    try { const data=await request("/marketplace/shop",{method:"PUT",body:JSON.stringify({name:byId("shopName").value,description:byId("shopDescription").value,status:byId("shopStatus").value})}); currentShop=data.shop; productManager.hidden=false; await load(); say(data.shop.status==="published"?"Shop published on your profile.":"Shop saved as a private draft."); }
    catch(error){ say(friendly(error, "Your shop could not be loaded or saved. Try again in a moment.")); }
  });
  byId("productForm").addEventListener("submit", async event => {
    event.preventDefault();
    if (!byId("productTitle").value.trim()) { fieldError("productTitle", "productTitleError", "Give the product a name."); return; }
    fieldError("productTitle", "productTitleError", "");
    const price=cents(byId("productPrice").value),shipping=cents(byId("productShipping").value), numbers = byId("productNumbersError");
    if(price===null||shipping===null){ numbers.textContent=t("Enter prices in dollars and cents, for example 25.00."); byId(price===null?"productPrice":"productShipping").focus(); return; }
    if(shipping>price){ numbers.textContent=t("Shipping cannot cost more than the item price. DanzStak blocks inflated postage that could hide the sale price."); byId("productShipping").focus(); return; }
    if(!/^\d{1,5}$/.test(String(byId("productInventory").value).trim())){ numbers.textContent=t("How many do you have? Enter a number."); byId("productInventory").focus(); return; }
    numbers.textContent = "";
    const id=byId("productId").value, payload={title:byId("productTitle").value,description:byId("productDescription").value,imageUrl:byId("productImage").value,priceCents:price,shippingCents:shipping,inventory:Number(byId("productInventory").value),status:byId("productStatus").value,productType:"physical"}; if(byId("productImageKey").value) { payload.imageKey=byId("productImageKey").value; if(!byId("productImage").value) payload.imageUrl=""; } else if (id) payload.imageKey=""; if(id) payload.revision=Number(byId("productRevision").value);
    const save = byId("saveProduct"); save.disabled = true; screenSay(id?"Saving product…":"Adding product…");
    try { await request(id?`/marketplace/products/${encodeURIComponent(id)}`:"/marketplace/products",{method:id?"PATCH":"POST",body:JSON.stringify(payload)}); closeProductScreen(); say(id?"Product updated.":"Product added."); await load(); }
    catch(error){ screenSay(friendly(error, "Your shop could not be loaded or saved. Try again in a moment.")); }
    finally { save.disabled = false; }
  });
  if (managing) {
    // My shop is a kit screen: the public hero and grid stay out of it; the status line sits under the title.
    document.querySelector(".store-hero").hidden = true; products.hidden = true;
    document.getElementById("storeMain").classList.add("store-main--kit");
    status.className = "ds-status"; status.textContent = ""; byId("shopStatusSlot").append(status);
    const banner = window.DanzStakFees?.feeChangeBanner(byId("shopManager"));
    banner?.querySelector("button")?.classList.add("ds-btn", "ds-btn--quiet");
    if (banner) byId("shopStatusSlot").after(banner);
    paintShopPhotos(null);
    paintPick("shopStatus", "shopStatusValue", SHOP_STATES); paintPick("productStatus", "productStatusValue", LISTING_STATES);
    byId("shopStatusPick").addEventListener("click", () => choose("Who can see it?", SHOP_STATES, "shopStatus", "shopStatusValue"));
    byId("productStatusPick").addEventListener("click", () => choose("Listing", LISTING_STATES, "productStatus", "productStatusValue"));
    byId("addProduct").addEventListener("click", () => openProductScreen(null));
    byId("closeProductScreen").addEventListener("click", () => closeProductScreen());
    byId("removeProduct").addEventListener("click", () => { if (editing) archiveProduct(editing); });
    productScreen.addEventListener("keydown", event => { if (event.key === "Escape" && !window.danzstakSheet?.isOpen()) { event.preventDefault(); closeProductScreen(); } });

    byId("chooseShopCover").addEventListener("click", () => byId("shopCoverInput").click());
    byId("shopCoverInput").addEventListener("change", async event => {
      const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
      if (!PHOTO_TYPES.includes(file.type)) { say("Choose a JPEG, PNG, WebP or GIF photo."); return; }
      const position = await placeFront(file, null);
      if (!position) return; // Cancel: nothing changes
      const button = byId("chooseShopCover"); button.disabled = true; say("Uploading your shop front…");
      try {
        const key = await uploadPhoto(file), p = fit()?.normalize(position) || position;
        const shop = await saveShopPhotos({ coverKey: key, coverX: p.x, coverY: p.y, coverZoom: p.zoom }, "Shop front saved.");
        if (shop && !shop.coverPosition) fit()?.remember(shop.coverUrl, p); // before the Auth API keeps positions
        if (shop?.coverUrl) { paintShopPhotos(shop); offerToProfile(file, p, shop.coverUrl); }
      } catch (error) { say(friendly(error, "The cover could not be saved. Try again.")); }
      finally { button.disabled = false; }
    });
    byId("moveShopCover").addEventListener("click", async () => {
      if (!currentShop?.coverUrl) return;
      const position = await placeFront(currentShop.coverUrl, coverPlace(currentShop));
      if (!position) return;
      const p = fit().normalize(position);
      try {
        const shop = await saveShopPhotos({ coverX: p.x, coverY: p.y, coverZoom: p.zoom }, "Shop front moved.");
        if (!shop?.coverPosition) { fit().remember(shop.coverUrl, p); paintShopPhotos(shop); say("Saved on this phone. Everyone else sees it after DanzStak's next update."); }
      } catch (error) { say(friendly(error, "That position couldn't be saved. Try again.")); }
    });
    byId("removeShopCover").addEventListener("click", async () => {
      try { await saveShopPhotos({ coverKey: "" }, "Shop front removed."); } catch (error) { say(friendly(error, "The cover could not be removed. Try again.")); }
    });
    byId("addAlbumPhotos").addEventListener("click", () => byId("shopAlbumInput").click());
    byId("shopAlbumInput").addEventListener("change", async event => {
      const files = [...(event.target.files || [])].slice(0, 20); event.target.value = ""; if (!files.length) return;
      const button = byId("addAlbumPhotos"); button.disabled = true;
      const keys = [];
      try {
        for (const [index, file] of files.entries()) { say(`${t("Uploading photo")} ${index + 1} / ${files.length}…`); keys.push(await uploadPhoto(file)); }
      } catch (error) { say(friendly(error, "A photo did not upload. Try again.")); }
      try { if (keys.length) await saveShopPhotos({ albumKeys: [...(currentShop.album || []).map(p => p.key).filter(Boolean), ...keys] }, keys.length === 1 ? "1 photo added to your shop album." : `${keys.length} ${t("photos added to your shop album.")}`); }
      catch (error) { say(friendly(error, "The album could not be saved. Try again.")); }
      finally { button.disabled = false; }
    });
    byId("chooseProductPhoto").addEventListener("click", () => byId("productPhotoInput").click());
    byId("productPhotoInput").addEventListener("change", async event => {
      const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
      const button = byId("chooseProductPhoto"); button.disabled = true; screenSay("Uploading the product photo…");
      try {
        const key = await uploadPhoto(file); byId("productImageKey").value = key;
        setProductPhoto(URL.createObjectURL(file));
        screenSay("Photo ready. Save the product to use it.");
      } catch (error) { screenSay(friendly(error, "The photo did not upload. Try again.")); }
      finally { button.disabled = false; }
    });
  }
  byId("productPrice").addEventListener("input",updateFeePreview); byId("productShipping").addEventListener("input",updateFeePreview);
  updateFeePreview();
  load();
})();
