"use strict";
(() => {
  const API = "https://api.danzstak.com";
  const params = new URLSearchParams(location.search);
  const memberId = params.get("member") || "";
  const managing = params.get("manage") === "1";
  const byId = id => document.getElementById(id);
  const products = byId("storeProducts"), status = byId("storeStatus"), manager = byId("shopManager"), productManager = byId("productManager");
  let currentShop = null;
  const payoutButton = byId("setupPayouts"), payoutStatus = byId("payoutStatus");
  const orders = byId("sellerOrders"), ordersStatus = byId("ordersStatus"), refreshOrders = byId("refreshOrders");

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
    byId("feePreview").textContent = price === null ? "Enter an item price" : `${money(Math.round(price * 0.05))} on this item`;
  }
  function node(tag, text = "", className = "") { const item = document.createElement(tag); item.textContent = text; if (className) item.className = className; return item; }
  function orderLabel(value) { return String(value || "").replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase()); }

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
    if(managing) { byId("shopName").value=shop.name; byId("shopDescription").value=shop.description; byId("shopStatus").value=shop.status; productManager.hidden=false; }
  }
  async function loadPayoutStatus() {
    if (!managing) return;
    try {
      const data = await request("/marketplace/seller/status"), seller = data.seller || {};
      payoutStatus.textContent = seller.ready ? "Verified for Stripe Test Mode payouts. Live payouts remain off." : seller.connected ? "Stripe has more Test Mode seller details to collect." : "Connect a Stripe Test Mode seller account before buyers can check out.";
      payoutButton.textContent = seller.ready ? "Payout setup complete" : seller.connected ? "Continue payout setup" : "Set up Test Mode payouts";
      payoutButton.disabled = Boolean(seller.ready);
    } catch (error) { payoutStatus.textContent = error.message; payoutButton.disabled = false; }
  }

  async function shipOrder(order) {
    const carrier = prompt("Carrier name (for example USPS or UPS):", order.carrier || "");
    if (carrier === null) return;
    const trackingNumber = prompt("Tracking number:", order.trackingNumber || "");
    if (trackingNumber === null) return;
    ordersStatus.textContent = `Marking ${order.productTitle} shipped…`;
    try {
      await request(`/marketplace/orders/${encodeURIComponent(order.id)}/ship`, { method:"POST", body:JSON.stringify({ carrier, trackingNumber }) });
      await loadOrders();
    } catch (error) { ordersStatus.textContent = error.message; }
  }

  async function refundOrder(order) {
    if (!confirm(`Refund ${money(order.totalCents)} to the buyer for ${order.productTitle}? This restores one item to inventory.`)) return;
    ordersStatus.textContent = `Refunding ${order.productTitle}…`;
    try {
      await request(`/marketplace/orders/${encodeURIComponent(order.id)}/refund`, { method:"POST", body:"{}" });
      await loadOrders();
    } catch (error) { ordersStatus.textContent = error.message; }
  }

  function renderOrders(items) {
    orders.replaceChildren();
    if (!items.length) { orders.append(node("p", "No Test Mode orders yet.")); return; }
    for (const order of items) {
      const card = node("article", "", "seller-order"), head = node("div", "", "seller-order-head");
      head.append(node("h4", order.productTitle || "Marketplace order"), node("strong", money(order.totalCents)));
      card.append(head, node("p", orderLabel(order.status), "seller-order-meta"));
      if (order.shipping) {
        const address = [order.shipping.name, order.shipping.line1, order.shipping.line2, [order.shipping.city, order.shipping.state, order.shipping.postalCode].filter(Boolean).join(" "), order.shipping.country].filter(Boolean).join(", ");
        card.append(node("p", `Ship to: ${address}`, "seller-order-meta"));
      }
      if (order.trackingNumber) card.append(node("p", `${order.carrier}: ${order.trackingNumber}`, "seller-order-meta"));
      if (["paid_held", "shipped"].includes(order.status)) {
        const actions = node("div", "", "seller-order-actions");
        if (order.status === "paid_held") { const ship = node("button", "Add tracking and ship"); ship.type="button"; ship.addEventListener("click", () => shipOrder(order)); actions.append(ship); }
        const refund = node("button", "Refund buyer", "store-secondary-action"); refund.type="button"; refund.addEventListener("click", () => refundOrder(order)); actions.append(refund); card.append(actions);
      }
      orders.append(card);
    }
  }

  async function loadOrders() {
    if (!managing) return;
    refreshOrders.disabled = true; ordersStatus.textContent = "Loading secure Test Mode orders…";
    try {
      const data = await request("/marketplace/orders?role=seller");
      renderOrders(data.orders || []); ordersStatus.textContent = `${(data.orders || []).length} order${(data.orders || []).length === 1 ? "" : "s"}. Seller funds move only after buyer receipt confirmation.`;
    } catch (error) { orders.replaceChildren(); ordersStatus.textContent = error.message; }
    finally { refreshOrders.disabled = false; }
  }
  async function load() {
    if(managing) { manager.hidden=false; byId("manageShopLink").hidden=true; }
    else if(!memberId) byId("manageShopLink").hidden=false;
    const path=managing?"/marketplace/shop":memberId?`/marketplace/shop/${encodeURIComponent(memberId)}`:"/marketplace/store";
    status.textContent="Loading store…";
    try { const data=await request(path); showShop(data.shop); status.textContent=data.shop.products.length?`${data.shop.products.length} product${data.shop.products.length===1?"":"s"}.`:"No products are available right now."; await Promise.all([loadPayoutStatus(),loadOrders()]); }
    catch(error) {
      if(managing && error.status===404) { currentShop=null; products.replaceChildren(); productManager.hidden=true; status.textContent="Name your shop to open a private draft. Publish it only when it is ready."; return; }
      if(!memberId && !managing && error.status===404) { byId("storeTitle").textContent="DanzStak Store"; products.replaceChildren(); status.textContent="The official store is being stocked. No products are available right now."; return; }
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
    if(shipping>price){status.textContent="Shipping cannot cost more than the item price. DanzStak blocks inflated postage that could hide the sale price.";return;}
    const id=byId("productId").value, payload={title:byId("productTitle").value,description:byId("productDescription").value,imageUrl:byId("productImage").value,priceCents:price,shippingCents:shipping,inventory:Number(byId("productInventory").value),status:byId("productStatus").value,productType:"physical"}; if(id) payload.revision=Number(byId("productRevision").value);
    status.textContent=id?"Saving product…":"Adding product…";
    try { await request(id?`/marketplace/products/${encodeURIComponent(id)}`:"/marketplace/products",{method:id?"PATCH":"POST",body:JSON.stringify(payload)}); resetProductForm(); status.textContent=id?"Product updated.":"Product added."; await load(); }
    catch(error){status.textContent=error.message;}
  });
  byId("cancelProductEdit").addEventListener("click",resetProductForm);
  payoutButton.addEventListener("click", async () => {
    payoutButton.disabled=true; payoutStatus.textContent="Opening secure Stripe Test Mode onboarding…";
    try {
      const data=await request("/marketplace/seller/onboarding",{method:"POST",body:"{}"});
      if(data.ready){await loadPayoutStatus();return;}
      if(!/^https:\/\/connect\.stripe\.com\//.test(data.onboardingUrl||""))throw new Error("Stripe onboarding did not return a secure link.");
      location.assign(data.onboardingUrl);
    } catch(error){payoutStatus.textContent=error.message;payoutButton.disabled=false;}
  });
  refreshOrders.addEventListener("click", loadOrders);
  byId("productPrice").addEventListener("input",updateFeePreview);
  updateFeePreview();
  load();
})();
