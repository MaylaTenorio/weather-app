// =====================================================
// Weather App - app.js
// =====================================================

// ---------- 1. Grab DOM elements once, at the top ----------
// We cache references so we don't query the DOM repeatedly.
// ---------- 1. Grab DOM elements once, at the top ----------
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
};

// ---------- App state ----------
const state = {
  data: null,
  locationName: "",
  unit: "C",
  dark: false,
  recent: [],   // array of { name, lat, lon } objects
};

// ---------- 2. Weather code lookup ----------
// Open-Meteo returns a numeric "weather_code" (WMO standard).
// We map it to a human-readable label and an emoji icon.
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

  // Swap day icons for night equivalents on clear/partly cloudy
  if (!isDay) {
    if (code === 0 || code === 1) return { ...base, icon: "🌛", label: code === 0 ? "Clear night" : "Mostly clear night" };
    if (code === 2) return { ...base, icon: "☁️", label: "Partly cloudy night" };
  }

  return base;
}

// ---------- 3. The fetch function ----------
async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast`
    + `?latitude=${lat}&longitude=${lon}`
    + `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m`
    + `&hourly=temperature_2m`
    + `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset`
    + `&timezone=auto&forecast_days=5`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`API returned ${response.status}`);
  return await response.json();
}

// ---------- 4. Render to the DOM ----------
function renderWeather(data, locationName) {
  const current = data.current;
  const weather = describeWeather(current.weather_code, current.is_day === 1);

  els.currentLocation.textContent = locationName;
  els.currentCondition.textContent = `${weather.icon} ${weather.label}`;
  els.currentTemp.textContent = formatTemp(current.temperature_2m);
  els.feelsLike.textContent = `Feels like ${formatTemp(current.apparent_temperature)}`;

  // Use sunrise/sunset from daily, today's index is [0]
  const sunrise = formatTime(data.daily.sunrise[0]);
  const sunset = formatTime(data.daily.sunset[0]);

  els.currentStats.innerHTML = `
    <li>
      <span class="stat-label">Humidity</span>
      <span class="stat-value">${current.relative_humidity_2m}%</span>
    </li>
    <li>
      <span class="stat-label">Wind</span>
      <span class="stat-value">${Math.round(current.wind_speed_10m)} km/h</span>
    </li>
    <li>
      <span class="stat-label">Sunrise</span>
      <span class="stat-value">${sunrise}</span>
    </li>
    <li>
      <span class="stat-label">Sunset</span>
      <span class="stat-value">${sunset}</span>
    </li>
  `;

  els.status.hidden = true;
  els.currentWeather.hidden = false;
  els.forecastSection.hidden = false;
  els.chartSection.hidden = false;
}

// ---------- Walker ----------

// ---------- Walker (the wandering version) ----------
const walkerState = {
  el: null,
  hole: null,
  active: false,
};

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
// Pick a random position on the screen, with margins so he doesn't go off-edge
function randomPosition() {
  const margin = 100;
  const x = margin + Math.random() * (window.innerWidth - margin * 2 - 80);
  const y = margin + Math.random() * (window.innerHeight - margin * 2 - 80);
  return { x, y };
}

// Place walker + hole at a position
function placeWalker(x, y) {
  const container = walkerState.el.parentElement;
  const size = 120;

  // Walker container position
  const walkerBottom = window.innerHeight - y - size;
  container.style.left = `${x}px`;
  container.style.bottom = `${walkerBottom}px`;

  // Hole sits at Walker's feet (same bottom as Walker)
  walkerState.hole.style.left = `${x + (size - 70) / 2}px`;
  walkerState.hole.style.bottom = `${walkerBottom}px`;
}
// Move walker to a nearby position (without moving the hole)
function walkTo(x, y) {
  const container = walkerState.el.parentElement;
  // Direction matters for which way Johnny faces
  const currentLeft = parseFloat(container.style.left) || 0;
  if (x < currentLeft) {
    walkerState.el.classList.add("facing-left");
  } else {
    walkerState.el.classList.remove("facing-left");
  }
  container.style.left = `${x}px`;
  container.style.bottom = `${window.innerHeight - y - 80}px`;
}

// Wait helper — returns a promise that resolves after ms milliseconds
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The main loop: appear → walk → disappear → repeat
async function walkerLoop() {
  while (walkerState.active) {
    const container = walkerState.el.parentElement;

    // 1. TELEPORT to a random spot (no transition)
    container.style.transition = "none";
    const start = randomPosition();
    walkerState.el.classList.remove("walking", "facing-left");
    walkerState.el.classList.add("in-hole");
    placeWalker(start.x, start.y);
    await wait(50); // let DOM settle

    // 2. Show the hole at his spot
    walkerState.hole.classList.add("visible");
    await wait(400);

    // 3. Emerge from hole (he scales up)
    walkerState.el.classList.remove("in-hole");
    walkerState.el.classList.add("walking");
    await wait(800);

    // 4. Hide the spawn hole now that he's out
    walkerState.hole.classList.remove("visible");
    await wait(200);

    // 5. Re-enable transition for smooth walking
    container.style.transition = "left 2s linear, bottom 2s linear, transform 0.6s ease-in-out";
    await wait(20); // let browser register the transition

    // 6. Walk to a new spot
    const angle = Math.random() * Math.PI * 2;
    const distance = 400 + Math.random() * 400;
    const walkX = Math.max(50, Math.min(window.innerWidth - 130, start.x + Math.cos(angle) * distance));
    const walkY = Math.max(100, Math.min(window.innerHeight - 100, start.y + Math.sin(angle) * distance * 0.3));

    // Set facing direction
    if (walkX < start.x) {
      walkerState.el.classList.add("facing-left");
    } else {
      walkerState.el.classList.remove("facing-left");
    }

    container.style.left = `${walkX}px`;
    container.style.bottom = `${window.innerHeight - walkY - 100}px`;
    await wait(2000); // walking takes 4 seconds

    // 7. Show new hole at his current spot (use the destination coords, not stored)
   // 7. Show new hole at his current spot (same bottom as Walker)
// 7. Show new hole at his current spot (same bottom as Walker)
const size = 120;
const walkerBottomAtEnd = window.innerHeight - walkY - size;
walkerState.hole.style.left = `${walkX + (size - 70) / 2}px`;
walkerState.hole.style.bottom = `${walkerBottomAtEnd}px`;
walkerState.hole.classList.add("visible");

    // 8. Sink into hole
    walkerState.el.classList.remove("walking");
    walkerState.el.classList.add("in-hole");
    await wait(800);

    // 9. Hide hole, pause before next cycle
    walkerState.hole.classList.remove("visible");
    await wait(1500);
  }
}

// Start everything once weather has loaded for the first time
function startWalker() {
  if (walkerState.active) return;
  walkerState.el = document.getElementById("walker");
  walkerState.hole = document.getElementById("walker-hole");
  if (!walkerState.el || !walkerState.hole) return;
  walkerState.active = true;
  walkerLoop();
}



// Helper: ISO datetime → "6:42 AM"
function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// ---------- Temperature helpers ----------
function cToF(celsius) {
  return (celsius * 9) / 5 + 32;
}

// Format a celsius value according to current unit
function formatTemp(celsius) {
  const value = state.unit === "C" ? celsius : cToF(celsius);
  return `${Math.round(value)}°${state.unit}`;
}

// Same but no unit suffix (for use where context makes it obvious)
function formatTempShort(celsius) {
  const value = state.unit === "C" ? celsius : cToF(celsius);
  return `${Math.round(value)}°`;
}



// ---------- 5. Show errors gracefully ----------
function showError(message) {
  els.status.hidden = false;
  els.currentWeather.hidden = true;
  els.statusMessage.textContent = message;
}

// ---------- 6. Kick everything off ----------
function init() {
  // Try geolocation first. If anything goes wrong, fall back to Mexico City.
  if (!navigator.geolocation) {
    // Very old browser, or geolocation disabled at OS level
    console.warn("Geolocation not supported");
    loadWeatherFor(19.4326, -99.1332, "Mexico City");
    return;
  }

  // Show a tailored loading message
  els.statusMessage.textContent = "Detecting your location...";

  navigator.geolocation.getCurrentPosition(
    // Success callback
    async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      // We have coords, but we want a city name to display.
      // Open-Meteo has a reverse geocoding endpoint for that.
      const locationName = await reverseGeocode(lat, lon);
      loadWeatherFor(lat, lon, locationName);
    },
    // Error callback (denied, timed out, unavailable)
    (error) => {
      console.warn("Geolocation failed:", error.message);
      loadWeatherFor(19.4326, -99.1332, "Mexico City");
    },
    // Options
    {
      timeout: 10000,        // give up after 10 seconds
      maximumAge: 600000,    // accept a cached position up to 10 minutes old
    }
  );
}

// Reverse geocoding: coordinates → city name
async function reverseGeocode(lat, lon) {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client`
      + `?latitude=${lat}&longitude=${lon}&localityLanguage=en`;

    const response = await fetch(url);
    if (!response.ok) throw new Error("Reverse geocode failed");
    const data = await response.json();

    const city = data.city || data.locality;
    const country = data.countryName;

    if (city && country) return `${city}, ${country}`;
    if (city) return city;
  } catch (error) {
    console.warn("Reverse geocode failed:", error);
  }
  return "Your location";
}

// =====================================================
// Step 5: City search & autocomplete
// =====================================================

// ---------- Add new DOM references ----------
els.search = document.getElementById("city-search");
els.suggestions = document.getElementById("search-suggestions");

// ---------- Geocoding API call ----------
async function searchCities(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search`
    + `?name=${encodeURIComponent(query)}`
    + `&count=5&language=en&format=json`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Geocoding failed: ${response.status}`);

  const data = await response.json();
  return data.results || []; // empty array if no matches
}

// ---------- Render the suggestions dropdown ----------
function renderSuggestions(cities) {
  if (cities.length === 0) {
    els.suggestions.hidden = true;
    els.suggestions.innerHTML = "";
    return;
  }

  // Clear previous suggestions
  els.suggestions.innerHTML = "";

  // Build each suggestion as a real DOM element (safer than innerHTML)
  cities.forEach((city) => {
    const li = document.createElement("li");
    li.tabIndex = 0; // makes it focusable for keyboard users
    li.setAttribute("role", "option");

    // Primary line: city name
    const name = document.createElement("div");
    name.textContent = city.name;
    name.style.fontWeight = "600";

    // Secondary line: region + country
    const sub = document.createElement("div");
    sub.textContent = [city.admin1, city.country].filter(Boolean).join(", ");
    sub.style.fontSize = "13px";
    sub.style.color = "var(--text-muted)";

    li.appendChild(name);
    li.appendChild(sub);

    // Click handler
    li.addEventListener("click", () => selectCity(city));

    // Keyboard handler (Enter or Space)
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

// ---------- When a city is picked ----------
function selectCity(city) {
  // Clear the search UI
  els.search.value = "";
  els.suggestions.hidden = true;
  els.suggestions.innerHTML = "";

  // Show loading state
  els.status.hidden = false;
  els.currentWeather.hidden = true;
  els.statusMessage.textContent = "Loading weather...";

  // Build a nice display name
    const displayName = city.country
    ? `${city.name}, ${city.country}`
    : city.name;

  // Fetch weather for this city
  addToRecent(displayName, city.latitude, city.longitude); 
  loadWeatherFor(city.latitude, city.longitude, displayName);
}

// ---------- Load weather for any coords + name ----------
// We extract this into its own function because we'll reuse it
// for geolocation, recent cities, and anything else.
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

// Re-render everything from state — call this anytime state changes
function renderAll() {
  if (!state.data) return;
  applyTheme();
  renderWeather(state.data, state.locationName);
  renderForecast(state.data);
  renderChart(state.data);
  renderWalkerOutfit();   // ← add this line
}

function applyTheme() {
  if (!state.data) return;
  const code = state.data.current.weather_code;
  const isDay = state.data.current.is_day === 1;
  const theme = describeWeather(code).theme;

  // Remove all theme classes
  document.body.classList.remove(
    "theme-clear", "theme-cloudy", "theme-rain", "theme-snow", "theme-storm"
  );

  // Remove night class
  document.body.classList.remove("night");

  // Apply current theme
  document.body.classList.add(`theme-${theme}`);

  // Apply night class if applicable
  if (!isDay) {
    document.body.classList.add("night");
  }
}

// ---------- Debounce helper ----------
// Returns a new function that only runs after `delay` ms of inactivity.
function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ---------- Wire up the search input ----------
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

// ---------- Persistence ----------
const STORAGE_KEY = "weather-app-recent";

function loadRecent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecent(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (error) {
    console.warn("Could not save to localStorage:", error);
  }
}

// ---------- Handle Enter key ----------
els.search.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    // Pick the first visible suggestion
    const firstSuggestion = els.suggestions.querySelector("li");
    if (firstSuggestion) {
      firstSuggestion.click();
    }
  }
});

// ---------- Hide suggestions when clicking outside ----------
document.addEventListener("click", (event) => {
  if (!event.target.closest(".search-section")) {
    els.suggestions.hidden = true;
  }
});

els.locateBtn = document.getElementById("locate-btn");
els.locateBtn.addEventListener("click", () => {
  els.status.hidden = false;
  els.currentWeather.hidden = true;
  init();
});

function renderForecast(data) {
  const daily = data.daily;

  const html = daily.time.map((date, i) => {
    const weather = describeWeather(daily.weather_code[i]);
    const dayLabel = i === 0 ? "Today" : formatDayShort(date);
    const high = formatTempShort(daily.temperature_2m_max[i]);
    const low = formatTempShort(daily.temperature_2m_min[i]);

return `
  <li>
    <div class="forecast-day">${dayLabel}</div>
    <div class="forecast-icon">${weather.icon}</div>
    <div class="forecast-high">${high}</div>
    <div class="forecast-low">${low}</div>
  </li>
`;
  }).join("");

  els.forecastList.innerHTML = html;
}

// "2026-05-08" → "Fri"
function formatDayShort(isoDate) {
  const date = new Date(isoDate + "T12:00:00");
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

function renderChart(data) {
  const canvas = els.chart;
  const ctx = canvas.getContext("2d");

  // Make canvas crisp on high-DPI screens (Retina, etc.)
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;

  // Clear any previous drawing
  ctx.clearRect(0, 0, width, height);

  // Get the temperature data
  const temps = data.hourly.temperature_2m;
  const times = data.hourly.time;

  // Find min/max for scaling the y-axis with some padding
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const range = max - min || 1;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Convert a (index, temp) pair into (x, y) pixel coords
  const xFor = (i) => padding.left + (i / (temps.length - 1)) * chartWidth;
  const yFor = (t) => padding.top + chartHeight - ((t - min) / range) * chartHeight;

  // Read CSS variables so the chart matches the theme
  const styles = getComputedStyle(document.body);
  const lineColor = styles.getPropertyValue("--accent").trim() || "#0ea5e9";
  const textColor = styles.getPropertyValue("--text-secondary").trim() || "#475569";
  const gridColor = styles.getPropertyValue("--card-border").trim() || "#cbd5e1";

  // Draw horizontal gridlines + y-axis labels (3 lines: min, mid, max)
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

  // Draw day-boundary markers + x-axis labels (every 24 hours)
  for (let i = 0; i < temps.length; i += 24) {
    const x = xFor(i);
    const day = new Date(times[i]).toLocaleDateString(undefined, { weekday: "short" });
    ctx.fillText(day, x - 10, height - 10);
  }

  // Draw the temperature line
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

  // Soft fill underneath the line for visual weight
  ctx.lineTo(xFor(temps.length - 1), padding.top + chartHeight);
  ctx.lineTo(padding.left, padding.top + chartHeight);
  ctx.closePath();
  ctx.fillStyle = lineColor + "20"; // 20 = ~12% alpha in hex
  ctx.fill();
}

// ---------- Unit toggle ----------
els.unitToggle = document.getElementById("unit-toggle");
els.unitToggle.textContent = `°${state.unit}`;

els.unitToggle.addEventListener("click", () => {
  state.unit = state.unit === "C" ? "F" : "C";
  els.unitToggle.textContent = `°${state.unit}`;
  renderAll();
});


// ---------- Dark mode toggle ----------
els.themeToggle = document.getElementById("theme-toggle");

els.themeToggle.addEventListener("click", () => {
  state.dark = !state.dark;
  document.body.classList.toggle("dark", state.dark);
  els.themeToggle.textContent = state.dark ? "☀️" : "🌛";
  renderAll(); // redraw chart with new theme colors
});

function addToRecent(name, lat, lon) {
  // Remove if already present (we'll re-add at the front)
  const filtered = state.recent.filter(
    (city) => !(city.lat === lat && city.lon === lon)
  );

  // Add to the front, keep max 5
  state.recent = [{ name, lat, lon }, ...filtered].slice(0, 5);

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

function removeFromRecent(city) {
  state.recent = state.recent.filter(
    (c) => !(c.lat === city.lat && c.lon === city.lon)
  );
  saveRecent(state.recent);
  renderRecent();
}

function renderAll() {
  if (!state.data) return;
  applyTheme();
  renderWeather(state.data, state.locationName);
  renderForecast(state.data);
  renderChart(state.data);
  updateWalkerOutfit();   // ← change from renderWalker to this
  startWalker();           // ← kicks off the loop on first render
}


state.recent = loadRecent();
renderRecent();
init();