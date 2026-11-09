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

  function productImages(product) {
    return Array.isArray(product.images) && product.images.length ? product.images : product.imageUrl ? [product.imageUrl] : [];
  }

  function productImage(product, destination = "") {
    const source = productImages(product)[0];
    if (!source) return null;
    const image = document.createElement("img");
    image.className = "product-image";
    image.src = source;
    image.alt = product.title;
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
    byId("productForm").reset(); byId("productId").value = ""; byId("productRevision").value = ""; byId("productShipping").value = "0.00"; byId("productCondition").value = "New"; byId("productFormTitle").textContent = "Add a physical product"; byId("cancelProductEdit").hidden = true;
  }
  function editProduct(product) {
    const specifics = product.itemSpecifics || {};
    byId("productId").value = product.id; byId("productRevision").value = product.revision; byId("productTitle").value = product.title; byId("productDescription").value = product.description; byId("productImages").value = productImages(product).join("\n"); byId("productMedium").value = specifics.medium || ""; byId("productDimensions").value = specifics.dimensions || ""; byId("productCondition").value = specifics.condition || "New"; byId("productYear").value = specifics.yearCreated || ""; byId("productSignature").value = specifics.signatureStatus || ""; byId("productPrice").value = (product.priceCents / 100).toFixed(2); byId("productShipping").value = (product.shippingCents / 100).toFixed(2); byId("productInventory").value = product.inventory; byId("productStatus").value = product.status; byId("productFormTitle").textContent = `Edit ${product.title}`; byId("cancelProductEdit").hidden = false; byId("productTitle").focus();
  }
  async function archiveProduct(product) {
    if (!confirm(`Remove ${product.title} from your shop? Existing order records are kept.`)) return;
    try { await request(`/marketplace/products/${encodeURIComponent(product.id)}`, {method:"DELETE"}); status.textContent = `${product.title} removed.`; await load(); } catch (error) { status.textContent = error.message; }
  }

  function descriptionBlocks(text) {
    return String(text || "").trim().split(/\n\s*\n/).map(value => value.trim()).filter(Boolean);
  }

  function renderProductDetail(shop, product) {
    products.replaceChildren();
    products.classList.remove("product-grid");
    products.classList.add("product-detail-shell");
    products.setAttribute("aria-label", `${product.title} details`);
    const article = node("article", "", "product-detail");
    const gallery = node("div", "", "product-gallery");
    const images = productImages(product);
    const main = document.createElement("img");
    main.className = "product-image product-detail-image";
    main.src = images[0];
    main.alt = product.title;
    main.referrerPolicy = "no-referrer";
    gallery.append(main);
    if (images.length > 1) {
      const thumbnails = node("div", "", "product-thumbnails");
      images.forEach((source, index) => {
        const button = node("button", "", index === 0 ? "is-selected" : "");
        button.type = "button";
        button.setAttribute("aria-label", `Show image ${index + 1} of ${images.length}`);
        const image = document.createElement("img");
        image.src = source;
        image.alt = "";
        image.loading = "lazy";
        image.referrerPolicy = "no-referrer";
        button.append(image);
        button.addEventListener("click", () => {
          main.src = source;
          for (const sibling of thumbnails.children) sibling.classList.toggle("is-selected", sibling === button);
        });
        thumbnails.append(button);
      });
      gallery.append(thumbnails);
    }
    const copy = node("div", "", "product-detail-copy");
    copy.append(node("p", shop.name, "store-eyebrow"), node("h2", product.title), node("p", money(product.priceCents), "product-price"));
    copy.append(node("p", product.shippingCents ? `Shipping: ${money(product.shippingCents)}` : "Shipping included", "product-note"));
    const specifics = product.itemSpecifics || {};
    const rows = [
      ["Medium / material", specifics.medium],
      ["Dimensions", specifics.dimensions],
      ["Condition", specifics.condition],
      ["Year created", specifics.yearCreated],
      ["Signature", specifics.signatureStatus]
    ].filter(([, value]) => value !== "" && value !== null && value !== undefined);
    if (rows.length) {
      copy.append(node("h3", "Item specifics"));
      const list = node("dl", "", "item-specifics");
      for (const [label, value] of rows) {
        const row = node("div");
        row.append(node("dt", label), node("dd", String(value)));
        list.append(row);
      }
      copy.append(list);
    }
    if (product.description) {
      const description = node("section", "", "product-description");
      description.append(node("h3", "Description"));
      for (const block of descriptionBlocks(product.description)) description.append(node("p", block));
      copy.append(description);
    }
    copy.append(node("p", product.available ? "Secure ordering opens after seller verification and payout testing." : "Unavailable", "product-note"));
    const links = node("div", "", "product-detail-links");
    const shopLink = node("a", `Back to ${shop.name}`, "store-secondary-action");
    shopLink.href = shop.official ? "store.html" : `store.html?member=${encodeURIComponent(shop.memberId || memberId)}`;
    const bazaarLink = node("a", "Browse the Bazaar", "store-secondary-action");
    bazaarLink.href = "store.html?view=bazaar";
    links.append(shopLink, bazaarLink);
    copy.append(links);
    article.append(gallery, copy);
    products.append(article);
    document.title = `${product.title} | ${shop.name}`;
  }

  function renderProducts(shop) {
    products.replaceChildren();
    if (!shop.products.length) { products.append(node("p", managing ? "No products yet. Add your first physical item below." : "No products are available right now.")); return; }
    const selectedProduct = selectedProductId ? shop.products.find(product => product.id === selectedProductId) : null;
    if (selectedProduct && !managing) { renderProductDetail(shop, selectedProduct); return; }
    products.classList.remove("product-detail-shell");
    products.classList.add("product-grid");
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
  }

  function renderBazaar() {
    const query = byId("bazaarSearch").value.trim().toLocaleLowerCase();
    const visible = query ? bazaarListings.filter(product => `${product.title} ${product.description} ${product.shopName} ${Object.values(product.itemSpecifics || {}).join(" ")}`.toLocaleLowerCase().includes(query)) : bazaarListings;
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
    const images=byId("productImages").value.split(/\r?\n/).map(value=>value.trim()).filter(Boolean);
    const id=byId("productId").value, payload={title:byId("productTitle").value,description:byId("productDescription").value,images,itemSpecifics:{medium:byId("productMedium").value,dimensions:byId("productDimensions").value,condition:byId("productCondition").value,yearCreated:byId("productYear").value,signatureStatus:byId("productSignature").value},priceCents:price,shippingCents:shipping,inventory:Number(byId("productInventory").value),status:byId("productStatus").value,productType:"physical"}; if(id) payload.revision=Number(byId("productRevision").value);
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
