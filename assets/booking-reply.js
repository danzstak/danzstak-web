(() => {
  const params = new URLSearchParams(location.hash.slice(1)), token = params.get("token") || "", form = document.getElementById("replyForm"), action = document.getElementById("replyAction"), dateLabel = document.getElementById("dateLabel"), date = document.getElementById("proposedDate"), content = document.getElementById("replyContent"), status = document.getElementById("replyStatus"), button = form.querySelector("button");
  history.replaceState(null, "", `${location.pathname}${location.search}`);
  const valid = /^[a-f0-9]{64}$/.test(token);
  if (!valid) { form.hidden = true; status.textContent = "This secure reply link is invalid or expired."; }
  action.addEventListener("change", () => { dateLabel.hidden = action.value !== "offer_date"; date.required = action.value === "offer_date"; });
  form.addEventListener("submit", async event => {
    event.preventDefault(); if (!valid || !content.value.trim()) return;
    button.disabled = true; status.textContent = "Sending your reply…";
    const clientMessageId = crypto.randomUUID().replaceAll("-", "");
    try {
      const response = await fetch("https://api.danzstak.com/tour-manager/reply", { method:"POST", credentials:"omit", cache:"no-store", headers:{"content-type":"application/json"}, body:JSON.stringify({ token, action:action.value, proposedDate:date.value, content:content.value.trim(), clientMessageId }) });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Your reply could not be sent.");
      form.hidden = true; status.textContent = "Reply sent to the artist. You may close this page.";
    } catch (error) { status.textContent = error.message; button.disabled = false; }
  });
})();
