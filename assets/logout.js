"use strict";

for (const button of document.querySelectorAll("[data-logout]")) {
  button.addEventListener("click", async event => {
    event.preventDefault();
    if (!confirm("Log out of your DanzStak account?")) return;
    button.disabled = true;
    button.setAttribute("aria-disabled", "true");
    const original = button.textContent;
    button.textContent = "Logging out…";
    try {
      const response = await fetch("https://api.danzstak.com/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      if (!response.ok) throw new Error("Logout failed");
      sessionStorage.removeItem("danzstak_install_prompt_shown");
      location.replace("./");
    } catch {
      button.disabled = false;
      button.removeAttribute("aria-disabled");
      button.textContent = original;
      alert("Logout failed. Please try again.");
    }
  });
}
