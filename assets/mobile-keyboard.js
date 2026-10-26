"use strict";
(() => {
  // Request Return on text keyboards, including fields inserted after navigation.
  const selector = 'textarea,input:not([type]),input[type="text"],input[type="search"],input[type="email"],input[type="url"],input[type="tel"],input[type="password"]';
  function configure(root) {
    if (root.matches?.(selector)) root.setAttribute('enterkeyhint', 'enter');
    for (const field of root.querySelectorAll?.(selector) || []) field.setAttribute('enterkeyhint', 'enter');
  }
  function start() {
    configure(document);
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType === 1) configure(node);
      }
    }).observe(document.body, {childList:true, subtree:true});
    document.addEventListener('focusin', event => {
      if (event.target.matches?.(selector)) event.target.setAttribute('enterkeyhint', 'enter');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
