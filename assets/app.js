const state = {
  shops: [],
  markers: new Map(),
  markerBaseIcons: new Map(),
  activeId: null,
  venue: null,
};
const VENUE_ITEM_ID = "__venue__";
const SHADOW_URL = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png";

function createMarkerIcon(color) {
  return L.icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
    shadowUrl: SHADOW_URL,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
}

const BLUE_ICON = createMarkerIcon("blue");
const RED_ICON = createMarkerIcon("red");
const YELLOW_ICON = createMarkerIcon("yellow");

const map = L.map("map", {
  zoomControl: true,
  scrollWheelZoom: true,
});

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

const listEl = document.getElementById("list");
const mapEl = document.getElementById("map");
const locateBtn = document.getElementById("locate");
const listOpenBtn = document.getElementById("list-open");
const listCloseBtn = document.getElementById("list-close");
const listModal = document.getElementById("list-modal");
const modalBackdrop = listModal?.querySelector(".modal-backdrop");

let userMarker = null;
let userCircle = null;

function buildPopup(shop) {
  const link = `<a href="https://www.google.com/search?q=${encodeURIComponent(
    shop.name
  )}" target="_blank" rel="noopener" class="icon-btn" aria-label="Googleで調べる">
    <span class="icon">🔎</span>
  </a>`;
  const mapLink = `<a href="https://www.google.com/maps/search/?api=1&query=${shop.lat},${shop.lng}" target="_blank" rel="noopener" class="icon-btn" aria-label="Google mapを開く">
    <span class="icon">🗺️</span>
  </a>`;
  const phoneLink = shop.phone
    ? `<a href="tel:${shop.phone}" class="icon-btn" aria-label="電話をかける">
        <span class="icon">📞</span>
      </a>`
    : "";
  const actions = `<div class="actions">${phoneLink}${mapLink}${link}</div>`;
  return `
    <strong>${shop.name}</strong><br />
    <div class="popup-line">${shop.address ?? ""}</div>
    <div class="popup-note">${shop.note ?? ""}</div>
    ${actions}
  `;
}

function setActive(id) {
  if (state.activeId) {
    const previousMarker = state.markers.get(state.activeId);
    const previousBaseIcon = state.markerBaseIcons.get(state.activeId);
    if (previousMarker && previousBaseIcon) {
      previousMarker.setIcon(previousBaseIcon);
    }
  }

  state.activeId = id;
  document.querySelectorAll(".card").forEach((card) => {
    card.classList.toggle("active", card.dataset.id === id);
  });

  const currentMarker = state.markers.get(id);
  if (currentMarker) {
    currentMarker.setIcon(YELLOW_ICON);
  }
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
          <div class="meta">${shop.address ?? ""}</div>
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
      if (listModal?.classList.contains("is-open")) {
        closeListModal();
      }
      if (window.matchMedia("(max-width: 900px)").matches) {
        mapEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

function initMap(shops) {
  const points = shops.map((shop) => [shop.lat, shop.lng]);
  if (state.venue) {
    points.push([state.venue.lat, state.venue.lng]);
  }
  const bounds = L.latLngBounds(points);
  map.fitBounds(bounds.pad(0.2));

  shops.forEach((shop) => {
    const marker = L.marker([shop.lat, shop.lng], { icon: BLUE_ICON }).bindPopup(
      buildPopup(shop)
    );
    marker.on("click", () => setActive(shop.id));
    marker.addTo(map);
    state.markers.set(shop.id, marker);
    state.markerBaseIcons.set(shop.id, BLUE_ICON);
  });
}

function buildListItems(shops, venue) {
  if (!venue) return shops;
  return [{ ...venue, id: VENUE_ITEM_ID }, ...shops];
}

function addVenueMarker(venue) {
  if (!venue) return;
  const marker = L.marker([venue.lat, venue.lng], { icon: RED_ICON }).bindPopup(
    buildPopup(venue)
  );
  marker.on("click", () => setActive(VENUE_ITEM_ID));
  marker.addTo(map);
  state.markers.set(VENUE_ITEM_ID, marker);
  state.markerBaseIcons.set(VENUE_ITEM_ID, RED_ICON);
}

Promise.all([fetch("data/shops.json"), fetch("data/venue.json")])
  .then(async ([shopsRes, venueRes]) => {
    const shops = await shopsRes.json();
    const venue = await venueRes.json();
    state.shops = shops;
    state.venue = venue;
    initMap(shops);
    addVenueMarker(venue);
    renderList(buildListItems(shops, venue));
  })
  .catch(() => {
    listEl.innerHTML = "<p class=\"empty\">データの読み込みに失敗しました。</p>";
  });

if (locateBtn) {
  locateBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      alert("このブラウザでは現在地を取得できません。");
      return;
    }
    locateBtn.disabled = true;
    locateBtn.textContent = "現在地取得中...";
    map.locate({ setView: false, maxZoom: 15, enableHighAccuracy: true });
  });

  map.on("locationfound", (e) => {
    if (userMarker) {
      userMarker.remove();
    }
    if (userCircle) {
      userCircle.remove();
    }
    const userIcon = L.divIcon({
      className: "user-location",
      iconSize: [14, 14],
    });
    userMarker = L.marker(e.latlng, { icon: userIcon })
      .addTo(map)
      .bindPopup("現在地");
    userCircle = L.circle(e.latlng, {
      radius: e.accuracy,
      color: "#2f7ea8",
      fillColor: "#2f7ea8",
      fillOpacity: 0.15,
      weight: 1,
    }).addTo(map);
    const points = state.shops.map((shop) => [shop.lat, shop.lng]);
    if (state.venue) {
      points.push([state.venue.lat, state.venue.lng]);
    }
    points.push([e.latlng.lat, e.latlng.lng]);
    map.fitBounds(L.latLngBounds(points).pad(0.2));
    locateBtn.disabled = false;
    locateBtn.textContent = "現在地を更新";
  });

  map.on("locationerror", () => {
    locateBtn.disabled = false;
    locateBtn.textContent = "現在地を更新";
    alert("現在地の取得に失敗しました。");
  });
}

if (navigator.geolocation) {
  map.locate({ setView: false, maxZoom: 15, enableHighAccuracy: true });
}

function openListModal() {
  if (!listModal) return;
  listModal.classList.add("is-open");
  listModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeListModal() {
  if (!listModal) return;
  listModal.classList.remove("is-open");
  listModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

if (listOpenBtn) {
  listOpenBtn.addEventListener("click", openListModal);
}

if (listCloseBtn) {
  listCloseBtn.addEventListener("click", closeListModal);
}

if (modalBackdrop) {
  modalBackdrop.addEventListener("click", closeListModal);
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeListModal();
  }
});
