"use strict";
(() => {
  const dialog = document.getElementById("plansDialog"),
    form = document.getElementById("plansForm"),
    openButton = document.getElementById("makePlans"),
    closeButton = dialog?.querySelector(".plans-close"),
    status = document.getElementById("plansStatus"),
    list = document.getElementById("plansList"),
    timezone = document.getElementById("planTimezone"),
    id = document.getElementById("planId"),
    revision = document.getElementById("planRevision"),
    title = document.getElementById("planTitleInput"),
    when = document.getElementById("planWhen"),
    locationField = document.getElementById("planLocation"),
    note = document.getElementById("planNote"),
    cancelButton = dialog?.querySelector(".plans-cancel"),
    saveButton = dialog?.querySelector(".plans-save"),
    contact = document.getElementById("contactEmail");
  if (!dialog || !form || !openButton) return;
  const api = "https://api.danzstak.com",
    t = (value) => window.danzstakTranslate?.(value) || value;
  const zones = [
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    "UTC",
    "Europe/Rome",
    "Europe/Berlin",
    "America/Los_Angeles",
    "America/New_York",
    "Asia/Tokyo",
    "Australia/Sydney",
  ].filter((value, index, items) => value && items.indexOf(value) === index);
  for (const zone of zones) {
    const option = document.createElement("option");
    option.value = zone;
    option.textContent = zone.replaceAll("_", " ");
    timezone.appendChild(option);
  }
  const request = async (path, options = {}) => {
    const response = await fetch(api + path, {
        credentials: "include",
        cache: "no-store",
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      }),
      body = await response.json().catch(() => ({}));
    if (!response.ok)
      throw Object.assign(
        new Error(t(body.error || "Plans are temporarily unavailable.")),
        { response, body },
      );
    return body;
  };
  const localValue = (iso) => {
    const date = new Date(iso),
      offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
  };
  const reset = () => {
    id.value = "";
    revision.value = "0";
    title.value = "";
    locationField.value = "";
    note.value = "";
    timezone.value = zones[0];
    const next = new Date(Date.now() + 3600000);
    next.setMinutes(Math.ceil(next.getMinutes() / 15) * 15, 0, 0);
    when.value = localValue(next.toISOString());
    cancelButton.hidden = true;
    saveButton.textContent = t("Send invitation");
    status.textContent = "";
  };
  const downloadIcs = (plan) => {
    const clean = (value) =>
        String(value || "")
          .replaceAll("\\", "\\\\")
          .replaceAll(/\r?\n/g, "\\n")
          .replaceAll(",", "\\,")
          .replaceAll(";", "\\;"),
      stamp = (value) =>
        new Date(value)
          .toISOString()
          .replaceAll(/[-:]/g, "")
          .replace(".000", "");
    const end = new Date(Date.parse(plan.startAt) + 7200000).toISOString(),
      ics =
        [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//DANZSTAK//Make Plans//EN",
          "CALSCALE:GREGORIAN",
          "METHOD:PUBLISH",
          "BEGIN:VEVENT",
          `UID:${plan.planId}@danzstak.com`,
          `DTSTAMP:${stamp(new Date())}`,
          `DTSTART:${stamp(plan.startAt)}`,
          `DTEND:${stamp(end)}`,
          `SUMMARY:${clean(plan.title)}`,
          plan.location ? `LOCATION:${clean(plan.location)}` : "",
          plan.note ? `DESCRIPTION:${clean(plan.note)}` : "",
          "END:VEVENT",
          "END:VCALENDAR",
        ]
          .filter(Boolean)
          .join("\r\n") + "\r\n",
      url = URL.createObjectURL(
        new Blob([ics], { type: "text/calendar;charset=utf-8" }),
      ),
      link = document.createElement("a");
    link.href = url;
    link.download = "danzstak-plan.ics";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const edit = (plan) => {
    id.value = plan.planId;
    revision.value = String(plan.revision);
    title.value = plan.title;
    when.value = localValue(plan.startAt);
    timezone.value = plan.timezone;
    if (!timezone.value) {
      const option = document.createElement("option");
      option.value = plan.timezone;
      option.textContent = plan.timezone;
      timezone.appendChild(option);
      timezone.value = plan.timezone;
    }
    locationField.value = plan.location || "";
    note.value = plan.note || "";
    cancelButton.hidden = plan.status === "cancelled";
    saveButton.textContent = t("Save changes");
    form.scrollIntoView({ block: "start" });
    title.focus();
  };
  const action = async (plan, kind, value = "") => {
    status.textContent = t("Saving…");
    try {
      const body = {
          revision: plan.revision,
          ...(kind === "respond" ? { status: value } : {}),
        },
        result = await request(`/plans/${plan.planId}/${kind}`, {
          method: "POST",
          body: JSON.stringify(body),
        });
      status.textContent = t("Saved.");
      await load();
      return result;
    } catch (error) {
      status.textContent = error.message;
      if (error.body?.plan) await load();
    }
  };
  const render = (plans) => {
    list.replaceChildren();
    for (const plan of plans) {
      const card = document.createElement("article");
      card.className = "plan-card";
      const heading = document.createElement("h3");
      heading.textContent = plan.title;
      const time = document.createElement("p");
      time.textContent =
        new Intl.DateTimeFormat([], {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: plan.timezone,
        }).format(new Date(plan.startAt)) + ` (${plan.timezone})`;
      const place = document.createElement("p");
      place.textContent = plan.location || t("Meeting place not set");
      const badge = document.createElement("span");
      badge.className = "plan-badge";
      badge.textContent = t(
        plan.status.charAt(0).toUpperCase() + plan.status.slice(1),
      );
      const actions = document.createElement("div");
      actions.className = "plan-card-actions";
      if (plan.role === "invitee" && !["cancelled"].includes(plan.status))
        for (const [value, label] of [
          ["going", "Going"],
          ["maybe", "Maybe"],
          ["declined", "Decline"],
        ]) {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = t(label);
          button.disabled = plan.status === value;
          button.addEventListener("click", () =>
            action(plan, "respond", value),
          );
          actions.appendChild(button);
        }
      if (plan.role === "inviter" && plan.status !== "cancelled") {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = t("Edit");
        button.addEventListener("click", () => edit(plan));
        actions.appendChild(button);
      }
      if (plan.status === "going") {
        const calendar = document.createElement("button");
        calendar.type = "button";
        calendar.textContent = t("Add to calendar");
        calendar.addEventListener("click", () => downloadIcs(plan));
        actions.appendChild(calendar);
      }
      card.append(heading, time, place, badge, actions);
      list.appendChild(card);
    }
    if (!list.children.length) {
      const empty = document.createElement("p");
      empty.className = "plans-status";
      empty.textContent = t("No plans with this friend yet.");
      list.appendChild(empty);
    }
  };
  const load = async () => {
    try {
      const data = await request(
        `/plans?contact=${encodeURIComponent(contact.value)}`,
      );
      render(data.plans || []);
    } catch (error) {
      list.textContent = error.message;
    }
  };
  openButton.addEventListener("click", async () => {
    if (!contact.value) return;
    reset();
    dialog.showModal();
    await load();
    title.focus();
  });
  closeButton.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const recipientEmail = contact.value;
    if (!recipientEmail) return;
    saveButton.disabled = true;
    status.textContent = t("Saving…");
    try {
      const payload = {
          title: title.value,
          startAt: new Date(when.value).toISOString(),
          timezone: timezone.value,
          location: locationField.value,
          note: note.value,
          recipientEmail,
          clientRequestId: id.value ? "" : crypto.randomUUID(),
        },
        path = id.value ? `/plans/${id.value}` : "/plans",
        method = id.value ? "PATCH" : "POST",
        body = {
          ...payload,
          ...(id.value ? { revision: Number(revision.value) } : {}),
        };
      await request(path, { method, body: JSON.stringify(body) });
      reset();
      status.textContent = t("Invitation saved.");
      await load();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      saveButton.disabled = false;
    }
  });
  cancelButton.addEventListener("click", async () => {
    if (!id.value || !confirm(t("Cancel this plan?"))) return;
    await action(
      { planId: id.value, revision: Number(revision.value) },
      "cancel",
    );
    reset();
  });
  const requested = new URLSearchParams(location.search).get("plan");
  const pendingRequested = sessionStorage.getItem("danzstakRequestedPlan");
  if (pendingRequested) sessionStorage.removeItem("danzstakRequestedPlan");
  if ((requested && /^[a-f0-9]{32}$/.test(requested)) || (pendingRequested && /^[a-f0-9]{32}$/.test(pendingRequested)))
    setTimeout(() => openButton.click(), 600);
})();
