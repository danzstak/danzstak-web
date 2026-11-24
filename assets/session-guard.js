"use strict";
// Directive L1 (owner 2026-11-19): "Profile page not loading … can not register their device." The tester's browser
// refreshed its session (/auth/refresh 200) while every signed-in call still answered 401, and the pages showed a blank
// profile or a dead registration screen. Never fail silently:
//  - every signed-in call to the API that answers 401 refreshes the session once (one refresh shared by every call
//    waiting at that moment) and is sent again;
//  - when it still answers 401, one sheet says "Sign in again to keep going". The page stays as it is behind it, so
//    nothing typed is lost; "Sign in" keeps the words typed on this page and brings the member back here afterwards
//    (home.js reads danzstak_return_to), where they are put back.
// A signed-out visitor (no session ever seen in this tab and no session to refresh) keeps the old behaviour: the page's
// own 401 handling sends them to the landing page or the member's shop.
// Loaded first in <head>, without defer, so every later script's API calls go through it.
(() => {
  const API = "https://api.danzstak.com";
  const SEEN = "danzstak_session_seen", RETURN = "danzstak_return_to", DRAFTS = "danzstak_session_drafts";
  const add = {
    it: { "Sign in again to keep going": "Accedi di nuovo per continuare", "Your session ended on this device. What you typed stays here.": "La sessione su questo dispositivo è terminata. Quello che hai scritto resta qui.", "Sign in": "Accedi", "Not now": "Non ora" },
    fr: { "Sign in again to keep going": "Reconnecte-toi pour continuer", "Your session ended on this device. What you typed stays here.": "Ta session a pris fin sur cet appareil. Ce que tu as écrit reste ici.", "Sign in": "Se connecter", "Not now": "Pas maintenant" },
    es: { "Sign in again to keep going": "Vuelve a iniciar sesión para seguir", "Your session ended on this device. What you typed stays here.": "Tu sesión terminó en este dispositivo. Lo que escribiste se queda aquí.", "Sign in": "Iniciar sesión", "Not now": "Ahora no" },
    de: { "Sign in again to keep going": "Melde dich erneut an, um weiterzumachen", "Your session ended on this device. What you typed stays here.": "Deine Sitzung auf diesem Gerät ist beendet. Was du geschrieben hast, bleibt hier.", "Sign in": "Anmelden", "Not now": "Nicht jetzt" },
    pt: { "Sign in again to keep going": "Entra de novo para continuar", "Your session ended on this device. What you typed stays here.": "A tua sessão terminou neste dispositivo. O que escreveste fica aqui.", "Sign in": "Entrar", "Not now": "Agora não" }
  };
  // languages.js replaces the shared dictionary after this runs, so these words are looked up here first.
  const t = text => add[String(document.documentElement.lang || "en").toLowerCase().split("-")[0]]?.[text] || (typeof window.danzstakTranslate === "function" ? window.danzstakTranslate(text) : text) || text;
  const store = (kind, action, key, value) => { try { return kind[action](key, value); } catch { return null; } };

  const nativeFetch = window.fetch.bind(window);
  // Calls that answer 401 only after a member has signed in prove the tab had a session.
  const proves = /^\/(auth\/refresh|calls\/presence|phone-verification|settings\/sync-prefs)$/;
  const seen = () => store(sessionStorage, "getItem", SEEN) === "1";
  const markSeen = () => store(sessionStorage, "setItem", SEEN, "1");

  let refreshing = null;
  function refresh() {
    if (!refreshing) refreshing = nativeFetch(API + "/auth/refresh", { method: "POST", credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json" }, body: "{}" })
      .then(response => { if (response.ok) markSeen(); return response.status; }, () => 0)
      .finally(() => setTimeout(() => { refreshing = null; }, 2000)); // calls failing together share one refresh
    return refreshing;
  }

  // While the sheet is open, the calls that hit it wait (the page keeps what it shows instead of going blank or leaving).
  // A caller's own abort/timeout still ends its wait.
  function hold(init) {
    const signal = init?.signal;
    return new Promise((_, reject) => {
      if (signal?.aborted) return reject(signal.reason || new DOMException("Aborted", "AbortError"));
      signal?.addEventListener?.("abort", () => reject(signal.reason || new DOMException("Aborted", "AbortError")), { once: true });
    });
  }

  function apiPath(input) {
    try {
      const url = new URL(input instanceof Request ? input.url : String(input), location.href);
      return url.origin === API ? url.pathname : null;
    } catch { return null; }
  }

  window.fetch = async function guardedFetch(input, init) {
    const path = apiPath(input);
    if (path === null || path.startsWith("/auth/")) {
      const response = await nativeFetch(input, init);
      if (path === "/auth/refresh" && response.ok) markSeen();
      return response;
    }
    const spare = input instanceof Request ? input.clone() : null;
    const response = await nativeFetch(input, init);
    if (response.ok && proves.test(path)) markSeen();
    if (response.status !== 401 || (init?.body && typeof init.body.getReader === "function")) return response;
    const refreshed = await refresh();
    if (refreshed >= 200 && refreshed < 300) {
      const again = await nativeFetch(spare || input, init);
      if (again.status !== 401) return again;
      return expired() ? hold(init) : again; // refresh worked but the call still isn't signed in: cookies not kept
    }
    if (refreshed === 401 && seen()) return expired() ? hold(init) : response;
    return response; // never signed in here, or the network is down: the page's own handling stands
  };

  // ---- the sheet ----
  let sheet = null, dismissedAt = 0;
  function expired() {
    if (sheet?.isConnected) return true;
    if (Date.now() - dismissedAt < 20000) return false;
    if (!document.body) return false;
    sheet = document.createElement("div");
    sheet.className = "session-guard";
    sheet.innerHTML = `<div class="session-guard__panel" role="alertdialog" aria-modal="true" aria-labelledby="sessionGuardTitle" aria-describedby="sessionGuardText">
      <h2 id="sessionGuardTitle"></h2><p id="sessionGuardText"></p>
      <button type="button" class="session-guard__go"></button>
      <button type="button" class="session-guard__later"></button></div>`;
    sheet.querySelector("h2").textContent = t("Sign in again to keep going");
    sheet.querySelector("p").textContent = t("Your session ended on this device. What you typed stays here.");
    const go = sheet.querySelector(".session-guard__go"), later = sheet.querySelector(".session-guard__later");
    go.textContent = t("Sign in"); later.textContent = t("Not now");
    go.addEventListener("click", signIn);
    later.addEventListener("click", () => { dismissedAt = Date.now(); sheet.remove(); });
    document.body.append(sheet);
    go.focus({ preventScroll: true });
    return true;
  }
  window.danzstakSessionExpired = () => (seen() ? expired() : false);

  function signIn() {
    const here = location.pathname + location.search;
    store(sessionStorage, "setItem", RETURN, here);
    const fields = {};
    for (const field of document.querySelectorAll("textarea[id], input[id]:not([type]), input[id][type=text], input[id][type=search], input[id][type=url]")) {
      if (field.value && field.value.length <= 20000) fields[field.id] = field.value;
    }
    if (Object.keys(fields).length) store(sessionStorage, "setItem", DRAFTS, JSON.stringify({ path: here, fields }));
    location.assign(API + "/auth/login");
  }

  // Back on the page after signing in: put the typed words back into the same (still empty) fields. A field the page
  // draws later (a composer that appears once the profile has loaded on a slow phone) is filled when it appears,
  // for up to 15 s; then the saved words are dropped so a later visit never gets them.
  function restore() {
    let saved; try { saved = JSON.parse(store(sessionStorage, "getItem", DRAFTS) || "null"); } catch { saved = null; }
    if (!saved || saved.path !== location.pathname + location.search) return true;
    let left = 0;
    for (const [id, value] of Object.entries(saved.fields || {})) {
      const field = document.getElementById(id);
      if (!field) { left++; continue; }
      if (!field.value) { field.value = value; field.dispatchEvent(new Event("input", { bubbles: true })); }
    }
    if (left) return false;
    store(sessionStorage, "removeItem", DRAFTS);
    return true;
  }
  addEventListener("DOMContentLoaded", () => {
    if (restore()) return;
    let queued = null;
    const stop = () => { watch.disconnect(); clearTimeout(queued); clearTimeout(limit); store(sessionStorage, "removeItem", DRAFTS); };
    const watch = new MutationObserver(() => { if (!queued) queued = setTimeout(() => { queued = null; if (restore()) stop(); }, 50); });
    const limit = setTimeout(stop, 15000);
    watch.observe(document.documentElement, { childList: true, subtree: true });
  });

  const style = document.createElement("style");
  style.textContent = `.session-guard{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:flex-end;justify-content:center;background:rgba(11,11,12,.45)}
.session-guard__panel{box-sizing:border-box;width:100%;max-width:480px;margin:0;padding:22px 16px calc(16px + env(safe-area-inset-bottom));border-radius:16px 16px 0 0;background:var(--ds-surface,#fff);color:var(--ds-ink,#0b0b0c);box-shadow:0 -8px 32px rgba(0,0,0,.25);font-family:inherit}
.session-guard__panel h2{margin:0 0 6px;font-size:20px;line-height:26px;font-weight:800}
.session-guard__panel p{margin:0 0 16px;font-size:15px;line-height:22px;color:var(--ds-ink-soft,#4a4a4f)}
.session-guard__panel button{display:block;width:100%;min-height:44px;border:0;border-radius:999px;font:inherit;font-weight:800;cursor:pointer}
.session-guard__go{background:var(--ds-btn-go,#15803d);color:#fff}
.session-guard__later{margin-top:8px;background:transparent;color:var(--ds-ink,#0b0b0c)}
@media (min-width:700px){.session-guard{align-items:center}.session-guard__panel{border-radius:16px}}`;
  document.head.append(style);
})();
