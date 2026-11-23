"use strict";
(() => {
  const selector = '.post[data-post-id],.profile-post-card[data-post-id]', visible = new Set(), timers = new Map(), pending = new WeakSet(), recorded = new WeakSet();
  async function viewFetch(path, options = {}, timeoutMs = 10000) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
    try { return await fetch('https://api.danzstak.com' + path, { ...options, signal: controller.signal }); }
    finally { clearTimeout(timer); }
  }
  function countLabel(article, count) {
    let label = article.querySelector('.post-view-count');
    // Fix-it 18 (owner 2026-11-17): the view count rides in the post header line (time · audience · N views) instead of a row of its own.
    if (!label) { const audience = article.querySelector('.post-audience'), meta = article.querySelector('.profile-post-meta'); label = document.createElement(audience || meta ? 'span' : 'div'); label.className = audience || meta ? 'post-view-count is-inline' : 'post-view-count'; if (audience) { let row = audience.parentElement.matches('.post-meta-line') ? audience.parentElement : null; if (!row) { row = document.createElement('span'); row.className = 'post-meta-line'; audience.before(row); row.appendChild(audience); } row.appendChild(label); } else if (meta) meta.appendChild(label); else { const actions = article.querySelector('.post-actions'); if (actions) actions.before(label); else article.appendChild(label); } }
    const safe = Math.max(0,Number(count) || 0), source = safe.toLocaleString() + (safe === 1 ? ' view' : ' views'); label.textContent = globalThis.danzstakTranslate?.(source) || source; if (label.dataset) label.dataset.shown = safe + ':'; if (article.dataset.viewCount !== String(safe)) article.dataset.viewCount = String(safe);
  }
  function cancel(article) { clearTimeout(timers.get(article)); timers.delete(article); }
  async function record(article) {
    timers.delete(article);
    if (document.hidden || !visible.has(article) || pending.has(article) || recorded.has(article) || !article.isConnected) return;
    pending.add(article);
    try {
      const response = await viewFetch('/post-views', {method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({postId:article.dataset.postId})});
      if (!response.ok) return; const data = await response.json(); if (article.isConnected) countLabel(article,data.viewCount); recorded.add(article);
    } catch { /* Counts are best effort; content remains available. */ }
    finally { pending.delete(article); }
  }
  function schedule(article) {
    cancel(article); if (document.hidden || recorded.has(article) || pending.has(article) || article.dataset.isOwner === 'true') return;
    timers.set(article,setTimeout(() => record(article),1000));
  }
  const observer = new IntersectionObserver(entries => { for (const entry of entries) { if (entry.isIntersecting && (entry.boundingClientRect?.height && entry.intersectionRect ? entry.intersectionRect.height / Math.min(entry.boundingClientRect.height,innerHeight) >= .6 : entry.intersectionRatio >= .6)) { visible.add(entry.target); schedule(entry.target); } else { visible.delete(entry.target); cancel(entry.target); } } }, {threshold:[0,.6,1]});
  // The label used to be drawn before Mix wrote the post's real count onto it (so it read "0 views"); redraw when it changes.
  const countWatch = typeof MutationObserver === 'function' ? new MutationObserver(records => records.forEach(record => { const article = record.target; if (article.dataset.viewCount !== undefined && !article.querySelector('.post-view-count')?.dataset.shown?.startsWith(article.dataset.viewCount + ':')) countLabel(article, article.dataset.viewCount); })) : null;
  function observe(article) { countLabel(article,article.dataset.viewCount); countWatch?.observe(article, { attributes: true, attributeFilter: ['data-view-count'] }); observer.observe(article); }
  for (const article of document.querySelectorAll(selector)) observe(article);
  new MutationObserver(records => { for (const record of records) {
    for (const node of record.addedNodes) { if (node.nodeType !== 1) continue; if (node.matches(selector)) observe(node); for (const article of node.querySelectorAll(selector)) observe(article); }
    for (const node of record.removedNodes) { if (node.nodeType !== 1) continue; const articles = [...node.querySelectorAll(selector)]; if (node.matches(selector)) articles.push(node); for (const article of articles) { observer.unobserve(article); visible.delete(article); cancel(article); } }
  } }).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('visibilitychange', () => { for (const article of visible) { if (document.hidden) cancel(article); else schedule(article); } });
})();
