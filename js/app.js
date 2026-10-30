(function () {
  "use strict";

  const EVENTS = (window.TR_EVENTS || []).slice();
  const TYPES = window.TR_TYPES || [];
  const SPACES = ["Bookstore", "Library", "Other Venue"];
  const $ = (id) => document.getElementById(id);

  const pad = (n) => String(n).padStart(2, "0");
  const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const TODAY = isoDate(new Date());

  // Search text is precomputed once per event.
  for (const e of EVENTS) {
    e._text = [e.title, e.host, e.location, e.city, e.county, e.space, e.notes, ...e.types].join(" ").toLowerCase();
  }

  const state = {
    q: "",
    types: new Set(),
    city: "",
    space: "",
    past: false,
    view: "list",
    month: null, // "YYYY-MM"
    day: null,   // "YYYY-MM-DD" selected in calendar
  };

  /* ---------- URL hash state, so filtered views can be shared ---------- */
  function readHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    state.q = p.get("q") || "";
    state.types = new Set((p.get("type") || "").split(",").filter((t) => TYPES.includes(t)));
    state.city = p.get("city") || "";
    state.space = p.get("space") || "";
    state.past = p.get("past") === "1";
    state.view = p.get("view") === "calendar" ? "calendar" : "list";
    state.month = /^\d{4}-\d{2}$/.test(p.get("month") || "") ? p.get("month") : null;
    state.day = /^\d{4}-\d{2}-\d{2}$/.test(p.get("day") || "") ? p.get("day") : null;
  }

  function writeHash() {
    const p = new URLSearchParams();
    if (state.q) p.set("q", state.q);
    if (state.types.size) p.set("type", [...state.types].join(","));
    if (state.city) p.set("city", state.city);
    if (state.space) p.set("space", state.space);
    if (state.past) p.set("past", "1");
    if (state.view === "calendar") {
      p.set("view", "calendar");
      if (state.month) p.set("month", state.month);
      if (state.day) p.set("day", state.day);
    }
    const h = p.toString();
    history.replaceState(null, "", h ? "#" + h : location.pathname + location.search);
  }

  /* ---------- Filtering ---------- */
  function matches(e, opts = {}) {
    if (!opts.ignorePast && !state.past && e.date < TODAY) return false;
    if (!opts.ignoreType && state.types.size && !e.types.some((t) => state.types.has(t))) return false;
    if (state.city && e.city !== state.city) return false;
    if (state.space && e.space !== state.space) return false;
    if (state.q) {
      const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
      if (!words.every((w) => e._text.includes(w))) return false;
    }
    return true;
  }

  /* ---------- Formatting ---------- */
  const parseDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const fmtDay = (s) => parseDate(s).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  function fmtTime(t) {
    if (!t) return "";
    let [h, m] = t.split(":").map(Number);
    const ap = h >= 12 ? "pm" : "am";
    h = h % 12 || 12;
    return m ? `${h}:${pad(m)} ${ap}` : `${h} ${ap}`;
  }
  function timeRange(e) {
    if (!e.start || e.start === "00:00" && (!e.end || e.end === "23:59")) return "All day";
    return e.end && e.end !== e.start ? `${fmtTime(e.start)} – ${fmtTime(e.end)}` : fmtTime(e.start);
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function gcalLink(e) {
    const d = e.date.replace(/-/g, "");
    const t = (x) => (x || "").replace(":", "") + "00";
    const next = parseDate(e.date); next.setDate(next.getDate() + 1);
    const dates = e.start ? `${d}T${t(e.start)}/${d}T${t(e.end || e.start)}` : `${d}/${isoDate(next).replace(/-/g, "")}`;
    const p = new URLSearchParams({
      action: "TEMPLATE",
      text: e.title,
      dates,
      ctz: "America/New_York",
      location: e.location,
      details: `${e.host}\n${e.url}`,
    });
    return "https://calendar.google.com/calendar/render?" + p.toString();
  }
  // Notes like "end time assumed" are for the editor, not readers.
  const publicNote = (n) => n.split(";").map((s) => s.trim()).filter((s) => s && !/assumed|not stated/i.test(s)).join(" · ");

  function eventCard(e) {
    const note = publicNote(e.notes);
    return `
      <li class="event" data-type="${esc(e.types[0])}">
        <div class="time">${esc(timeRange(e))}</div>
        <div>
          <h3><a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.title)}</a></h3>
          <p class="meta"><strong>${esc(e.host)}</strong> · ${esc(e.location)}</p>
          <div class="tags">
            ${e.types.map((t) => `<span class="tag" data-type="${esc(t)}">${esc(t)}</span>`).join("")}
            <span class="tag space">${esc(e.space)}</span>
            <span class="tag space">${esc(e.city)}</span>
            ${note ? `<span class="note">${esc(note)}</span>` : ""}
          </div>
          <div class="actions">
            <a href="${esc(e.url)}" target="_blank" rel="noopener">Event details</a>
            <a href="${esc(gcalLink(e))}" target="_blank" rel="noopener">Add to Google Calendar</a>
          </div>
        </div>
      </li>`;
  }

  function groupedList(events) {
    if (!events.length) {
      return `<div class="empty">No events match these filters. <button class="link-btn" type="button" data-clear>Clear filters</button></div>`;
    }
    const byDay = new Map();
    for (const e of events) {
      if (!byDay.has(e.date)) byDay.set(e.date, []);
      byDay.get(e.date).push(e);
    }
    let html = "";
    for (const [day, list] of byDay) {
      const rel = day === TODAY ? "Today" : "";
      html += `<div class="day-group"><h2 class="day-head">${esc(fmtDay(day))}${rel ? `<small>${rel}</small>` : ""}</h2><ul class="events">${list.map(eventCard).join("")}</ul></div>`;
    }
    return html;
  }

  /* ---------- Controls ---------- */
  function buildControls() {
    const cities = [...new Set(EVENTS.map((e) => e.city).filter(Boolean))].sort();
    $("city").insertAdjacentHTML("beforeend", cities.map((c) => `<option>${esc(c)}</option>`).join(""));
    const spaces = SPACES.filter((s) => EVENTS.some((e) => e.space === s));
    $("space").insertAdjacentHTML("beforeend", spaces.map((s) => `<option>${esc(s)}</option>`).join(""));

    const types = TYPES.filter((t) => EVENTS.some((e) => e.types.includes(t)));
    $("types").innerHTML = types
      .map((t) => `<button type="button" class="chip" data-type="${esc(t)}" aria-pressed="false">${esc(t)} <span class="n"></span></button>`)
      .join("");

    $("types").addEventListener("click", (ev) => {
      const b = ev.target.closest(".chip");
      if (!b) return;
      const t = b.dataset.type;
      state.types.has(t) ? state.types.delete(t) : state.types.add(t);
      render();
    });
    let timer;
    $("q").addEventListener("input", (ev) => {
      clearTimeout(timer);
      timer = setTimeout(() => { state.q = ev.target.value.trim(); render(); }, 120);
    });
    $("city").addEventListener("change", (ev) => { state.city = ev.target.value; render(); });
    $("space").addEventListener("change", (ev) => { state.space = ev.target.value; render(); });
    $("past").addEventListener("change", (ev) => { state.past = ev.target.checked; render(); });
    $("clear").addEventListener("click", clearFilters);
    document.addEventListener("click", (ev) => { if (ev.target.closest("[data-clear]")) clearFilters(); });

    document.querySelectorAll(".view-tabs button").forEach((b) =>
      b.addEventListener("click", () => { state.view = b.dataset.view; render(); })
    );
    $("prev").addEventListener("click", () => shiftMonth(-1));
    $("next").addEventListener("click", () => shiftMonth(1));
    $("today").addEventListener("click", () => { state.month = TODAY.slice(0, 7); state.day = null; render(); });
    $("cal-grid").addEventListener("click", (ev) => {
      const c = ev.target.closest(".cell[data-date]");
      if (!c) return;
      state.day = state.day === c.dataset.date ? null : c.dataset.date;
      render();
      if (state.day) $("day-detail").scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function clearFilters() {
    state.q = ""; state.types.clear(); state.city = ""; state.space = ""; state.past = false; state.day = null;
    render();
  }

  function shiftMonth(n) {
    const [y, m] = state.month.split("-").map(Number);
    const d = new Date(y, m - 1 + n, 1);
    state.month = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    state.day = null;
    render();
  }

  function defaultMonth() {
    const cur = TODAY.slice(0, 7);
    if (EVENTS.some((e) => e.date.startsWith(cur) && e.date >= TODAY)) return cur;
    const next = EVENTS.find((e) => e.date >= TODAY) || EVENTS[EVENTS.length - 1];
    return next ? next.date.slice(0, 7) : cur;
  }

  function syncControls() {
    $("q").value !== state.q && ($("q").value = state.q);
    $("city").value = state.city;
    $("space").value = state.space;
    $("past").checked = state.past;
    document.querySelectorAll(".chip").forEach((b) => {
      b.setAttribute("aria-pressed", state.types.has(b.dataset.type) ? "true" : "false");
      b.querySelector(".n").textContent = EVENTS.filter((e) => e.types.includes(b.dataset.type) && matches(e, { ignoreType: true })).length;
    });
    document.querySelectorAll(".view-tabs button").forEach((b) => b.setAttribute("aria-selected", b.dataset.view === state.view ? "true" : "false"));
    $("list-view").hidden = state.view !== "list";
    $("cal-view").hidden = state.view !== "calendar";
  }

  /* ---------- Calendar ---------- */
  function renderCalendar() {
    const [y, m] = state.month.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    $("cal-title").textContent = first.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    // Calendar shows the whole month, past days included, with the other filters applied.
    const inMonth = EVENTS.filter((e) => e.date.startsWith(state.month) && matches(e, { ignorePast: true }));
    const byDay = new Map();
    for (const e of inMonth) {
      if (!byDay.has(e.date)) byDay.set(e.date, []);
      byDay.get(e.date).push(e);
    }

    let html = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => `<div class="dow">${d}</div>`).join("");
    const start = new Date(y, m - 1, 1 - first.getDay());
    const weeks = Math.ceil((first.getDay() + new Date(y, m, 0).getDate()) / 7);
    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const iso = isoDate(d);
      if (d.getMonth() !== m - 1) {
        html += `<div class="cell out" aria-hidden="true"><span class="num">${d.getDate()}</span></div>`;
        continue;
      }
      const list = byDay.get(iso) || [];
      const label = `${fmtDay(iso)}: ${list.length} event${list.length === 1 ? "" : "s"}`;
      const shown = list.slice(0, 3);
      html += `<button type="button" class="cell${iso === TODAY ? " today" : ""}" data-date="${iso}" aria-pressed="${state.day === iso}" aria-label="${esc(label)}">
        <span class="num">${d.getDate()}</span>
        ${shown.map((e) => `<span class="pill" data-type="${esc(e.types[0])}" title="${esc(fmtTime(e.start) + " " + e.title)}">${esc(e.title)}</span>`).join("")}
        ${list.length > 3 ? `<span class="more">+${list.length - 3} more</span>` : ""}
        <span class="dots">${list.map((e) => `<span class="dot" data-type="${esc(e.types[0])}"></span>`).join("")}</span>
      </button>`;
    }
    $("cal-grid").innerHTML = html;

    const detail = state.day && state.day.startsWith(state.month) ? (byDay.get(state.day) || []) : null;
    $("day-detail").innerHTML = detail
      ? (detail.length ? groupedList(detail) : `<div class="empty">Nothing on ${esc(fmtDay(state.day))} with these filters.</div>`)
      : (inMonth.length ? `<p class="note">Select a day to see its events.</p>` : `<div class="empty">No events this month match these filters.</div>`);
  }

  /* ---------- Render ---------- */
  function render() {
    if (!state.month) state.month = defaultMonth();
    syncControls();
    const results = EVENTS.filter((e) => matches(e));
    $("count").textContent = `${results.length} event${results.length === 1 ? "" : "s"}${state.past ? "" : " coming up"}`;
    if (state.view === "list") $("list-view").innerHTML = groupedList(results);
    else renderCalendar();
    writeHash();
  }

  readHash();
  buildControls();
  render();
  if (EVENTS.length) {
    const last = EVENTS[EVENTS.length - 1].date;
    $("updated").textContent = `Listings currently run through ${fmtDay(last)}.`;
  }
  window.addEventListener("hashchange", () => { readHash(); render(); });
})();
