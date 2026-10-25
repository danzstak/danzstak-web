"use strict";

(() => {
  const accountLocalKeys = [
    "danzstak_dev_sections",
    "danzstak-post-preferences",
    "danzstak-hidden-posts",
    "danzstak_external_reels",
    "danzstak_chat_read",
    "danzstak_profile_draft",
    "danzstak_profile_media"
  ];

  window.danzstakClearAccountData = () => {
    try { for (const key of accountLocalKeys) localStorage.removeItem(key); }
    catch { /* Server logout remains authoritative when browser storage is unavailable. */ }
    try { sessionStorage.removeItem("danzstak_install_prompt_shown"); }
    catch { /* Session storage is optional. */ }
  };
})();
