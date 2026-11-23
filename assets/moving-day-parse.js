"use strict";
// Moving Day for shops (owner 2026-11-17): read a shop's own inventory export
// (Discogs, eBay, Shopify or any spreadsheet) entirely in the browser.
// No platform login, no API, nothing copied from a marketplace database.
(function (root) {
  const MAX_ROWS = 20000;

  function parseCsv(text) {
    const source = String(text || "").replace(/^﻿/, "");
    const firstLine = source.slice(0, source.search(/\r?\n|$/));
    const delimiter = (firstLine.match(/\t/g) || []).length > (firstLine.match(/,/g) || []).length ? "\t" : (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
    const rows = [];
    let row = [], field = "", quoted = false;
    for (let i = 0; i < source.length; i += 1) {
      const char = source[i];
      if (quoted) {
        if (char === '"') { if (source[i + 1] === '"') { field += '"'; i += 1; } else quoted = false; }
        else field += char;
        continue;
      }
      if (char === '"' && field === "") { quoted = true; continue; }
      if (char === delimiter) { row.push(field); field = ""; continue; }
      if (char === "\n" || char === "\r") {
        if (char === "\r" && source[i + 1] === "\n") i += 1;
        row.push(field); field = "";
        if (row.some(cell => cell.trim() !== "")) rows.push(row);
        row = [];
        if (rows.length > MAX_ROWS) break;
        continue;
      }
      field += char;
    }
    if (field !== "" || row.length) { row.push(field); if (row.some(cell => cell.trim() !== "")) rows.push(row); }
    return rows;
  }

  const norm = value => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

  // Column names as each platform's own export writes them.
  const FIELDS = {
    ref: ["listing_id", "item_number", "item_id", "custom_label_sku", "sku", "variant_sku", "handle", "id"],
    artist: ["artist", "artists"],
    title: ["title", "item_title", "name", "product_title"],
    label: ["label", "labels"],
    catno: ["catno", "catalog_number", "cat_no", "catalogue_number"],
    format: ["format", "formats", "type"],
    price: ["price", "start_price", "current_price", "variant_price", "buy_it_now_price"],
    quantity: ["quantity", "available_quantity", "variant_inventory_qty", "inventory", "stock", "qty"],
    media: ["media_condition", "condition"],
    sleeve: ["sleeve_condition"],
    comments: ["comments", "description", "body_html", "body"],
    image: ["image_src", "image", "image_url", "picture_url"],
    status: ["status"],
    shipping: ["flat_shipping", "shipping", "shipping_cost"]
  };

  function detect(headers) {
    const names = headers.map(norm);
    const map = {};
    for (const [field, options] of Object.entries(FIELDS)) {
      const index = names.findIndex(name => options.includes(name));
      if (index >= 0) map[field] = index;
    }
    const source = names.includes("listing_id") && names.includes("release_id") ? "discogs"
      : names.includes("item_number") || names.includes("custom_label_sku") ? "ebay"
      : names.includes("handle") && names.includes("variant_price") ? "shopify"
      : "spreadsheet";
    const used = new Set(Object.values(map));
    const unused = headers.filter((_, index) => !used.has(index) && headers[index].trim());
    return { source, map, unused };
  }

  function money(value) {
    const text = String(value || "").replace(/[^\d.,-]/g, "");
    if (!text) return null;
    const normalized = /,\d{1,2}$/.test(text) && !/\.\d{1,2}$/.test(text) ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
    const number = Number(normalized);
    return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) : null;
  }

  const stripHtml = value => String(value || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

  function toItems(rows) {
    if (!rows.length) return { source: "spreadsheet", items: [], unused: [] };
    const [headers, ...data] = rows;
    const { source, map, unused } = detect(headers);
    const cell = (row, field) => map[field] === undefined ? "" : String(row[map[field]] ?? "").trim();
    const seen = new Map();
    const items = data.map((row, index) => {
      const artist = cell(row, "artist"), title = cell(row, "title");
      const name = (artist && title ? `${artist} – ${title}` : title || artist).slice(0, 120);
      const format = cell(row, "format"), label = cell(row, "label"), catno = cell(row, "catno");
      const media = cell(row, "media"), sleeve = cell(row, "sleeve"), comments = stripHtml(cell(row, "comments"));
      const details = [
        format && `Format: ${format}`,
        (label || catno) && `Label: ${[label, catno].filter(Boolean).join(" · ")}`,
        media && `${sleeve ? "Media" : "Condition"}: ${media}`,
        sleeve && `Sleeve: ${sleeve}`,
        comments
      ].filter(Boolean).join("\n").slice(0, 2000);
      const quantityText = cell(row, "quantity");
      const quantity = quantityText === "" ? 1 : Math.max(0, Math.min(99999, Number.parseInt(quantityText, 10) || 0));
      const status = cell(row, "status").toLowerCase();
      let ref = cell(row, "ref") || `row-${index + 2}`;
      const count = seen.get(ref) || 0; seen.set(ref, count + 1);
      if (count) ref = `${ref}-${count + 1}`;
      const image = cell(row, "image");
      const priceCents = money(cell(row, "price"));
      const shippingCents = money(cell(row, "shipping")) || 0;
      const problems = [];
      if (!name) problems.push("no title");
      if (priceCents === null || priceCents < 50) problems.push("no price");
      if (priceCents !== null && shippingCents > priceCents) problems.push("shipping above price");
      return {
        row: index + 2,
        sourceRef: `${source}:${ref}`.replace(/[^\w:.#/-]/g, "_").slice(0, 120),
        title: name,
        description: details,
        priceCents: priceCents ?? 0,
        shippingCents,
        inventory: quantity,
        imageUrl: /^https:\/\//i.test(image) ? image.slice(0, 2048) : "",
        forSale: !status || ["for sale", "active", "published", "draft"].includes(status),
        problems
      };
    });
    return { source, items, unused };
  }

  const api = { parseCsv, detect, money, toItems };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DanzStakMovingDay = api;
})(typeof window === "object" ? window : globalThis);
