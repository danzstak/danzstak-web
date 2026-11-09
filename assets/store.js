"use strict";
(() => {
  const API = "https://api.danzstak.com";
  const params = new URLSearchParams(location.search);
  const memberId = params.get("member") || "";
  const managing = params.get("manage") === "1";
  const browsingBazaar = params.get("view") === "bazaar";
  const selectedProductId = params.get("product") || "";
  const byId = id => document.getElementById(id);
  const products = byId("storeProducts"), status = byId("storeStatus"), manager = byId("shopManager"), productManager = byId("productManager");
  let currentShop = null;
  let bazaarListings = [], bazaarNextCursor = "";

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
  function node(tag, text = "", className = "") { const item = document.createElement(tag); item.textContent = text; if (className) item.className = className; return item; }

  function memberProductUrl(product) {
    const query = new URLSearchParams({ member: product.memberId || memberId, product: product.id });
    return `store.html?${query}`;
  }

  function productImage(product, destination = "") {
    if (!product.imageUrl) return null;
    const image = document.createElement("img");
    image.className = "product-image";
    image.src = product.imageUrl;
    image.alt = "";
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    if (!destination) return image;
    const link = document.createElement("a");
    link.className = "product-image-link";
    link.href = destination;
    link.setAttribute("aria-label", `Open ${product.title} in ${product.shopName || "the member shop"}`);
    link.append(image);
    return link;
  }

  function resetProductForm() {
    byId("productForm").reset(); byId("productId").value = ""; byId("productRevision").value = ""; byId("productShipping").value = "0.00"; byId("productFormTitle").textContent = "Add a physical product"; byId("cancelProductEdit").hidden = true;
  }
  function editProduct(product) {
    byId("productId").value = product.id; byId("productRevision").value = product.revision; byId("productTitle").value = product.title; byId("productDescription").value = product.description; byId("productImage").value = product.imageUrl; byId("productPrice").value = (product.priceCents / 100).toFixed(2); byId("productShipping").value = (product.shippingCents / 100).toFixed(2); byId("productInventory").value = product.inventory; byId("productStatus").value = product.status; byId("productFormTitle").textContent = `Edit ${product.title}`; byId("cancelProductEdit").hidden = false; byId("productTitle").focus();
  }
  async function archiveProduct(product) {
    if (!confirm(`Remove ${product.title} from your shop? Existing order records are kept.`)) return;
    try { await request(`/marketplace/products/${encodeURIComponent(product.id)}`, {method:"DELETE"}); status.textContent = `${product.title} removed.`; await load(); } catch (error) { status.textContent = error.message; }
  }
  function renderProducts(shop) {
    products.replaceChildren();
    if (!shop.products.length) { products.append(node("p", managing ? "No products yet. Add your first physical item below." : "No products are available right now.")); return; }
    for (const product of shop.products) {
      const card = node("article","","product-card");
      card.id = `product-${product.id}`;
      card.dataset.productId = product.id;
      const image = productImage(product);
      if (image) card.append(image);
      const copy=node("div","","product-card-copy"), heading=node("h2",product.title), description=node("p",product.description), price=node("p",money(product.priceCents),"product-price");
      copy.append(heading); if(product.description) copy.append(description); copy.append(price);
      if(product.shippingCents) copy.append(node("p",`Shipping: ${money(product.shippingCents)}`));
      if(managing) {
        copy.append(node("p",`${product.inventory} in stock · ${product.status.replace("_"," ")}`,"product-note"));
        const actions=node("div","","product-actions"), edit=node("button","Edit"), remove=node("button","Remove","store-secondary-action"); edit.type=remove.type="button"; edit.addEventListener("click",()=>editProduct(product)); remove.addEventListener("click",()=>archiveProduct(product)); actions.append(edit,remove); copy.append(actions);
      } else copy.append(node("p",product.available ? "Secure ordering opens after seller verification and payout testing." : "Unavailable","product-note"));
      card.append(copy); products.append(card);
    }
    if (selectedProductId) {
      const selected = document.getElementById(`product-${CSS.escape(selectedProductId)}`);
      if (selected) {
        selected.classList.add("selected-product");
        requestAnimationFrame(() => selected.scrollIntoView({ block:"center" }));
      }
    }
  }

  function renderBazaar() {
    const query = byId("bazaarSearch").value.trim().toLocaleLowerCase();
    const visible = query ? bazaarListings.filter(product => `${product.title} ${product.description} ${product.shopName}`.toLocaleLowerCase().includes(query)) : bazaarListings;
    products.replaceChildren();
    for (const product of visible) {
      const destination = memberProductUrl(product);
      const card = node("article", "", "product-card bazaar-card");
      card.dataset.productId = product.id;
      const image = productImage(product, destination);
      if (image) card.append(image);
      const copy = node("div", "", "product-card-copy");
      const heading = node("h2"), titleLink = node("a", product.title);
      titleLink.href = destination;
      heading.append(titleLink);
      const price = node("p", money(product.priceCents), "product-price");
      const shipping = node("p", product.shippingCents ? `+ ${money(product.shippingCents)} shipping` : "Shipping included", "product-note");
      const seller = node("a", `Sold by ${product.shopName}`, "bazaar-seller");
      seller.href = destination;
      copy.append(heading, price, shipping, seller);
      card.append(copy);
      products.append(card);
    }
    if (!visible.length) products.append(node("p", query ? "No loaded Bazaar items match that search." : "No member-shop items are available yet.", "bazaar-empty"));
    byId("bazaarResultCount").textContent = `${visible.length} of ${bazaarListings.length} loaded item${bazaarListings.length === 1 ? "" : "s"} shown.`;
    byId("bazaarMore").hidden = !bazaarNextCursor;
  }

  async function loadBazaar(append = false) {
    document.body.classList.add("bazaar-view");
    products.classList.add("bazaar-grid");
    byId("bazaarTools").hidden = false;
    byId("storeEyebrow").textContent = "Member marketplace";
    byId("storeTitle").textContent = "DanzStak Bazaar";
    byId("storeDescription").textContent = "A mix of physical goods published by DanzStak member shops. Open an item to visit its seller's shop.";
    products.setAttribute("aria-label", "DanzStak Bazaar items");
    document.title = "DanzStak Bazaar";
    status.textContent = append ? "Loading more Bazaar items…" : "Loading the Bazaar…";
    try {
      const query = new URLSearchParams({ limit:"24" });
      if (append && bazaarNextCursor) query.set("cursor", bazaarNextCursor);
      const data = await request(`/marketplace/bazaar?${query}`);
      const additions = Array.isArray(data.listings) ? data.listings : [];
      const known = new Set(bazaarListings.map(item => `${item.memberId}:${item.id}`));
      bazaarListings = append ? [...bazaarListings, ...additions.filter(item => !known.has(`${item.memberId}:${item.id}`))] : additions;
      bazaarNextCursor = String(data.nextCursor || "");
      renderBazaar();
      status.textContent = bazaarListings.length ? `${bazaarListings.length} member item${bazaarListings.length === 1 ? "" : "s"} loaded.` : "The Bazaar is ready for the first published member item.";
    } catch (error) {
      status.textContent = error.message;
      if (!append) { bazaarListings = []; bazaarNextCursor = ""; renderBazaar(); }
    }
  }
  function showShop(shop) {
    currentShop = shop; byId("storeTitle").textContent=shop.name; byId("storeDescription").textContent=shop.description || (shop.official ? "Official DanzStak merchandise." : "Physical goods from this DanzStak member."); byId("storeEyebrow").textContent=shop.official ? "Official store" : "Member shop"; document.title=`${shop.name} | DanzStak`; renderProducts(shop);
    if(managing) { byId("shopName").value=shop.name; byId("shopDescription").value=shop.description; byId("shopStatus").value=shop.status; productManager.hidden=false; }
  }
  async function load() {
    if (browsingBazaar) { await loadBazaar(false); return; }
    if(managing) { manager.hidden=false; byId("manageShopLink").hidden=true; }
    else if(!memberId) byId("manageShopLink").hidden=false;
    const path=managing?"/marketplace/shop":memberId?`/marketplace/shop/${encodeURIComponent(memberId)}`:"/marketplace/store";
    status.textContent="Loading store…";
    try { const data=await request(path); showShop(data.shop); status.textContent=data.shop.products.length?`${data.shop.products.length} product${data.shop.products.length===1?"":"s"}.`:"No products are available right now."; }
    catch(error) {
      if(managing && error.status===404) { currentShop=null; products.replaceChildren(); productManager.hidden=true; status.textContent="Name your shop to open a private draft. Publish it only when it is ready."; return; }
      if(!memberId && !managing && error.status===404) { byId("storeTitle").textContent="DanzStak Official Store"; products.replaceChildren(); status.textContent="The official store is being stocked. No products are available right now."; return; }
      status.textContent=error.message;
    }
  }

  byId("shopForm").addEventListener("submit", async event => {
    event.preventDefault(); status.textContent="Saving shop…";
    try { const data=await request("/marketplace/shop",{method:"PUT",body:JSON.stringify({name:byId("shopName").value,description:byId("shopDescription").value,status:byId("shopStatus").value})}); currentShop=data.shop; productManager.hidden=false; status.textContent=data.shop.status==="published"?"Shop published on your profile.":"Shop saved as a private draft."; await load(); }
    catch(error){ status.textContent=error.message; }
  });
  byId("productForm").addEventListener("submit", async event => {
    event.preventDefault(); const price=cents(byId("productPrice").value),shipping=cents(byId("productShipping").value); if(price===null||shipping===null){status.textContent="Enter prices in dollars and cents, for example 25.00.";return;}
    const id=byId("productId").value, payload={title:byId("productTitle").value,description:byId("productDescription").value,imageUrl:byId("productImage").value,priceCents:price,shippingCents:shipping,inventory:Number(byId("productInventory").value),status:byId("productStatus").value,productType:"physical"}; if(id) payload.revision=Number(byId("productRevision").value);
    status.textContent=id?"Saving product…":"Adding product…";
    try { await request(id?`/marketplace/products/${encodeURIComponent(id)}`:"/marketplace/products",{method:id?"PATCH":"POST",body:JSON.stringify(payload)}); resetProductForm(); status.textContent=id?"Product updated.":"Product added."; await load(); }
    catch(error){status.textContent=error.message;}
  });
  byId("cancelProductEdit").addEventListener("click",resetProductForm);
  byId("bazaarSearch").addEventListener("input", renderBazaar);
  byId("clearBazaarSearch").addEventListener("click", () => { byId("bazaarSearch").value = ""; renderBazaar(); byId("bazaarSearch").focus(); });
  byId("loadMoreBazaar").addEventListener("click", () => loadBazaar(true));
  load();
})();
