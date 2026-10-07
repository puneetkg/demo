(() => {
  "use strict";

  const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const DAY_LABELS = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
  const FAV_KEY = "localeats:favorites";

  const restaurants = window.RESTAURANTS || [];
  const config = window.SITE_CONFIG || {};

  const $ = (sel) => document.querySelector(sel);
  const els = {
    q: $("#q"),
    cuisine: $("#cuisine"),
    neighborhood: $("#neighborhood"),
    price: $("#price"),
    rating: $("#rating"),
    ratingOut: $("#rating-out"),
    openNow: $("#open-now"),
    favsOnly: $("#favs-only"),
    sort: $("#sort"),
    list: $("#list"),
    count: $("#count"),
    empty: $("#empty"),
    detail: $("#detail"),
    detailBody: $("#detail-body"),
  };

  // ---- Favorites (per-browser convenience; safe if storage is unavailable) ----
  let favorites = new Set();
  try {
    favorites = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]"));
  } catch (_) { /* storage unavailable */ }

  function saveFavorites() {
    try { localStorage.setItem(FAV_KEY, JSON.stringify([...favorites])); } catch (_) { /* ignore */ }
  }

  // ---- Helpers ----
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const priceLabel = (n) => "$".repeat(n);
  const toMinutes = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };

  function formatTime(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    const suffix = h >= 12 && h < 24 ? "pm" : "am";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return m ? `${h12}:${String(m).padStart(2, "0")}${suffix}` : `${h12}${suffix}`;
  }

  function isOpenAt(r, date = new Date()) {
    const now = date.getHours() * 60 + date.getMinutes();
    const today = DAYS[date.getDay()];
    const yesterday = DAYS[(date.getDay() + 6) % 7];

    const t = r.hours && r.hours[today];
    if (t) {
      const open = toMinutes(t[0]);
      const close = toMinutes(t[1]);
      if (close > open ? now >= open && now < close : now >= open) return true;
    }
    // Still open from yesterday's past-midnight shift?
    const y = r.hours && r.hours[yesterday];
    if (y) {
      const open = toMinutes(y[0]);
      const close = toMinutes(y[1]);
      if (close <= open && now < close) return true;
    }
    return false;
  }

  function stars(rating) {
    const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
    return `<span class="stars" style="--pct:${pct}%" aria-label="${rating} out of 5 stars"></span>`;
  }

  function hueFor(str) {
    let h = 0;
    for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return h;
  }

  // ---- Search scoring ----
  function matchScore(r, terms) {
    if (!terms.length) return 1;
    const fields = [
      [r.name, 5],
      [r.cuisine, 4],
      [r.tags.join(" "), 3],
      [r.neighborhood, 2],
      [r.description, 1],
    ];
    let score = 0;
    for (const term of terms) {
      let best = 0;
      for (const [text, weight] of fields) {
        if (text.toLowerCase().includes(term)) best = Math.max(best, weight);
      }
      if (!best) return 0; // every term must match somewhere
      score += best;
    }
    return score;
  }

  // ---- Filtering & sorting ----
  function getState() {
    return {
      q: els.q.value.trim().toLowerCase(),
      cuisine: els.cuisine.value,
      neighborhood: els.neighborhood.value,
      prices: [...els.price.querySelectorAll("input:checked")].map((i) => Number(i.value)),
      minRating: Number(els.rating.value),
      openNow: els.openNow.checked,
      favsOnly: els.favsOnly.checked,
      sort: els.sort.value,
    };
  }

  function apply(state) {
    const terms = state.q.split(/\s+/).filter(Boolean);
    const now = new Date();

    const results = restaurants
      .map((r) => ({ r, score: matchScore(r, terms) }))
      .filter(({ r, score }) =>
        score > 0 &&
        (!state.cuisine || r.cuisine === state.cuisine) &&
        (!state.neighborhood || r.neighborhood === state.neighborhood) &&
        (!state.prices.length || state.prices.includes(r.price)) &&
        r.rating >= state.minRating &&
        (!state.openNow || isOpenAt(r, now)) &&
        (!state.favsOnly || favorites.has(r.id))
      );

    // "Best" blends rating with review volume so a 5.0 with 3 reviews doesn't top the list.
    const bayes = (r) => (r.rating * r.reviews + 4.0 * 200) / (r.reviews + 200);
    const sorters = {
      best: (a, b) => b.score - a.score || bayes(b.r) - bayes(a.r),
      rating: (a, b) => b.r.rating - a.r.rating || b.r.reviews - a.r.reviews,
      reviews: (a, b) => b.r.reviews - a.r.reviews,
      "price-asc": (a, b) => a.r.price - b.r.price || b.r.rating - a.r.rating,
      "price-desc": (a, b) => b.r.price - a.r.price || b.r.rating - a.r.rating,
      name: (a, b) => a.r.name.localeCompare(b.r.name),
    };
    results.sort(sorters[state.sort] || sorters.best);
    return results.map((x) => x.r);
  }

  // ---- Rendering ----
  function card(r) {
    const open = isOpenAt(r);
    const fav = favorites.has(r.id);
    const initials = r.name.replace(/^The\s+/i, "").split(/\s+/).slice(0, 2).map((w) => w[0]).join("");
    return `
      <li class="card">
        <button type="button" class="fav ${fav ? "on" : ""}" data-fav="${r.id}"
          aria-pressed="${fav}" aria-label="${fav ? "Remove from" : "Add to"} favorites">&#9829;</button>
        <button type="button" class="card-main" data-open="${r.id}">
          <div class="thumb" style="--h:${hueFor(r.cuisine)}"><span>${escapeHtml(initials)}</span></div>
          <div class="card-body">
            <h3>${escapeHtml(r.name)}</h3>
            <p class="meta">${escapeHtml(r.cuisine)} · <span class="price">${priceLabel(r.price)}</span> · ${escapeHtml(r.neighborhood)}</p>
            <p class="rating">${stars(r.rating)} <strong>${r.rating.toFixed(1)}</strong> <span class="muted">(${r.reviews.toLocaleString()})</span></p>
            <p class="status ${open ? "open" : "closed"}">${open ? "Open now" : "Closed"}</p>
            <ul class="tags">${r.tags.slice(0, 3).map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
          </div>
        </button>
      </li>`;
  }

  function render() {
    const state = getState();
    const results = apply(state);

    els.ratingOut.textContent = state.minRating ? `${state.minRating}+` : "Any";
    els.count.textContent = `${results.length} ${results.length === 1 ? "restaurant" : "restaurants"}`;
    els.list.innerHTML = results.map(card).join("");
    els.empty.hidden = results.length > 0;

    syncUrl(state);
  }

  function showDetail(id) {
    const r = restaurants.find((x) => x.id === id);
    if (!r) return;
    const open = isOpenAt(r);
    const todayKey = DAYS[new Date().getDay()];
    const order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    const hoursRows = order.map((d) => {
      const h = r.hours && r.hours[d];
      return `<tr class="${d === todayKey ? "today" : ""}"><th>${DAY_LABELS[d]}</th><td>${h ? `${formatTime(h[0])} – ${formatTime(h[1])}` : "Closed"}</td></tr>`;
    }).join("");
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.name} ${r.address}`)}`;

    els.detailBody.innerHTML = `
      <div class="detail-hero" style="--h:${hueFor(r.cuisine)}">
        <h2 id="detail-title">${escapeHtml(r.name)}</h2>
        <p>${escapeHtml(r.cuisine)} · ${priceLabel(r.price)} · ${escapeHtml(r.neighborhood)}</p>
      </div>
      <div class="detail-content">
        <p class="rating">${stars(r.rating)} <strong>${r.rating.toFixed(1)}</strong> <span class="muted">${r.reviews.toLocaleString()} reviews</span>
          <span class="status ${open ? "open" : "closed"}">${open ? "Open now" : "Closed"}</span></p>
        <p>${escapeHtml(r.description)}</p>
        <ul class="tags">${r.tags.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
        <div class="detail-grid">
          <div>
            <h3>Contact</h3>
            <p>${escapeHtml(r.address)}<br><a href="tel:${escapeHtml(r.phone.replace(/[^\d+]/g, ""))}">${escapeHtml(r.phone)}</a></p>
            <p class="actions">
              <a class="btn" href="${mapsUrl}" target="_blank" rel="noopener">Directions</a>
              ${r.website ? `<a class="btn ghost" href="${escapeHtml(r.website)}" target="_blank" rel="noopener">Website</a>` : ""}
            </p>
          </div>
          <div>
            <h3>Hours</h3>
            <table class="hours">${hoursRows}</table>
          </div>
        </div>
      </div>`;
    if (!els.detail.open) els.detail.showModal();
  }

  // ---- URL state (shareable filtered views) ----
  function syncUrl(state) {
    const p = new URLSearchParams();
    if (state.q) p.set("q", els.q.value.trim());
    if (state.cuisine) p.set("cuisine", state.cuisine);
    if (state.neighborhood) p.set("area", state.neighborhood);
    if (state.prices.length) p.set("price", state.prices.join(","));
    if (state.minRating) p.set("rating", state.minRating);
    if (state.openNow) p.set("open", "1");
    if (state.sort !== "best") p.set("sort", state.sort);
    const qs = p.toString();
    try { history.replaceState(null, "", qs ? `?${qs}` : location.pathname); } catch (_) { /* sandboxed frame */ }
  }

  function loadUrl() {
    const p = new URLSearchParams(location.search);
    els.q.value = p.get("q") || "";
    els.cuisine.value = p.get("cuisine") || "";
    els.neighborhood.value = p.get("area") || "";
    const prices = (p.get("price") || "").split(",");
    els.price.querySelectorAll("input").forEach((i) => { i.checked = prices.includes(i.value); });
    els.rating.value = p.get("rating") || "0";
    els.openNow.checked = p.get("open") === "1";
    if (p.get("sort")) els.sort.value = p.get("sort");
  }

  function reset() {
    els.q.value = "";
    els.cuisine.value = "";
    els.neighborhood.value = "";
    els.price.querySelectorAll("input").forEach((i) => { i.checked = false; });
    els.rating.value = "0";
    els.openNow.checked = false;
    els.favsOnly.checked = false;
    els.sort.value = "best";
    render();
  }

  // ---- Init ----
  function fillSelect(select, values) {
    for (const v of [...new Set(values)].sort()) {
      const o = document.createElement("option");
      o.value = o.textContent = v;
      select.appendChild(o);
    }
  }

  if (config.areaName) {
    $("#area-name").textContent = config.areaName;
    document.title = `Local Eats – Best restaurants in ${config.areaName}`;
  }
  fillSelect(els.cuisine, restaurants.map((r) => r.cuisine));
  fillSelect(els.neighborhood, restaurants.map((r) => r.neighborhood));
  loadUrl();

  let debounce;
  els.q.addEventListener("input", () => { clearTimeout(debounce); debounce = setTimeout(render, 120); });
  [els.cuisine, els.neighborhood, els.rating, els.openNow, els.favsOnly, els.sort].forEach((el) => el.addEventListener("input", render));
  els.price.addEventListener("change", render);
  $("#reset").addEventListener("click", reset);
  $("#empty-reset").addEventListener("click", reset);

  els.list.addEventListener("click", (e) => {
    const favBtn = e.target.closest("[data-fav]");
    if (favBtn) {
      const id = favBtn.dataset.fav;
      favorites.has(id) ? favorites.delete(id) : favorites.add(id);
      saveFavorites();
      render();
      return;
    }
    const openBtn = e.target.closest("[data-open]");
    if (openBtn) showDetail(openBtn.dataset.open);
  });

  els.detail.addEventListener("click", (e) => {
    // Close on the X button or a click on the backdrop.
    if (e.target.closest("[data-close]") || e.target === els.detail) els.detail.close();
  });

  render();
  // Keep "Open now" badges accurate if the page stays open.
  setInterval(render, 60 * 1000);
})();
