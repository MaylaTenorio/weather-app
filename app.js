// =====================================================
// Weather App - app.js
// =====================================================

// ---------- DOM element references ----------
const els = {
  status: document.getElementById("status-section"),
  statusMessage: document.getElementById("status-message"),
  currentWeather: document.getElementById("current-weather"),
  currentLocation: document.getElementById("current-location"),
  currentCondition: document.getElementById("current-condition"),
  currentTemp: document.getElementById("current-temp"),
  feelsLike: document.getElementById("feels-like"),
  currentStats: document.getElementById("current-stats"),
  forecastSection: document.getElementById("forecast-section"),
  forecastList: document.getElementById("forecast-list"),
  chartSection: document.getElementById("chart-section"),
  chart: document.getElementById("trend-chart"),
  recentSection: document.getElementById("recent-section"),
  recentList: document.getElementById("recent-list"),
  search: document.getElementById("city-search"),
  suggestions: document.getElementById("search-suggestions"),
  unitToggle: document.getElementById("unit-toggle"),
  themeToggle: document.getElementById("theme-toggle"),
  locateBtn: document.getElementById("locate-btn"),
};

// ---------- App state ----------
const state = {
  data: null,
  locationName: "",
  unit: "C",
  dark: false,
  recent: [],
};

// ---------- Weather code lookup ----------
const WEATHER_CODES = {
  0:  { label: "Clear sky",        icon: "☀️", theme: "clear" },
  1:  { label: "Mainly clear",     icon: "🌤️", theme: "clear" },
  2:  { label: "Partly cloudy",    icon: "⛅", theme: "cloudy" },
  3:  { label: "Overcast",         icon: "☁️", theme: "cloudy" },
  45: { label: "Foggy",            icon: "🌫️", theme: "cloudy" },
  48: { label: "Rime fog",         icon: "🌫️", theme: "cloudy" },
  51: { label: "Light drizzle",    icon: "🌦️", theme: "rain" },
  53: { label: "Drizzle",          icon: "🌦️", theme: "rain" },
  55: { label: "Heavy drizzle",    icon: "🌧️", theme: "rain" },
  61: { label: "Light rain",       icon: "🌦️", theme: "rain" },
  63: { label: "Rain",             icon: "🌧️", theme: "rain" },
  65: { label: "Heavy rain",       icon: "🌧️", theme: "rain" },
  71: { label: "Light snow",       icon: "🌨️", theme: "snow" },
  73: { label: "Snow",             icon: "❄️", theme: "snow" },
  75: { label: "Heavy snow",       icon: "❄️", theme: "snow" },
  80: { label: "Rain showers",     icon: "🌦️", theme: "rain" },
  81: { label: "Heavy showers",    icon: "🌧️", theme: "rain" },
  82: { label: "Violent showers",  icon: "⛈️", theme: "rain" },
  95: { label: "Thunderstorm",     icon: "⛈️", theme: "storm" },
  96: { label: "Thunderstorm",     icon: "⛈️", theme: "storm" },
  99: { label: "Severe storm",     icon: "⛈️", theme: "storm" },
};

function describeWeather(code, isDay = true) {
  const base = WEATHER_CODES[code] || { label: "Unknown", icon: "❓", theme: "clear" };
  if (!isDay) {
    if (code === 0 || code === 1) return { ...base, icon: "🌛", label: code === 0 ? "Clear night" : "Mostly clear night" };
    if (code === 2) return { ...base, icon: "☁️", label: "Partly cloudy night" };
  }
  return base;
}

// ---------- Helpers ----------
function cToF(c) { return (c * 9) / 5 + 32; }

function formatTemp(c) {
  const v = state.unit === "C" ? c : cToF(c);
  return `${Math.round(v)}°${state.unit}`;
}

function formatTempShort(c) {
  const v = state.unit === "C" ? c : cToF(c);
  return `${Math.round(v)}°`;
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDayShort(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString(undefined, { weekday: "short" });
}

function debounce(fn, delay) {
  let id;
  return function (...args) {
    clearTimeout(id);
    id = setTimeout(() => fn.apply(this, args), delay);
  };
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

// ---------- Persistence ----------
const STORAGE_KEY = "weather-app-recent";

function loadRecent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveRecent(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) { console.warn("Could not save:", e); }
}

// ---------- API calls ----------
async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast`
    + `?latitude=${lat}&longitude=${lon}`
    + `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m`
    + `&hourly=temperature_2m`
    + `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset`
    + `&timezone=auto&forecast_days=5`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return res.json();
}

async function searchCities(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search`
    + `?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  const data = await res.json();
  return data.results || [];
}

async function reverseGeocode(lat, lon) {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client`
      + `?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Reverse geocode failed");
    const data = await res.json();
    const city = data.city || data.locality;
    const country = data.countryName;
    if (city && country) return `${city}, ${country}`;
    if (city) return city;
  } catch (e) { console.warn("Reverse geocode failed:", e); }
  return "Your location";
}

// ---------- Render functions ----------
function renderWeather(data, locationName) {
  const current = data.current;
  const weather = describeWeather(current.weather_code, current.is_day === 1);

  els.currentLocation.textContent = locationName;
  els.currentCondition.textContent = `${weather.icon} ${weather.label}`;
  els.currentTemp.textContent = formatTemp(current.temperature_2m);
  els.feelsLike.textContent = `Feels like ${formatTemp(current.apparent_temperature)}`;

  const sunrise = formatTime(data.daily.sunrise[0]);
  const sunset = formatTime(data.daily.sunset[0]);

  els.currentStats.innerHTML = `
    <li><span class="stat-label">Humidity</span><span class="stat-value">${current.relative_humidity_2m}%</span></li>
    <li><span class="stat-label">Wind</span><span class="stat-value">${Math.round(current.wind_speed_10m)} km/h</span></li>
    <li><span class="stat-label">Sunrise</span><span class="stat-value">${sunrise}</span></li>
    <li><span class="stat-label">Sunset</span><span class="stat-value">${sunset}</span></li>
  `;

  els.status.hidden = true;
  els.currentWeather.hidden = false;
  els.forecastSection.hidden = false;
  els.chartSection.hidden = false;
}

function renderForecast(data) {
  const daily = data.daily;
  const html = daily.time.map((date, i) => {
    const weather = describeWeather(daily.weather_code[i]);
    const dayLabel = i === 0 ? "Today" : formatDayShort(date);
    return `
      <li>
        <div class="forecast-day">${dayLabel}</div>
        <div class="forecast-icon">${weather.icon}</div>
        <div class="forecast-high">${formatTempShort(daily.temperature_2m_max[i])}</div>
        <div class="forecast-low">${formatTempShort(daily.temperature_2m_min[i])}</div>
      </li>`;
  }).join("");
  els.forecastList.innerHTML = html;
}

function renderChart(data) {
  const canvas = els.chart;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  ctx.clearRect(0, 0, width, height);

  const temps = data.hourly.temperature_2m;
  const times = data.hourly.time;
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const range = max - min || 1;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const xFor = (i) => padding.left + (i / (temps.length - 1)) * chartW;
  const yFor = (t) => padding.top + chartH - ((t - min) / range) * chartH;

  const styles = getComputedStyle(document.body);
  const lineColor = styles.getPropertyValue("--accent").trim() || "#0ea5e9";
  const textColor = styles.getPropertyValue("--text-secondary").trim() || "#475569";
  const gridColor = styles.getPropertyValue("--card-border").trim() || "#cbd5e1";

  ctx.strokeStyle = gridColor;
  ctx.fillStyle = textColor;
  ctx.font = "11px -apple-system, system-ui, sans-serif";
  ctx.lineWidth = 1;

  for (let i = 0; i < 3; i++) {
    const value = min + (range * i) / 2;
    const y = yFor(value);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.fillText(formatTempShort(value), 5, y + 4);
  }

  for (let i = 0; i < temps.length; i += 24) {
    const x = xFor(i);
    const day = new Date(times[i]).toLocaleDateString(undefined, { weekday: "short" });
    ctx.fillText(day, x - 10, height - 10);
  }

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  temps.forEach((t, i) => {
    const x = xFor(i);
    const y = yFor(t);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.lineTo(xFor(temps.length - 1), padding.top + chartH);
  ctx.lineTo(padding.left, padding.top + chartH);
  ctx.closePath();
  ctx.fillStyle = lineColor + "20";
  ctx.fill();
}

function applyTheme() {
  if (!state.data) return;
  const code = state.data.current.weather_code;
  const isDay = state.data.current.is_day === 1;
  const theme = describeWeather(code).theme;

  document.body.classList.remove("theme-clear", "theme-cloudy", "theme-rain", "theme-snow", "theme-storm", "night");
  document.body.classList.add(`theme-${theme}`);
  if (!isDay) document.body.classList.add("night");
}

function renderAll() {
  if (!state.data) return;
  applyTheme();
  renderWeather(state.data, state.locationName);
  renderForecast(state.data);
  renderChart(state.data);
  updateWalkerOutfit();
  startWalker();
}

function showError(message) {
  els.status.hidden = false;
  els.currentWeather.hidden = true;
  els.statusMessage.textContent = message;
}

// ---------- Walker ----------
const walkerState = { el: null, hole: null, active: false };
const WALKER_SIZE = 120;

function pickWalkerVariant(code, isDay) {
  if (!isDay) return "night-johnny";
  const rainCodes = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99];
  if (rainCodes.includes(code)) return "rain-johnny";
  const snowCodes = [71, 73, 75, 77, 85, 86];
  if (snowCodes.includes(code)) return "winter-johnny";
  const fogCodes = [45, 48];
  if (fogCodes.includes(code)) return "cold-johnny";
  const clearCodes = [0, 1];
  if (clearCodes.includes(code)) return "sunny-johnny";
  return "average-johnny";
}

function updateWalkerOutfit() {
  if (!state.data) return;
  const img = document.getElementById("walker");
  if (!img) return;
  const code = state.data.current.weather_code;
  const isDay = state.data.current.is_day === 1;
  img.src = `assets/walker/${pickWalkerVariant(code, isDay)}.svg`;
}

function randomPosition() {
  const margin = 100;
  const x = margin + Math.random() * (window.innerWidth - margin * 2 - WALKER_SIZE);
  const y = margin + Math.random() * (window.innerHeight - margin * 2 - WALKER_SIZE);
  return { x, y };
}

function placeWalker(x, y) {
  const container = walkerState.el.parentElement;
  const walkerBottom = window.innerHeight - y - WALKER_SIZE;
  container.style.left = `${x}px`;
  container.style.bottom = `${walkerBottom}px`;
  walkerState.hole.style.left = `${x + (WALKER_SIZE - 70) / 2}px`;
  walkerState.hole.style.bottom = `${walkerBottom}px`;
}

async function walkerLoop() {
  while (walkerState.active) {
    const container = walkerState.el.parentElement;

    // Teleport (no transition)
    container.style.transition = "none";
    const start = randomPosition();
    walkerState.el.classList.remove("walking", "facing-left");
    walkerState.el.classList.add("in-hole");
    placeWalker(start.x, start.y);
    await wait(50);

    // Show hole
    walkerState.hole.classList.add("visible");
    await wait(400);

    // Emerge
    walkerState.el.classList.remove("in-hole");
    walkerState.el.classList.add("walking");
    await wait(800);

    // Hide spawn hole
    walkerState.hole.classList.remove("visible");
    await wait(200);

    // Re-enable transition for walking
    container.style.transition = "left 2s linear, bottom 2s linear, transform 0.6s ease-in-out";
    await wait(20);

    // Walk to new spot
    const angle = Math.random() * Math.PI * 2;
    const distance = 400 + Math.random() * 400;
    const walkX = Math.max(50, Math.min(window.innerWidth - 130, start.x + Math.cos(angle) * distance));
    const walkY = Math.max(100, Math.min(window.innerHeight - 100, start.y + Math.sin(angle) * distance * 0.3));

    if (walkX < start.x) walkerState.el.classList.add("facing-left");
    else walkerState.el.classList.remove("facing-left");

    container.style.left = `${walkX}px`;
    container.style.bottom = `${window.innerHeight - walkY - WALKER_SIZE}px`;
    await wait(2000);

    // Show destination hole
    const walkerBottomAtEnd = window.innerHeight - walkY - WALKER_SIZE;
    walkerState.hole.style.left = `${walkX + (WALKER_SIZE - 70) / 2}px`;
    walkerState.hole.style.bottom = `${walkerBottomAtEnd}px`;
    walkerState.hole.classList.add("visible");
    await wait(400);

    // Sink in
    walkerState.el.classList.remove("walking");
    walkerState.el.classList.add("in-hole");
    await wait(800);

    // Hide hole, pause
    walkerState.hole.classList.remove("visible");
    await wait(1500);
  }
}

function startWalker() {
  if (walkerState.active) return;
  walkerState.el = document.getElementById("walker");
  walkerState.hole = document.getElementById("walker-hole");
  if (!walkerState.el || !walkerState.hole) return;
  walkerState.active = true;
  walkerLoop();
}

// ---------- Suggestions / search ----------
function renderSuggestions(cities) {
  if (cities.length === 0) {
    els.suggestions.hidden = true;
    els.suggestions.innerHTML = "";
    return;
  }

  els.suggestions.innerHTML = "";

  cities.forEach((city) => {
    const li = document.createElement("li");
    li.tabIndex = 0;
    li.setAttribute("role", "option");

    const name = document.createElement("div");
    name.textContent = city.name;
    name.style.fontWeight = "600";

    const sub = document.createElement("div");
    sub.textContent = [city.admin1, city.country].filter(Boolean).join(", ");
    sub.style.fontSize = "13px";
    sub.style.color = "var(--text-muted)";

    li.appendChild(name);
    li.appendChild(sub);

    li.addEventListener("click", () => selectCity(city));
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectCity(city);
      }
    });

    els.suggestions.appendChild(li);
  });

  els.suggestions.hidden = false;
}

function selectCity(city) {
  els.search.value = "";
  els.suggestions.hidden = true;
  els.suggestions.innerHTML = "";

  els.status.hidden = false;
  els.currentWeather.hidden = true;
  els.statusMessage.textContent = "Loading weather...";

  const displayName = city.country ? `${city.name}, ${city.country}` : city.name;
  addToRecent(displayName, city.latitude, city.longitude);
  loadWeatherFor(city.latitude, city.longitude, displayName);
}

async function loadWeatherFor(lat, lon, locationName) {
  try {
    const data = await fetchWeather(lat, lon);
    state.data = data;
    state.locationName = locationName;
    renderAll();
  } catch (error) {
    console.error("Weather fetch failed:", error);
    showError("Could not load weather. Check your connection and try again.");
  }
}

// ---------- Recent cities ----------
function addToRecent(name, lat, lon) {
  const filtered = state.recent.filter(c => !(c.lat === lat && c.lon === lon));
  state.recent = [{ name, lat, lon }, ...filtered].slice(0, 5);
  saveRecent(state.recent);
  renderRecent();
}

function removeFromRecent(city) {
  state.recent = state.recent.filter(c => !(c.lat === city.lat && c.lon === city.lon));
  saveRecent(state.recent);
  renderRecent();
}

function renderRecent() {
  if (state.recent.length === 0) {
    els.recentSection.hidden = true;
    return;
  }

  els.recentList.innerHTML = "";
  state.recent.forEach((city) => {
    const li = document.createElement("li");

    const button = document.createElement("button");
    button.textContent = city.name;
    button.addEventListener("click", () => {
      loadWeatherFor(city.lat, city.lon, city.name);
    });

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "×";
    removeBtn.setAttribute("aria-label", `Remove ${city.name}`);
    removeBtn.style.padding = "2px 8px";
    removeBtn.style.fontSize = "16px";
    removeBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      removeFromRecent(city);
    });

    li.appendChild(button);
    li.appendChild(removeBtn);
    els.recentList.appendChild(li);
  });

  els.recentSection.hidden = false;
}

// ---------- Geolocation init ----------
function init() {
  if (!navigator.geolocation) {
    console.warn("Geolocation not supported");
    loadWeatherFor(19.4326, -99.1332, "Mexico City");
    return;
  }
  els.statusMessage.textContent = "Detecting your location...";
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      const locationName = await reverseGeocode(lat, lon);
      loadWeatherFor(lat, lon, locationName);
    },
    (error) => {
      console.warn("Geolocation failed:", error.message);
      loadWeatherFor(19.4326, -99.1332, "Mexico City");
    },
    { timeout: 10000, maximumAge: 600000 }
  );
}

// ---------- Event listeners ----------

// Search input
const handleSearchInput = debounce(async (event) => {
  const query = event.target.value.trim();
  if (query.length < 2) {
    els.suggestions.hidden = true;
    return;
  }
  try {
    const cities = await searchCities(query);
    renderSuggestions(cities);
  } catch (error) {
    console.error("Search failed:", error);
    els.suggestions.hidden = true;
  }
}, 250);

els.search.addEventListener("input", handleSearchInput);

// Search keyboard navigation (Enter + arrow down to enter list)
els.search.addEventListener("keydown", (event) => {
  const items = Array.from(els.suggestions.querySelectorAll("li"));
  if (event.key === "ArrowDown" && items.length > 0) {
    event.preventDefault();
    items[0].focus();
  } else if (event.key === "Enter") {
    event.preventDefault();
    if (items.length > 0) items[0].click();
  }
});

// Arrow navigation within suggestions
els.suggestions.addEventListener("keydown", (event) => {
  const items = Array.from(els.suggestions.querySelectorAll("li"));
  const currentIndex = items.indexOf(document.activeElement);

  if (event.key === "ArrowDown") {
    event.preventDefault();
    (items[currentIndex + 1] || items[0]).focus();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    (items[currentIndex - 1] || items[items.length - 1]).focus();
  } else if (event.key === "Escape") {
    event.preventDefault();
    els.suggestions.hidden = true;
    els.search.focus();
  }
});

// Click outside closes suggestions
document.addEventListener("click", (event) => {
  if (!event.target.closest(".search-section")) {
    els.suggestions.hidden = true;
  }
});

// Locate button
els.locateBtn.addEventListener("click", () => {
  els.status.hidden = false;
  els.currentWeather.hidden = true;
  init();
});

// Unit toggle
els.unitToggle.textContent = `°${state.unit}`;
els.unitToggle.addEventListener("click", () => {
  state.unit = state.unit === "C" ? "F" : "C";
  els.unitToggle.textContent = `°${state.unit}`;
  renderAll();
});

// Dark mode toggle
els.themeToggle.addEventListener("click", () => {
  state.dark = !state.dark;
  document.body.classList.toggle("dark", state.dark);
  els.themeToggle.textContent = state.dark ? "☀️" : "🌛";
  renderAll();
});

// ---------- Boot ----------
state.recent = loadRecent();
renderRecent();
init();