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
const venueEl = document.getElementById("venue");
const mapEl = document.getElementById("map");

function buildPopup(shop) {
  const link = `<a href="https://www.google.com/search?q=${encodeURIComponent(
    shop.name
  )}" target="_blank" rel="noopener">検索する</a>`;
  const phone = shop.phone
    ? `<a href="tel:${shop.phone}" class="tel">${shop.phone}</a><br />`
    : "";
  return `
    <strong>${shop.name}</strong><br />
    <span>${shop.category}</span><br />
    <span>${shop.address ?? ""}</span><br />
    ${phone}
    <span>${shop.note ?? ""}</span><br />
    ${link}
  `;
}

function buildVenuePopup(venue) {
  const link = `<a href="https://www.google.com/search?q=${encodeURIComponent(
    venue.name
  )}" target="_blank" rel="noopener">検索する</a>`;
  const phone = venue.phone
    ? `<a href="tel:${venue.phone}" class="tel">${venue.phone}</a><br />`
    : "";
  return `
    <strong>${venue.name}</strong><br />
    <span>式場</span><br />
    <span>${venue.address ?? ""}</span><br />
    ${phone}
    <span>${venue.note ?? ""}</span><br />
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
          <div class="meta">${shop.category} ・ ${shop.address ?? ""}</div>
          <div class="meta">${shop.phone ?? ""}</div>
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
      if (window.matchMedia("(max-width: 900px)").matches) {
        mapEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

function initMap(shops, venue) {
  const points = shops.map((shop) => [shop.lat, shop.lng]);
  if (venue) {
    points.push([venue.lat, venue.lng]);
  }
  const bounds = L.latLngBounds(points);
  map.fitBounds(bounds.pad(0.2));

  shops.forEach((shop) => {
    const marker = L.marker([shop.lat, shop.lng]).bindPopup(buildPopup(shop));
    marker.on("click", () => setActive(shop.id));
    marker.addTo(map);
    state.markers.set(shop.id, marker);
  });
}

function renderVenue(venue) {
  if (!venue) return;
  venueEl.innerHTML = `
    <h2>式場：${venue.name}</h2>
    <div class="meta">${venue.address ?? ""}</div>
    <div class="meta">${venue.phone ?? ""}</div>
    <p class="note">${venue.note ?? ""}</p>
  `;
}

function addVenueMarker(venue) {
  if (!venue) return;
  const venueIcon = L.icon({
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png",
    shadowUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
  const marker = L.marker([venue.lat, venue.lng], { icon: venueIcon }).bindPopup(
    buildVenuePopup(venue)
  );
  marker.addTo(map);
}

Promise.all([fetch("data/shops.json"), fetch("data/venue.json")])
  .then(async ([shopsRes, venueRes]) => {
    const shops = await shopsRes.json();
    const venue = await venueRes.json();
    state.shops = shops;
    initMap(shops, venue);
    addVenueMarker(venue);
    renderVenue(venue);
    renderList(shops);
  })
  .catch(() => {
    listEl.innerHTML = "<p class=\"empty\">データの読み込みに失敗しました。</p>";
  });
