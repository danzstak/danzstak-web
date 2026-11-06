"use strict";

(() => {
  const core = window.DanzStakDailyNudgeCore;
  if (!core || !document.body?.classList.contains("danzstak-original")) return;

  const keys = {
    seed: "danzstak_daily_nudge_seed_v1",
    seenDay: "danzstak_daily_nudge_seen_day_v1",
    seenOrdinal: "danzstak_daily_nudge_seen_ordinal_v1",
    choices: "danzstak_daily_nudge_choices_v1",
    recent: "danzstak_daily_nudge_recent_v1"
  };
  const memory = new Map();
  const read = key => {
    try { const value = localStorage.getItem(key); if (value !== null) return value; } catch { /* use session fallback */ }
    try { const value = sessionStorage.getItem(key); if (value !== null) return value; } catch { /* use memory fallback */ }
    return memory.get(key) || "";
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, value); return; } catch { /* use session fallback */ }
    try { sessionStorage.setItem(key, value); return; } catch { memory.set(key, value); }
  };
  const parse = (value, fallback) => { try { const result = JSON.parse(value); return result ?? fallback; } catch { return fallback; } };

  function installationSeed() {
    let seed = read(keys.seed);
    if (/^[a-f0-9]{32}$/.test(seed)) return seed;
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    seed = [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
    write(keys.seed, seed);
    return seed;
  }

  const day = core.localDay(new Date());
  const lastOrdinal = Number(read(keys.seenOrdinal) || -1);
  if (read(keys.seenDay) === day.key || day.ordinal <= lastOrdinal) return;

  const choices = parse(read(keys.choices), {});
  const recent = parse(read(keys.recent), []);
  const index = Number.isInteger(choices[day.key]) ? choices[day.key] : core.chooseIndex(installationSeed(), day.key, recent);
  choices[day.key] = index;
  const trimmedChoices = Object.fromEntries(Object.entries(choices).sort(([a], [b]) => b.localeCompare(a)).slice(0, 8));
  write(keys.choices, JSON.stringify(trimmedChoices));
  write(keys.recent, JSON.stringify([...recent, index].slice(-3)));
  write(keys.seenDay, day.key);
  write(keys.seenOrdinal, String(Math.max(lastOrdinal, day.ordinal)));

  const surface = document.createElement("aside");
  surface.className = "daily-nudge";
  surface.setAttribute("role", "status");
  surface.setAttribute("aria-live", "polite");
  surface.innerHTML = '<span class="daily-nudge-mark" aria-hidden="true">D</span><p></p><button type="button" aria-label="Dismiss Daily Nudge" title="Dismiss">×</button>';
  const copy = surface.querySelector("p");
  const dismiss = surface.querySelector("button");
  let timer = 0;
  let closed = false;

  function render() {
    const labels = core.uiLabels(document.documentElement.lang);
    surface.setAttribute("aria-label", labels[0]);
    dismiss.setAttribute("aria-label", labels[1]);
    dismiss.title = labels[2];
    copy.textContent = core.text(index, document.documentElement.lang);
  }
  function position() {
    const bottom = Math.max(0, document.querySelector(".topbar")?.getBoundingClientRect().bottom || 0);
    surface.style.setProperty("--daily-nudge-top", `${Math.round(bottom + 8)}px`);
  }
  function close() {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    surface.classList.add("is-leaving");
    const finish = () => surface.remove();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) finish();
    else surface.addEventListener("animationend", finish, { once: true });
    setTimeout(finish, 350);
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (surface.matches(":focus-within")) surface.addEventListener("focusout", schedule, { once: true });
      else close();
    }, 7000);
  }

  dismiss.addEventListener("click", close);
  surface.addEventListener("mouseenter", () => clearTimeout(timer));
  surface.addEventListener("mouseleave", schedule);
  surface.addEventListener("focusin", () => clearTimeout(timer));
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  render();
  document.querySelector(".topbar")?.insertAdjacentElement("afterend", surface);
  position();
  addEventListener("resize", position, { passive: true });
  if (typeof ResizeObserver === "function") new ResizeObserver(position).observe(document.querySelector(".topbar"));
  requestAnimationFrame(() => surface.classList.add("is-visible"));
  schedule();
})();
