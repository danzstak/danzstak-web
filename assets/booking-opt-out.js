"use strict";
(() => {
  const button = document.getElementById("confirmOptOut"), status = document.getElementById("optOutStatus");
  const token = new URLSearchParams(location.hash.slice(1)).get("token") || "";
  history.replaceState(null, "", `${location.pathname}${location.search}`);
  if (!/^[a-f0-9]{64}$/.test(token)) { status.textContent = "This opt-out link is invalid or expired. Ask support for help."; return; }
  button.disabled = false;
  status.textContent = "Use the button to stop future DanzStak booking pitches to this address.";
  button.addEventListener("click", async () => {
    button.disabled = true; status.textContent = "Saving your choice…";
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch("https://api.danzstak.com/tour-manager/opt-out", { method:"POST", cache:"no-store", credentials:"omit", signal:controller.signal, headers:{"content-type":"application/json"}, body:JSON.stringify({ token }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Your choice could not be saved.");
      status.textContent = data.alreadyOptedOut ? "This address was already opted out. No future DanzStak booking pitches will be sent." : "Done. No future DanzStak booking pitches will be sent to this address.";
      button.hidden = true;
    } catch (error) {
      status.textContent = error.name === "AbortError" ? "The request took too long. Check your connection and try again." : error.message;
      button.disabled = false;
    } finally { clearTimeout(timer); }
  });
})();
