const DATA_URL = "./data/schools.json";

const state = {
  allPrograms: [],
  filteredPrograms: [],
  selectedId: null,
  map: null,
  markersLayer: null,
  markers: new Map(),
};

const els = {
  heroStats: document.getElementById("hero-stats"),
  searchInput: document.getElementById("search-input"),
  stateFilter: document.getElementById("state-filter"),
  programFilter: document.getElementById("program-filter"),
  yearFilter: document.getElementById("year-filter"),
  yearValue: document.getElementById("year-value"),
  resetButton: document.getElementById("reset-button"),
  visibleCount: document.getElementById("visible-count"),
  visibleStates: document.getElementById("visible-states"),
  listSummary: document.getElementById("list-summary"),
  resultsList: document.getElementById("results-list"),
  detailCard: document.getElementById("detail-card"),
};

init();

async function init() {
  setupMap();
  bindEvents();

  const response = await fetch(DATA_URL);
  const rawData = await response.json();

  state.allPrograms = rawData
    .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
    .map((item, index) => ({
      id: index + 1,
      school: item.schools || "Unknown school",
      program: item.programs || "Unknown program",
      city: item.city || "",
      state: item.state || "",
      zipcode: item.zipcode || "",
      latitude: Number(item.latitude),
      longitude: Number(item.longitude),
      yearEstablished: Number(item.year_established) || null,
      details: item.details || "",
      link: item.links || "",
    }));

  populateFilters(state.allPrograms);
  renderHeroStats(state.allPrograms);
  applyFilters();
}

function setupMap() {
  state.map = L.map("map", {
    scrollWheelZoom: true,
    minZoom: 3,
  }).setView([39.5, -98.35], 4);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(state.map);

  state.markersLayer = L.layerGroup().addTo(state.map);
}

function bindEvents() {
  els.searchInput.addEventListener("input", applyFilters);
  els.stateFilter.addEventListener("change", applyFilters);
  els.programFilter.addEventListener("change", applyFilters);
  els.yearFilter.addEventListener("input", () => {
    els.yearValue.textContent = `${els.yearFilter.value}+`;
    applyFilters();
  });

  els.resetButton.addEventListener("click", () => {
    els.searchInput.value = "";
    els.stateFilter.value = "";
    els.programFilter.value = "";
    els.yearFilter.value = "1990";
    els.yearValue.textContent = "1990+";
    state.selectedId = null;
    applyFilters();
  });
}

function populateFilters(programs) {
  const states = [...new Set(programs.map((item) => item.state).filter(Boolean))].sort();
  const programTypes = [
    ...new Set(
      programs
        .map((item) => item.program)
        .filter(Boolean)
        .map((label) => inferProgramType(label))
    ),
  ].sort();

  for (const value of states) {
    els.stateFilter.append(new Option(value, value));
  }

  for (const value of programTypes) {
    els.programFilter.append(new Option(value, value));
  }
}

function inferProgramType(label) {
  const text = label.toLowerCase();
  if (text.includes("business analytics")) return "Business Analytics";
  if (text.includes("data science")) return "Data Science";
  if (text.includes("analytics")) return "Analytics";
  if (text.includes("artificial intelligence")) return "Artificial Intelligence";
  return "Other";
}

function renderHeroStats(programs) {
  const stats = [
    { label: "Programs", value: programs.length.toLocaleString() },
    { label: "States", value: new Set(programs.map((item) => item.state)).size },
    {
      label: "Earliest launch",
      value: Math.min(...programs.map((item) => item.yearEstablished || Infinity)),
    },
    {
      label: "Latest launch",
      value: Math.max(...programs.map((item) => item.yearEstablished || 0)),
    },
  ];

  els.heroStats.innerHTML = stats
    .map(
      (item) => `
        <article class="stat-card">
          <span>${item.label}</span>
          <strong>${item.value}</strong>
        </article>
      `
    )
    .join("");
}

function applyFilters() {
  const query = els.searchInput.value.trim().toLowerCase();
  const selectedState = els.stateFilter.value;
  const selectedProgramType = els.programFilter.value;
  const minYear = Number(els.yearFilter.value);

  state.filteredPrograms = state.allPrograms.filter((item) => {
    const haystack = `${item.school} ${item.program} ${item.city} ${item.state}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    const matchesState = !selectedState || item.state === selectedState;
    const matchesProgramType =
      !selectedProgramType || inferProgramType(item.program) === selectedProgramType;
    const matchesYear = !item.yearEstablished || item.yearEstablished >= minYear;
    return matchesQuery && matchesState && matchesProgramType && matchesYear;
  });

  if (!state.filteredPrograms.some((item) => item.id === state.selectedId)) {
    state.selectedId = state.filteredPrograms[0]?.id || null;
  }

  renderResults();
  renderMapMarkers();
  renderDetail();
}

function renderResults() {
  const visibleStates = new Set(state.filteredPrograms.map((item) => item.state).filter(Boolean)).size;
  els.visibleCount.textContent = state.filteredPrograms.length.toLocaleString();
  els.visibleStates.textContent = visibleStates.toString();
  els.listSummary.textContent = `${state.filteredPrograms.length} programs match the current filters`;

  if (state.filteredPrograms.length === 0) {
    els.resultsList.innerHTML = `<div class="result-item">No programs match the current filters.</div>`;
    return;
  }

  els.resultsList.innerHTML = state.filteredPrograms
    .map(
      (item) => `
        <article class="result-item ${item.id === state.selectedId ? "active" : ""}" data-id="${item.id}">
          <h3>${escapeHtml(item.school)}</h3>
          <div>${escapeHtml(item.program)}</div>
          <div class="chip-row">
            <span class="chip">${escapeHtml(item.state || "N/A")}</span>
            <span class="chip">${escapeHtml(item.city || "Unknown city")}</span>
            <span class="chip">${item.yearEstablished || "Year N/A"}</span>
          </div>
        </article>
      `
    )
    .join("");

  for (const node of els.resultsList.querySelectorAll(".result-item[data-id]")) {
    node.addEventListener("click", () =>
      selectProgram(Number(node.dataset.id), { panToMarker: true, openLink: true })
    );
  }
}

function renderMapMarkers() {
  state.markers.clear();
  state.markersLayer.clearLayers();

  const bounds = [];
  for (const item of state.filteredPrograms) {
    const marker = L.circleMarker([item.latitude, item.longitude], {
      radius: item.id === state.selectedId ? 9 : 6,
      weight: item.id === state.selectedId ? 3 : 1.5,
      color: item.id === state.selectedId ? "#2318d8" : "#2f43f2",
      fillColor: item.id === state.selectedId ? "#2318d8" : "#2f43f2",
      fillOpacity: 0.9,
    });

    marker.bindPopup(`
      <div class="popup-content">
        <strong>${escapeHtml(item.school)}</strong>
        <div>${escapeHtml(item.program)}</div>
        <div>${escapeHtml(item.city)}, ${escapeHtml(item.state)}</div>
      </div>
    `);

    marker.on("click", () => selectProgram(item.id, { panToMarker: false, openLink: false }));
    marker.addTo(state.markersLayer);
    state.markers.set(item.id, marker);
    bounds.push([item.latitude, item.longitude]);
  }

  if (bounds.length === 1) {
    state.map.setView(bounds[0], 8);
  } else if (bounds.length > 1) {
    state.map.fitBounds(bounds, { padding: [30, 30] });
  } else {
    state.map.setView([39.5, -98.35], 4);
  }
}

function renderDetail() {
  const selected = state.filteredPrograms.find((item) => item.id === state.selectedId);
  if (!selected) {
    els.detailCard.className = "detail-card empty";
    els.detailCard.textContent = "Select a program from the map or list.";
    return;
  }

  els.detailCard.className = "detail-card";
  els.detailCard.innerHTML = `
    <h3>${escapeHtml(selected.school)}</h3>
    <p>${escapeHtml(selected.program)}</p>
    <div class="chip-row">
      <span class="chip">${escapeHtml(selected.city)}</span>
      <span class="chip">${escapeHtml(selected.state)}</span>
      <span class="chip">${selected.yearEstablished || "Year N/A"}</span>
    </div>
    <div class="detail-meta">
      <div>
        <span>Location</span>
        <strong>${escapeHtml(selected.city)}, ${escapeHtml(selected.state)} ${selected.zipcode || ""}</strong>
      </div>
      <div>
        <span>Program page</span>
        ${
          selected.link
            ? `<a href="${selected.link}" target="_blank" rel="noreferrer">Open official page</a>`
            : "<strong>No link provided</strong>"
        }
      </div>
      <div>
        <span>Details</span>
        <strong>${escapeHtml(selected.details || "No additional notes in the dataset.")}</strong>
      </div>
    </div>
  `;
}

function selectProgram(id, options = {}) {
  const { panToMarker = false, openLink = false } = options;
  state.selectedId = id;
  renderResults();
  renderMapMarkers();
  renderDetail();

  const selected = state.filteredPrograms.find((item) => item.id === id);
  const marker = state.markers.get(id);
  if (marker) {
    marker.openPopup();
    if (panToMarker) {
      state.map.flyTo(marker.getLatLng(), 8, { duration: 0.8 });
    }
  }

  if (openLink && selected?.link) {
    window.open(selected.link, "_blank", "noopener,noreferrer");
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
