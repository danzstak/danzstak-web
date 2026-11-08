"use strict";

(function () {
  const api = "https://api.danzstak.com";
  const phrase = "DELETE MY DANZSTAK ACCOUNT";

  async function request(options = {}) {
    const response = await fetch(api + "/account-deletion", { credentials: "include", cache: "no-store", ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || "Your deletion request could not be updated.");
      error.reauthRequired = data.reauthRequired === true;
      throw error;
    }
    return data;
  }

  function createDialog(opener) {
    const dialog = document.createElement("dialog");
    dialog.className = "account-deletion-dialog";
    dialog.setAttribute("aria-labelledby", "accountDeletionTitle");
    const title = document.createElement("h2"); title.id = "accountDeletionTitle"; title.textContent = "Delete your DanzStak account";
    const content = document.createElement("div"); content.className = "account-deletion-content";
    const status = document.createElement("p"); status.className = "account-deletion-status"; status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
    const actions = document.createElement("div"); actions.className = "account-deletion-actions";
    const close = document.createElement("button"); close.type = "button"; close.className = "secondary"; close.textContent = "Close";
    close.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => { dialog.remove(); opener?.focus(); });
    dialog.addEventListener("cancel", event => { event.preventDefault(); dialog.close(); });
    actions.append(close); content.append(status, actions); dialog.append(title, content); document.body.append(dialog);
    return { dialog, status, actions, close };
  }

  function actionButton(label, className, handler, onError) {
    const button = document.createElement("button"); button.type = "button"; button.className = className; button.textContent = label;
    button.addEventListener("click", async () => {
      button.disabled = true;
      try { await handler(button); }
      catch (error) { onError?.(error); }
      finally { if (button.isConnected) button.disabled = false; }
    });
    return button;
  }

  async function open(opener) {
    const ui = createDialog(opener); ui.status.textContent = "Checking your request…"; ui.dialog.showModal();
    const render = deletion => {
      ui.actions.replaceChildren(ui.close);
      if (["completed", "completed_limited_retention"].includes(deletion?.status)) {
        ui.status.textContent = `Deletion completed. Receipt ${deletion.requestId || ""}. Limited required records expire according to the Privacy Policy.`;
        return;
      }
      if (["request_received", "in_progress", "failed"].includes(deletion?.status)) {
        ui.status.textContent = deletion.status === "request_received"
          ? "Permanent deletion is queued. It cannot be cancelled or restored."
          : deletion.status === "failed"
            ? "DanzStak could not finish one deletion step. The secure worker will retry it; your request remains recorded."
            : "Permanent account deletion is being processed. It cannot be cancelled or restored.";
        return;
      }
      const verified = new URLSearchParams(location.search).get("deletion") === "verified";
      ui.status.textContent = "Download anything you want to keep first. After you confirm, permanent deletion starts immediately and cannot be undone. Your originals and their DanzStak shares will be removed. Screenshots, downloads, independent reuploads, and copies outside DanzStak cannot be recalled. Limited records may remain only where required for payments, safety, legal obligations, backups, or cache expiry.";
      if (!verified) {
        const verify = document.createElement("a"); verify.className = "primary"; verify.href = api + "/auth/account-deletion/reauth"; verify.textContent = "Verify identity to continue";
        ui.actions.prepend(verify); return;
      }
      const label = document.createElement("label"); label.textContent = `Type ${phrase} to confirm`;
      const input = document.createElement("input"); input.autocomplete = "off"; input.spellcheck = false; input.setAttribute("aria-label", `Type ${phrase} to confirm account deletion`);
      label.append(input); ui.content?.append?.(label);
      const confirm = actionButton("Delete permanently now", "danger", async () => {
        if (input.value !== phrase) { ui.status.textContent = `Type the exact phrase: ${phrase}`; input.focus(); return; }
        const result = await request({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: input.value }) });
        label.remove(); history.replaceState(history.state, "", location.pathname + "?view=settings"); render(result);
      }, error => { ui.status.textContent = error.message; });
      ui.actions.prepend(confirm); input.focus();
    };
    ui.content = ui.dialog.querySelector(".account-deletion-content");
    try { render(await request()); }
    catch (error) {
      ui.status.textContent = error.message;
      ui.actions.prepend(actionButton("Try again", "secondary", async () => { ui.status.textContent = "Checking your request…"; render(await request()); }, retryError => { ui.status.textContent = retryError.message; }));
    }
  }

  function control() {
    const button = document.createElement("button"); button.type = "button"; button.className = "danger-outline"; button.textContent = "Delete account";
    button.setAttribute("aria-label", "Review permanent account deletion"); button.addEventListener("click", () => open(button)); return button;
  }

  window.danzstakAccountDeletionControl = control;
})();
