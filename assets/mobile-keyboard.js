"use strict";
(() => {
  // Request Return on text keyboards, including fields inserted after navigation.
  const selector = 'textarea,input:not([type]),input[type="text"],input[type="search"],input[type="email"],input[type="url"],input[type="tel"],input[type="password"]';
  function configureField(field) {
    // Preserve purpose-specific hints such as Search and Send. Feature code
    // assigns those before inserting dynamic controls into the document.
    if (!field.getAttribute?.('enterkeyhint')) field.setAttribute('enterkeyhint', 'enter');
  }
  function configure(root) {
    if (root.matches?.(selector)) configureField(root);
    for (const field of root.querySelectorAll?.(selector) || []) configureField(field);
  }
  function start() {
    configure(document);
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType === 1) configure(node);
      }
    }).observe(document.body, {childList:true, subtree:true});
    document.addEventListener('focusin', event => {
      if (event.target.matches?.(selector)) configureField(event.target);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
