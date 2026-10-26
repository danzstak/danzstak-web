"use strict";
(() => {
  const selector = '.post[data-post-id],.profile-post-card[data-post-id]', visible = new Set(), timers = new Map(), pending = new WeakSet(), recorded = new WeakSet();
  function countLabel(article, count) {
    let label = article.querySelector('.post-view-count');
    if (!label) { label = document.createElement('div'); label.className = 'post-view-count'; const actions = article.querySelector('.post-actions'); if (actions) actions.before(label); else article.appendChild(label); }
    const safe = Math.max(0,Number(count) || 0); label.textContent = safe.toLocaleString() + (safe === 1 ? ' view' : ' views'); article.dataset.viewCount = String(safe);
  }
  function cancel(article) { clearTimeout(timers.get(article)); timers.delete(article); }
  async function record(article) {
    timers.delete(article);
    if (document.hidden || !visible.has(article) || pending.has(article) || recorded.has(article) || !article.isConnected) return;
    pending.add(article);
    try {
      const response = await fetch('https://api.danzstak.com/post-views', {method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({postId:article.dataset.postId})});
      if (!response.ok) return; const data = await response.json(); if (article.isConnected) countLabel(article,data.viewCount); recorded.add(article);
    } catch { /* Counts are best effort; content remains available. */ }
    finally { pending.delete(article); }
  }
  function schedule(article) {
    cancel(article); if (document.hidden || recorded.has(article) || pending.has(article) || article.dataset.isOwner === 'true') return;
    timers.set(article,setTimeout(() => record(article),1000));
  }
  const observer = new IntersectionObserver(entries => { for (const entry of entries) { if (entry.isIntersecting && (entry.boundingClientRect?.height && entry.intersectionRect ? entry.intersectionRect.height / Math.min(entry.boundingClientRect.height,innerHeight) >= .6 : entry.intersectionRatio >= .6)) { visible.add(entry.target); schedule(entry.target); } else { visible.delete(entry.target); cancel(entry.target); } } }, {threshold:[0,.6,1]});
  function observe(article) { countLabel(article,article.dataset.viewCount); observer.observe(article); }
  for (const article of document.querySelectorAll(selector)) observe(article);
  new MutationObserver(records => { for (const record of records) {
    for (const node of record.addedNodes) { if (node.nodeType !== 1) continue; if (node.matches(selector)) observe(node); for (const article of node.querySelectorAll(selector)) observe(article); }
    for (const node of record.removedNodes) { if (node.nodeType !== 1) continue; const articles = [...node.querySelectorAll(selector)]; if (node.matches(selector)) articles.push(node); for (const article of articles) { observer.unobserve(article); visible.delete(article); cancel(article); } }
  } }).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('visibilitychange', () => { for (const article of visible) { if (document.hidden) cancel(article); else schedule(article); } });
})();
