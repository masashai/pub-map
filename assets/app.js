const state = {
  shops: [],
  venue: null,
  markers: new Map(),
  markerBaseColors: new Map(),
  activeId: null,
};

const VENUE_ITEM_ID = "__venue__";
const PIN_URL_BASE = "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img";
const PIN_COLORS = {
  blue: `${PIN_URL_BASE}/marker-icon-blue.png`,
  red: `${PIN_URL_BASE}/marker-icon-red.png`,
  yellow: `${PIN_URL_BASE}/marker-icon-yellow.png`,
};
const COORD_OFFSET_EAST_M = 0;
const COORD_OFFSET_NORTH_M = 0;
// Leaflet iconAnchor(12,41) to MapLibre bottom-center(12.5,41) adjustment.
const PIN_OFFSET = [-0.5, 0];

const map = new maplibregl.Map({
  container: "map",
  style: {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "&copy; OpenStreetMap contributors",
      },
    },
    layers: [
      {
        id: "osm",
        type: "raster",
        source: "osm",
      },
    ],
  },
  center: [139.702, 35.66],
  zoom: 13,
  dragRotate: true,
  touchZoomRotate: true,
  pitchWithRotate: false,
});
map.touchZoomRotate.enableRotation();
map.addControl(new maplibregl.NavigationControl(), "bottom-left");

const listEl = document.getElementById("list");
const mapEl = document.getElementById("map");
const locateBtn = document.getElementById("locate");
const rotateLeftBtn = document.getElementById("rotate-left");
const rotateRightBtn = document.getElementById("rotate-right");
const listOpenBtn = document.getElementById("list-open");
const listCloseBtn = document.getElementById("list-close");
const listModal = document.getElementById("list-modal");
const modalBackdrop = listModal?.querySelector(".modal-backdrop");

let userMarker = null;
const ROTATE_STEP_DEGREE = 15;

function createPinElement(color) {
  const img = document.createElement("img");
  img.src = PIN_COLORS[color];
  img.alt = "";
  img.width = 25;
  img.height = 41;
  img.className = "marker-pin";
  return img;
}

function offsetLatLng(lat, lng, eastMeter, northMeter) {
  const dLat = northMeter / 111320;
  const dLng = eastMeter / (111320 * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + dLat, lng: lng + dLng };
}

function getAdjustedLatLng(item) {
  return offsetLatLng(item.lat, item.lng, COORD_OFFSET_EAST_M, COORD_OFFSET_NORTH_M);
}

function buildPopup(item) {
  const link = `<a href="https://www.google.com/search?q=${encodeURIComponent(
    item.name
  )}" target="_blank" rel="noopener" class="icon-btn" aria-label="Googleで調べる">
    <span class="icon">🔎</span>
  </a>`;
  const mapLink = `<a href="https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}" target="_blank" rel="noopener" class="icon-btn" aria-label="Google mapを開く">
    <span class="icon">🗺️</span>
  </a>`;
  const phoneLink = item.phone
    ? `<a href="tel:${item.phone}" class="icon-btn" aria-label="電話をかける">
        <span class="icon">📞</span>
      </a>`
    : "";
  const actions = `<div class="actions">${phoneLink}${mapLink}${link}</div>`;
  return `
    <strong>${item.name}</strong><br />
    <div class="popup-line">${item.address ?? ""}</div>
    <div class="popup-note">${item.note ?? ""}</div>
    ${actions}
  `;
}

function setMarkerColor(id, color) {
  const marker = state.markers.get(id);
  if (!marker) return;
  const markerEl = marker.getElement();
  if (markerEl && markerEl.tagName === "IMG") {
    markerEl.src = PIN_COLORS[color];
  }
}

function setActive(id) {
  if (state.activeId) {
    const previousBaseColor = state.markerBaseColors.get(state.activeId);
    if (previousBaseColor) {
      setMarkerColor(state.activeId, previousBaseColor);
    }
  }

  state.activeId = id;
  document.querySelectorAll(".card").forEach((card) => {
    card.classList.toggle("active", card.dataset.id === id);
  });

  setMarkerColor(id, "yellow");
}

function renderList(items) {
  if (items.length === 0) {
    listEl.innerHTML = '<p class="empty">該当するスポットがありません。</p>';
    return;
  }

  listEl.innerHTML = items
    .map(
      (item) => `
        <article class="card" data-id="${item.id}">
          <h2>${item.name}</h2>
          <div class="meta">${item.address ?? ""}</div>
          <div class="meta">${item.phone ?? ""}</div>
          <p class="note">${item.note ?? ""}</p>
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
      marker.togglePopup();
      map.easeTo({ center: marker.getLngLat(), zoom: Math.max(map.getZoom(), 14) });

      if (listModal?.classList.contains("is-open")) {
        closeListModal();
      }
      if (window.matchMedia("(max-width: 900px)").matches) {
        mapEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

function buildListItems(shops, venue) {
  if (!venue) return shops;
  return [{ ...venue, id: VENUE_ITEM_ID }, ...shops];
}

function createSpotMarker(item, id, color) {
  const adjusted = getAdjustedLatLng(item);
  const marker = new maplibregl.Marker({
    element: createPinElement(color),
    anchor: "bottom",
    offset: PIN_OFFSET,
  })
    .setLngLat([adjusted.lng, adjusted.lat])
    .setPopup(new maplibregl.Popup({ offset: 18 }).setHTML(buildPopup(item)))
    .addTo(map);

  marker.getElement().addEventListener("click", () => setActive(id));

  state.markers.set(id, marker);
  state.markerBaseColors.set(id, color);
}

function fitToPoints(extraPoints = []) {
  const points = state.shops.map((shop) => {
    const adjusted = getAdjustedLatLng(shop);
    return [adjusted.lng, adjusted.lat];
  });
  if (state.venue) {
    const adjustedVenue = getAdjustedLatLng(state.venue);
    points.push([adjustedVenue.lng, adjustedVenue.lat]);
  }
  points.push(...extraPoints);

  if (points.length === 0) return;
  if (points.length === 1) {
    map.easeTo({ center: points[0], zoom: 14 });
    return;
  }

  const bounds = points.reduce(
    (acc, point) => acc.extend(point),
    new maplibregl.LngLatBounds(points[0], points[0])
  );
  map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 600 });
}

function renderSpots(shops, venue) {
  shops.forEach((shop) => createSpotMarker(shop, shop.id, "blue"));
  if (venue) {
    createSpotMarker(venue, VENUE_ITEM_ID, "red");
  }
  fitToPoints();
}

function setLocateLoading(isLoading) {
  if (!locateBtn) return;
  locateBtn.disabled = isLoading;
  locateBtn.textContent = isLoading ? "現在地取得中..." : "現在地を更新";
}

function formatGeoError(error) {
  if (!error) return "現在地の取得に失敗しました。";
  if (error.code === error.PERMISSION_DENIED) {
    return "位置情報の利用が拒否されています。ブラウザ設定で許可してください。";
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return "現在地を特定できませんでした。電波状況を確認してください。";
  }
  if (error.code === error.TIMEOUT) {
    return "現在地取得がタイムアウトしました。もう一度お試しください。";
  }
  return "現在地の取得に失敗しました。";
}

function getCurrentPosition(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

async function updateUserLocation() {
  if (!navigator.geolocation) {
    alert("このブラウザでは現在地を取得できません。");
    return;
  }
  if (!window.isSecureContext) {
    alert("現在地取得は HTTPS または localhost でのみ利用できます。");
    return;
  }

  setLocateLoading(true);
  try {
    let position;
    try {
      position = await getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      });
    } catch (error) {
      // Retry with lower accuracy because some environments fail with high accuracy.
      position = await getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 30000,
      });
    }

    const lngLat = [position.coords.longitude, position.coords.latitude];

    if (userMarker) {
      userMarker.remove();
    }

    const userEl = document.createElement("div");
    userEl.className = "user-location";

    userMarker = new maplibregl.Marker({ element: userEl })
      .setLngLat(lngLat)
      .setPopup(new maplibregl.Popup({ offset: 12 }).setText("現在地"))
      .addTo(map);

    fitToPoints([lngLat]);
  } catch (error) {
    console.error("現在地取得エラー:", error);
    alert(formatGeoError(error));
  } finally {
    setLocateLoading(false);
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }
  return response.json();
}

function canRotateMap() {
  return typeof map.setBearing === "function" && typeof map.getBearing === "function";
}

function rotateMapBy(delta) {
  if (!canRotateMap()) return;
  const current = map.getBearing() || 0;
  const next = (current + delta + 360) % 360;
  map.easeTo({ bearing: next, duration: 300 });
}

map.on("load", () => {
  Promise.all([fetchJson("data/shops.json"), fetchJson("data/venue.json")])
    .then(([shops, venue]) => {
      state.shops = shops;
      state.venue = venue;
      renderSpots(shops, venue);
      renderList(buildListItems(shops, venue));
      if (navigator.geolocation) {
        updateUserLocation();
      }
    })
    .catch((error) => {
      console.error("データ読み込みエラー:", error);
      listEl.innerHTML = '<p class="empty">データの読み込みに失敗しました。</p>';
    });
});

if (locateBtn) {
  locateBtn.addEventListener("click", updateUserLocation);
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

if (rotateLeftBtn) {
  if (!canRotateMap()) {
    rotateLeftBtn.disabled = true;
  } else {
    rotateLeftBtn.addEventListener("click", () => rotateMapBy(-ROTATE_STEP_DEGREE));
  }
}

if (rotateRightBtn) {
  if (!canRotateMap()) {
    rotateRightBtn.disabled = true;
  } else {
    rotateRightBtn.addEventListener("click", () => rotateMapBy(ROTATE_STEP_DEGREE));
  }
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
