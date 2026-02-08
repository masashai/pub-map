const state = {
  shops: [],
  markers: new Map(),
  activeId: null,
};

const map = L.map("map", {
  zoomControl: true,
  scrollWheelZoom: true,
});

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

const listEl = document.getElementById("list");
const searchEl = document.getElementById("search");
const categoryEl = document.getElementById("category");

function normalize(text) {
  return text.toLowerCase();
}

function matches(shop, query, category) {
  const haystack = normalize(`${shop.name} ${shop.category} ${shop.note ?? ""}`);
  const okQuery = !query || haystack.includes(query);
  const okCategory = !category || shop.category === category;
  return okQuery && okCategory;
}

function buildPopup(shop) {
  const link = shop.url
    ? `<a href="${shop.url}" target="_blank" rel="noopener">詳細</a>`
    : "";
  return `
    <strong>${shop.name}</strong><br />
    <span>${shop.category}</span><br />
    <span>${shop.note ?? ""}</span><br />
    ${link}
  `;
}

function setActive(id) {
  state.activeId = id;
  document.querySelectorAll(".card").forEach((card) => {
    card.classList.toggle("active", card.dataset.id === id);
  });
}

function renderList(items) {
  if (items.length === 0) {
    listEl.innerHTML = "<p class=\"empty\">該当するスポットがありません。</p>";
    return;
  }

  listEl.innerHTML = items
    .map(
      (shop) => `
        <article class="card" data-id="${shop.id}">
          <h2>${shop.name}</h2>
          <div class="meta">${shop.category} ・ ${shop.area}</div>
          <p class="note">${shop.note ?? ""}</p>
        </article>
      `
    )
    .join("");

  listEl.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.dataset.id;
      const marker = state.markers.get(id);
      if (!marker) return;
      setActive(id);
      marker.openPopup();
      map.setView(marker.getLatLng(), Math.max(map.getZoom(), 14));
    });
  });
}

function updateMarkers(items) {
  const visible = new Set(items.map((shop) => shop.id));
  state.markers.forEach((marker, id) => {
    const isVisible = visible.has(id);
    if (isVisible && !map.hasLayer(marker)) {
      marker.addTo(map);
    }
    if (!isVisible && map.hasLayer(marker)) {
      marker.remove();
    }
  });
}

function applyFilter() {
  const query = normalize(searchEl.value.trim());
  const category = categoryEl.value;
  const filtered = state.shops.filter((shop) => matches(shop, query, category));
  renderList(filtered);
  updateMarkers(filtered);
}

function setupFilters(shops) {
  const categories = Array.from(new Set(shops.map((shop) => shop.category)));
  categories.sort();
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryEl.appendChild(option);
  });

  searchEl.addEventListener("input", applyFilter);
  categoryEl.addEventListener("change", applyFilter);
}

function initMap(shops) {
  const bounds = L.latLngBounds(shops.map((shop) => [shop.lat, shop.lng]));
  map.fitBounds(bounds.pad(0.2));

  shops.forEach((shop) => {
    const marker = L.marker([shop.lat, shop.lng]).bindPopup(buildPopup(shop));
    marker.on("click", () => setActive(shop.id));
    marker.addTo(map);
    state.markers.set(shop.id, marker);
  });
}

fetch("data/shops.json")
  .then((res) => res.json())
  .then((shops) => {
    state.shops = shops;
    setupFilters(shops);
    initMap(shops);
    renderList(shops);
  })
  .catch(() => {
    listEl.innerHTML = "<p class=\"empty\">データの読み込みに失敗しました。</p>";
  });
