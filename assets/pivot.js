"use strict";

(() => {
  let activeTrigger = null;

  const guides = {
    facebook: {
      label: "Facebook",
      title: "Bring your Facebook data",
      steps: [
        "Open Facebook Accounts Center, then Your information and permissions.",
        "Choose Download or export your information, then Export to device.",
        "Choose JSON format, All time, and high media quality. Include profile information, posts, photos, and videos.",
        "Download the ZIP when Facebook says it is ready, then return here and choose it."
      ],
      link: "https://www.facebook.com/help/212802592074644",
      linkLabel: "Open Facebook export help",
      ready: true,
      checked: "Last checked November 7, 2026"
    },
    instagram: {
      label: "Instagram",
      title: "Get your Instagram export ready",
      steps: [
        "Open Instagram Accounts Center, then Your information and permissions.",
        "Choose Export your information, Create export, then Export to device.",
        "Select the Instagram profile you are moving. Choose All time, JSON format, and high media quality.",
        "Download the ZIP when Meta says it is ready and keep it private."
      ],
      link: "https://accountscenter.instagram.com/info_and_permissions/dyi/",
      linkLabel: "Open Instagram Accounts Center",
      ready: false,
      checked: "Guide checked November 7, 2026"
    },
    reddit: {
      label: "Reddit",
      title: "Request your Reddit data",
      steps: [
        "Open Reddit's data request page in a browser and sign in to the account you are moving.",
        "Follow the data-request form and submit it.",
        "Reddit may take up to 30 days. It sends the download link to your Reddit inbox or verified email.",
        "Download the archive and keep it private."
      ],
      link: "https://www.reddit.com/settings/data-request",
      linkLabel: "Request my Reddit data",
      ready: false,
      checked: "Guide checked November 7, 2026"
    }
  };

  const dialog = document.createElement("dialog");
  dialog.className = "pivot-dialog";
  dialog.setAttribute("aria-labelledby", "movingDayTitle");
  dialog.innerHTML = `<header><div><p class="pivot-kicker">Pivot</p><h2 id="movingDayTitle">Moving Day</h2><p>Clean house before you move your data.</p></div><button type="button" class="pivot-close" data-icon="close" aria-label="Close Moving Day" title="Close Moving Day"></button></header><div class="pivot-body"><p class="pivot-intro"><strong>Pivot away from billionaire platforms.</strong> Choose what to move to DanzStak. <strong>You own the data you choose to move.</strong> Preview the export and select only what belongs here. DanzStak never asks for your password or logs in to another platform.</p><div class="pivot-platforms" role="tablist" aria-label="Choose a platform"></div><section class="pivot-guide" aria-live="polite"></section><p class="pivot-tracking"><strong>Your imported content is trackable inside DanzStak.</strong> Each imported item receives a DanzStak content identity so its origin, attribution, and DanzStak reshares stay attached. DanzStak tracks content, not people. Independent screenshots or copies uploaded to another platform may not be traceable or removable by DanzStak.</p><p class="pivot-privacy"><strong>Nothing imports automatically.</strong> Your export stays on your device until you review it and choose what to bring. Imported Facebook posts start as <strong>Just me</strong> until you change their audience.</p></div>`;
  document.body.append(dialog);
  const platforms = dialog.querySelector(".pivot-platforms");
  const guide = dialog.querySelector(".pivot-guide");
  let active = "facebook";

  function renderGuide() {
    const data = guides[active];
    for (const button of platforms.querySelectorAll("button")) {
      const selected = button.dataset.platform === active;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
    guide.innerHTML = "";
    const heading = document.createElement("h3"); heading.textContent = data.title;
    const list = document.createElement("ol");
    for (const step of data.steps) { const item = document.createElement("li"); item.textContent = step; list.append(item); }
    const actions = document.createElement("div"); actions.className = "pivot-guide-actions";
    const official = document.createElement("a"); official.href = data.link; official.target = "_blank"; official.rel = "noopener noreferrer"; official.referrerPolicy = "no-referrer"; official.textContent = data.linkLabel; actions.append(official);
    if (data.ready) {
      const choose = document.createElement("button"); choose.type = "button"; choose.className = "primary"; choose.textContent = "Choose Facebook export";
      choose.addEventListener("click", () => { dialog.close(); window.openDanzStakFacebookImport?.(activeTrigger); });
      actions.prepend(choose);
    } else {
      const note = document.createElement("p"); note.className = "pivot-availability"; note.textContent = `${data.label} preview and selective import are not ready yet. Download your export, keep it private, and do not upload it to DanzStak yet.`; guide.append(heading, list, note, actions);
      const checked = document.createElement("p"); checked.className = "pivot-checked"; checked.textContent = data.checked; guide.append(checked); return;
    }
    const checked = document.createElement("p"); checked.className = "pivot-checked"; checked.textContent = data.checked;
    guide.append(heading, list, actions, checked);
  }

  for (const [key, data] of Object.entries(guides)) {
    const button = document.createElement("button"); button.type = "button"; button.className = "pivot-platform"; button.dataset.platform = key; button.setAttribute("role", "tab"); button.textContent = data.label;
    button.addEventListener("click", () => { active = key; renderGuide(); }); platforms.append(button);
  }
  platforms.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    const buttons = [...platforms.querySelectorAll("button")], current = buttons.indexOf(document.activeElement); if (current < 0) return;
    event.preventDefault(); const delta = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1; const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (current + delta + buttons.length) % buttons.length; buttons[next].click(); buttons[next].focus();
  });
  dialog.querySelector(".pivot-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => activeTrigger?.isConnected && activeTrigger.focus());
  document.addEventListener("click", event => {
    const trigger = event.target.closest?.("[data-pivot-trigger]");
    if (!trigger) return;
    activeTrigger = trigger;
    active = "facebook";
    renderGuide();
    dialog.showModal();
    setTimeout(() => platforms.querySelector("button")?.focus(), 0);
  });
  renderGuide();
})();
