(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, "0");
  const d = new Date();
  const TODAY = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const EVENTS = window.TR_EVENTS || [];
  const VENUES = (window.TR_VENUES || []).filter((v) => v.lat && v.lon).sort((a, b) => a.name.localeCompare(b.name));

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  const upcoming = new Map();
  for (const e of EVENTS) {
    if ((e.endDate || e.date) >= TODAY) upcoming.set(e.host, (upcoming.get(e.host) || 0) + 1);
  }
  for (const v of VENUES) {
    v.count = upcoming.get(v.name) || 0;
    v._text = [v.name, v.kind, v.system, v.town, v.county, v.address, v.notes].join(" ").toLowerCase();
  }

  // David's CARTO API key, published at his request (2026-10-30).
  const CARTO_API_KEY = "cb1_4y3t_1_e634de350efc968ed22a3c1a";

  /* ---------- Map ---------- */
  const dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const map = L.map("map", { scrollWheelZoom: false }).setView([35.85, -78.85], 10);
  L.tileLayer(`https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_API_KEY}`, {
    maxZoom: 19,
    subdomains: "abcd",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  }).addTo(map);

  const css = getComputedStyle(document.documentElement);
  const color = (v) => css.getPropertyValue(v.category === "Library" ? "--t-club" : "--t-author").trim();

  function popup(v) {
    const where = v.address || [v.town, v.county && `${v.county} County`].filter(Boolean).join(", ");
    const events = v.count
      ? `<a href="index.html#host=${encodeURIComponent(v.name)}">${v.count} upcoming event${v.count === 1 ? "" : "s"}</a>`
      : `<span class="note">No events listed yet</span>`;
    return `<div class="popup">
      <strong>${esc(v.name)}</strong>
      <div>${esc(v.kind)}</div>
      ${where ? `<div>${esc(where)}</div>` : ""}
      <div class="popup-links">${events}${v.website ? ` · <a href="${esc(v.website)}" target="_blank" rel="noopener">Website</a>` : ""}</div>
    </div>`;
  }

  for (const v of VENUES) {
    v.marker = L.circleMarker([v.lat, v.lon], {
      radius: v.count ? 9 : 7,
      color: "#fff",
      weight: 2,
      fillColor: color(v),
      fillOpacity: v.count ? 0.95 : 0.6,
    }).bindPopup(popup(v)).bindTooltip(v.name);
  }

  /* ---------- Filters and list ---------- */
  const counties = [...new Set(VENUES.map((v) => v.county).filter(Boolean))].sort();
  $("county").insertAdjacentHTML("beforeend", counties.map((c) => `<option>${esc(c)}</option>`).join(""));

  function render() {
    const words = $("q").value.toLowerCase().split(/\s+/).filter(Boolean);
    const county = $("county").value, space = $("space").value;
    const shown = VENUES.filter((v) =>
      (!county || v.county === county) && (!space || v.category === space) && words.every((w) => v._text.includes(w)));
    for (const v of VENUES) {
      if (shown.includes(v)) v.marker.addTo(map);
      else v.marker.remove();
    }
    $("count").textContent = `${shown.length} place${shown.length === 1 ? "" : "s"}`;
    $("place-list").innerHTML = shown.length
      ? shown.map((v) => `<li><button type="button" class="place-item" data-name="${esc(v.name)}">
          <span class="swatch ${v.category === "Library" ? "lib" : "shop"}"></span>
          <span><strong>${esc(v.name)}</strong><small>${esc(v.town || v.county + " County")}${v.count ? ` · ${v.count} upcoming` : ""}</small></span>
        </button></li>`).join("")
      : `<li class="empty">No places match.</li>`;
    if (shown.length) map.fitBounds(L.latLngBounds(shown.map((v) => [v.lat, v.lon])), { padding: [30, 30], maxZoom: 14 });
  }

  $("place-list").addEventListener("click", (ev) => {
    const b = ev.target.closest(".place-item");
    if (!b) return;
    const v = VENUES.find((x) => x.name === b.dataset.name);
    map.setView([v.lat, v.lon], 14);
    v.marker.openPopup();
    $("map").scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  let timer;
  $("q").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(render, 150); });
  $("county").addEventListener("change", render);
  $("space").addEventListener("change", render);

  render();
})();
