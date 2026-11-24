"use strict";
(() => {
  const API = "https://api.danzstak.com";
  const params = new URLSearchParams(location.search);
  const memberId = params.get("member") || "";
  const managing = params.get("manage") === "1";
  const byId = id => document.getElementById(id);
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
  async function uploadPhoto(file) {
    if (!file || !PHOTO_TYPES.includes(file.type)) throw new Error("Choose a JPEG, PNG, WebP or GIF photo.");
    if (file.size > 25 * 1024 * 1024) throw new Error("That photo is over 25 MB. Choose a smaller one.");
    const ticket = await request("/stories", { method: "POST", body: JSON.stringify({ contentType: file.type, purpose: "post" }) });
    if (!ticket.uploadUrl || !ticket.mediaKey) throw new Error("The photo upload could not start. Try again.");
    const upload = await fetch(ticket.uploadUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
    if (!upload.ok) throw new Error("The photo did not upload. Check your connection and try again.");
    return ticket.mediaKey;
  }
  const friendly = (error, fallback) => window.danzstakFriendlyError?.(error, fallback) ?? fallback;
  async function saveShopPhotos(changes, message) {
    if (!currentShop) return;
    const data = await request("/marketplace/shop", { method: "PUT", body: JSON.stringify({ name: currentShop.name, description: currentShop.description || "", status: currentShop.status || "draft", ...changes }) });
    currentShop = { ...currentShop, ...data.shop, products: currentShop.products };
    paintShopPhotos(currentShop); status.textContent = message;
  }
  function paintShopPhotos(shop) {
    const cover = byId("storeCover");
    if (cover) { cover.hidden = !shop?.coverUrl; if (shop?.coverUrl) cover.src = shop.coverUrl; }
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
    const preview = byId("shopCoverPreview");
    preview.hidden = !shop?.coverUrl; if (shop?.coverUrl) preview.src = shop.coverUrl;
    byId("removeShopCover").hidden = !shop?.coverUrl;
    byId("chooseShopCover").textContent = shop?.coverUrl ? "Change cover photo" : "Choose cover photo";
    const editor = byId("shopAlbumEditor");
    editor.replaceChildren(...album.map(photo => {
      const tile = node("figure", "", "shop-album-tile"), img = document.createElement("img"), remove = node("button", "×", "shop-album-remove");
      img.src = photo.url; img.alt = ""; img.loading = "lazy"; img.referrerPolicy = "no-referrer";
      remove.type = "button"; remove.setAttribute("aria-label", "Remove this photo from the album"); remove.title = remove.getAttribute("aria-label");
      remove.addEventListener("click", async () => {
        remove.disabled = true;
        try { await saveShopPhotos({ albumKeys: (currentShop.album || []).map(p => p.key).filter(key => key && key !== photo.key) }, "Photo removed from your shop album."); }
        catch (error) { remove.disabled = false; status.textContent = friendly(error, "The photo could not be removed. Try again."); }
      });
      tile.append(img, remove); return tile;
    }));
    if (!album.length) editor.append(node("p", "Your shop album is empty. Add photos of your merch, your table at shows, your crates.", "store-note"));
  }
  function node(tag, text = "", className = "") { const item = document.createElement(tag); item.textContent = text; if (className) item.className = className; return item; }

  function resetProductForm() {
    byId("productForm").reset(); byId("productId").value = ""; byId("productRevision").value = ""; byId("productShipping").value = "0.00"; byId("productFormTitle").textContent = "Add a physical product"; byId("cancelProductEdit").hidden = true;
    byId("productImageKey").value = ""; byId("productPhotoPreview").hidden = true; byId("chooseProductPhoto").textContent = "Choose photo";
  }
  function editProduct(product) {
    byId("productImageKey").value = product.imageKey || ""; { const preview = byId("productPhotoPreview"); preview.hidden = !product.imageUrl; if (product.imageUrl) preview.src = product.imageUrl; byId("chooseProductPhoto").textContent = product.imageUrl ? "Change photo" : "Choose photo"; }
    byId("productId").value = product.id; byId("productRevision").value = product.revision; byId("productTitle").value = product.title; byId("productDescription").value = product.description; byId("productImage").value = product.imageKey ? "" : product.imageUrl; byId("productPrice").value = (product.priceCents / 100).toFixed(2); byId("productShipping").value = (product.shippingCents / 100).toFixed(2); byId("productInventory").value = product.inventory; byId("productStatus").value = product.status; byId("productFormTitle").textContent = `Edit ${product.title}`; byId("cancelProductEdit").hidden = false; byId("productTitle").focus();
  }
  async function archiveProduct(product) {
    if (!confirm(`Remove ${product.title} from your shop? Existing order records are kept.`)) return;
    try { await request(`/marketplace/products/${encodeURIComponent(product.id)}`, {method:"DELETE"}); status.textContent = `${product.title} removed.`; await load(); } catch (error) { status.textContent = window.danzstakFriendlyError?.(error, "Your shop could not be loaded or saved. Try again in a moment.") ?? "Your shop could not be loaded or saved. Try again in a moment."; }
  }
  function renderProducts(shop) {
    products.replaceChildren();
    if (!shop.products.length) { products.append(node("p", managing ? "No products yet. Add your first physical item below." : "No products are available right now.")); return; }
    for (const product of shop.products) {
      const card = node("article","","product-card");
      if (product.imageUrl) { const image = document.createElement("img"); image.className="product-image"; image.src=product.imageUrl; image.alt=""; image.loading="lazy"; image.referrerPolicy="no-referrer"; card.append(image); }
      const copy=node("div","","product-card-copy"), heading=node("h2",product.title), description=node("p",product.description), price=node("p",money(product.priceCents),"product-price");
      copy.append(heading); if(product.description) copy.append(description); copy.append(price);
      if(product.shippingCents) copy.append(node("p",`Shipping: ${money(product.shippingCents)}`));
      if(managing) {
        copy.append(node("p",`${product.inventory} in stock · ${product.status.replace("_"," ")}`,"product-note"));
        const actions=node("div","","product-actions"), edit=node("button","Edit"), remove=node("button","Remove","store-secondary-action"); edit.type=remove.type="button"; edit.addEventListener("click",()=>editProduct(product)); remove.addEventListener("click",()=>archiveProduct(product)); actions.append(edit,remove); copy.append(actions);
      } else {
        copy.append(node("p",product.available ? "Secure ordering opens after seller verification and payout testing." : "Unavailable","product-note"));
        if(memberId && product.available) { const detail=node("a","View item","product-detail-link"); detail.href=`product.html?id=${encodeURIComponent(product.id)}`; copy.append(detail); }
      }
      card.append(copy); products.append(card);
    }
  }
  function showShop(shop) {
    currentShop = shop; byId("storeTitle").textContent=shop.name; byId("storeDescription").textContent=shop.description || (shop.official ? "Official DanzStak merchandise." : "Physical goods from this DanzStak member."); byId("storeEyebrow").textContent=shop.official ? "Official store" : "Member shop"; document.title=`${shop.name} | DanzStak`; renderProducts(shop);
    paintShopPhotos(shop);
    if(managing) { byId("shopName").value=shop.name||""; byId("shopDescription").value=shop.description||""; byId("shopStatus").value=shop.status||"draft"; productManager.hidden=false; }
  }
  async function load() {
    // Owner 2026-11-15: there is no official DanzStak Store — the Bazaar is the one commerce destination.
    if(!managing && !memberId) { location.replace("bazaar.html"); return; }
    if(managing) { manager.hidden=false; byId("manageShopLink").hidden=true; }
    else if(!memberId) byId("manageShopLink").hidden=false;
    const path=managing?"/marketplace/shop":memberId?`/marketplace/shop/${encodeURIComponent(memberId)}`:"/marketplace/store";
    status.textContent="Loading store…";
    try { const data=await request(path); if(!data?.shop){ const missing=new Error("No shop yet"); missing.status=404; throw missing; } data.shop.products=Array.isArray(data.shop.products)?data.shop.products:[]; showShop(data.shop); status.textContent=data.shop.products.length?`${data.shop.products.length} product${data.shop.products.length===1?"":"s"}.`:"No products are available right now."; }
    catch(error) {
      // SHORTCUT (owner 2026-11-24): "My shop" on the app icon's long-hold opens here. Signed out → the landing page to
      // sign in, then home.js brings the member straight back to their shop manager (danzstak_return_to).
      if(managing && error.status===401) { try { sessionStorage.setItem("danzstak_return_to", "/store.html?manage=1"); } catch { /* sign-in still works */ } location.replace("index.html"); return; }
      if(managing && error.status===404) { currentShop=null; products.replaceChildren(); productManager.hidden=true; status.textContent="Name your shop to open a private draft. Publish it only when it is ready."; return; }
      if(!memberId && !managing && error.status===404) { byId("storeTitle").textContent="DanzStak Store"; products.replaceChildren(); status.textContent="The official store is being stocked. No products are available right now."; return; }
      status.textContent=window.danzstakFriendlyError?.(error, "Your shop could not be loaded or saved. Try again in a moment.") ?? "Your shop could not be loaded or saved. Try again in a moment.";
    }
  }

  byId("shopForm").addEventListener("submit", async event => {
    event.preventDefault(); if(!byId("shopName").value.trim()){ status.textContent="Give your shop a name first."; byId("shopName").focus(); return; } status.textContent="Saving shop…";
    try { const data=await request("/marketplace/shop",{method:"PUT",body:JSON.stringify({name:byId("shopName").value,description:byId("shopDescription").value,status:byId("shopStatus").value})}); currentShop=data.shop; productManager.hidden=false; status.textContent=data.shop.status==="published"?"Shop published on your profile.":"Shop saved as a private draft."; await load(); }
    catch(error){ status.textContent=window.danzstakFriendlyError?.(error, "Your shop could not be loaded or saved. Try again in a moment.") ?? "Your shop could not be loaded or saved. Try again in a moment."; }
  });
  byId("productForm").addEventListener("submit", async event => {
    event.preventDefault(); const price=cents(byId("productPrice").value),shipping=cents(byId("productShipping").value); if(price===null||shipping===null){status.textContent="Enter prices in dollars and cents, for example 25.00.";return;}
    if(shipping>price){status.textContent="Shipping cannot cost more than the item price. DanzStak blocks inflated postage that could hide the sale price.";return;}
    const id=byId("productId").value, payload={title:byId("productTitle").value,description:byId("productDescription").value,imageUrl:byId("productImage").value,priceCents:price,shippingCents:shipping,inventory:Number(byId("productInventory").value),status:byId("productStatus").value,productType:"physical"}; if(byId("productImageKey").value) { payload.imageKey=byId("productImageKey").value; if(!byId("productImage").value) payload.imageUrl=""; } else if (id) payload.imageKey=""; if(id) payload.revision=Number(byId("productRevision").value);
    status.textContent=id?"Saving product…":"Adding product…";
    try { await request(id?`/marketplace/products/${encodeURIComponent(id)}`:"/marketplace/products",{method:id?"PATCH":"POST",body:JSON.stringify(payload)}); resetProductForm(); status.textContent=id?"Product updated.":"Product added."; await load(); }
    catch(error){status.textContent=window.danzstakFriendlyError?.(error, "Your shop could not be loaded or saved. Try again in a moment.") ?? "Your shop could not be loaded or saved. Try again in a moment.";}
  });
  byId("cancelProductEdit").addEventListener("click",resetProductForm);
  if (managing) {
    window.DanzStakFees?.feeChangeBanner(byId("shopManager"));
    paintShopPhotos(null);
    byId("chooseShopCover").addEventListener("click", () => byId("shopCoverInput").click());
    byId("shopCoverInput").addEventListener("change", async event => {
      const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
      const button = byId("chooseShopCover"); button.disabled = true; status.textContent = "Uploading your cover…";
      try { const key = await uploadPhoto(file); await saveShopPhotos({ coverKey: key }, "Cover photo saved."); }
      catch (error) { status.textContent = friendly(error, "The cover could not be saved. Try again."); }
      finally { button.disabled = false; }
    });
    byId("removeShopCover").addEventListener("click", async () => {
      try { await saveShopPhotos({ coverKey: "" }, "Cover removed."); } catch (error) { status.textContent = friendly(error, "The cover could not be removed. Try again."); }
    });
    byId("addAlbumPhotos").addEventListener("click", () => byId("shopAlbumInput").click());
    byId("shopAlbumInput").addEventListener("change", async event => {
      const files = [...(event.target.files || [])].slice(0, 20); event.target.value = ""; if (!files.length) return;
      const button = byId("addAlbumPhotos"); button.disabled = true;
      const keys = [];
      try {
        for (const [index, file] of files.entries()) { status.textContent = `Uploading photo ${index + 1} of ${files.length}…`; keys.push(await uploadPhoto(file)); }
      } catch (error) { status.textContent = friendly(error, "A photo did not upload. Try again."); }
      try { if (keys.length) await saveShopPhotos({ albumKeys: [...(currentShop.album || []).map(p => p.key).filter(Boolean), ...keys] }, `${keys.length} photo${keys.length === 1 ? "" : "s"} added to your shop album.`); }
      catch (error) { status.textContent = friendly(error, "The album could not be saved. Try again."); }
      finally { button.disabled = false; }
    });
    byId("chooseProductPhoto").addEventListener("click", () => byId("productPhotoInput").click());
    byId("productPhotoInput").addEventListener("change", async event => {
      const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
      const button = byId("chooseProductPhoto"); button.disabled = true; status.textContent = "Uploading the product photo…";
      try {
        const key = await uploadPhoto(file); byId("productImageKey").value = key;
        const preview = byId("productPhotoPreview"); preview.src = URL.createObjectURL(file); preview.hidden = false; button.textContent = "Change photo";
        status.textContent = "Photo ready. Save the product to use it.";
      } catch (error) { status.textContent = friendly(error, "The photo did not upload. Try again."); }
      finally { button.disabled = false; }
    });
  }
  byId("productPrice").addEventListener("input",updateFeePreview); byId("productShipping").addEventListener("input",updateFeePreview);
  updateFeePreview();
  load();
})();
