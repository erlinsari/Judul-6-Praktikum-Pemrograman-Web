const API_KEY = "88b3d2e48918b68fb9794a24cbfab2eb";
const AUTO_REFRESH_MINUTES = 5;

const body = document.body;
const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const saveFavoriteBtn = document.getElementById("saveFavoriteBtn");
const refreshBtn = document.getElementById("refreshBtn");
const unitToggle = document.getElementById("unitToggle");
const unitLabel = document.getElementById("unitLabel");
const themeToggle = document.getElementById("themeToggle");
const themeLabel = document.getElementById("themeLabel");
const suggestionsEl = document.getElementById("suggestions");
const searchStatus = document.getElementById("searchStatus");
const currentWeatherEl = document.getElementById("currentWeather");
const forecastEl = document.getElementById("forecast");
const lastUpdatedEl = document.getElementById("lastUpdated");
const favoriteListEl = document.getElementById("favoriteList");

let unit = localStorage.getItem("weather_unit") || "metric";
let theme = localStorage.getItem("weather_theme") || "light";
let currentCity = null;
let autoRefreshTimer = null;
let autocompleteTimeout = null;

function getTempUnitSymbol() {
  return unit === "metric" ? "°C" : "°F";
}

function formatTemp(value) {
  return `${value.toFixed(1)}${getTempUnitSymbol()}`;
}

function setTheme(newTheme) {
  theme = newTheme;
  if (theme === "dark") {
    body.classList.add("dark");
    themeLabel.textContent = "Dark";
  } else {
    body.classList.remove("dark");
    themeLabel.textContent = "Light";
  }
  localStorage.setItem("weather_theme", theme);
}

function setUnit(newUnit) {
  unit = newUnit;
  unitLabel.textContent =
    unit === "metric" ? "Celsius (°C)" : "Fahrenheit (°F)";
  localStorage.setItem("weather_unit", unit);
  if (currentCity) {
    loadWeatherAndForecast(currentCity.lat, currentCity.lon, currentCity.name);
  }
}

function setSearchStatus(message, isError = false) {
  if (!message) {
    searchStatus.textContent = "";
    searchStatus.style.color = "";
    return;
  }
  searchStatus.textContent = message;
  searchStatus.style.color = isError ? "#ef4444" : "";
}

function setLoading(isLoading) {
  if (isLoading) {
    currentWeatherEl.innerHTML =
      '<div class="loading-text"><span class="spinner"></span> <span>Memuat data cuaca...</span></div>';
    currentWeatherEl.classList.remove("empty");
    forecastEl.innerHTML =
      '<div class="loading-text"><span class="spinner"></span> <span>Memuat prakiraan 5 hari...</span></div>';
    forecastEl.classList.remove("empty");
    searchBtn.disabled =
      refreshBtn.disabled =
      saveFavoriteBtn.disabled =
        true;
  } else {
    searchBtn.disabled =
      refreshBtn.disabled =
      saveFavoriteBtn.disabled =
        false;
  }
}

function scheduleAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
  }
  if (!currentCity) return;
  autoRefreshTimer = setInterval(() => {
    loadWeatherAndForecast(currentCity.lat, currentCity.lon, currentCity.name, {
      silent: true,
    });
  }, AUTO_REFRESH_MINUTES * 60 * 1000);
}

function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem("weather_favorites")) || [];
  } catch {
    return [];
  }
}

function saveFavorites(list) {
  localStorage.setItem("weather_favorites", JSON.stringify(list));
}

function renderFavorites() {
  const favorites = getFavorites();
  favoriteListEl.innerHTML = "";
  if (!favorites.length) {
    favoriteListEl.innerHTML =
      '<p class="muted small">Belum ada kota favorit.</p>';
    return;
  }
  favorites.forEach((city) => {
    const div = document.createElement("div");
    div.className = "favorite-item";
    div.textContent = city;
    div.addEventListener("click", () => {
      cityInput.value = city;
      handleSearch(city);
    });
    favoriteListEl.appendChild(div);
  });
}

function addCurrentCityToFavorites() {
  const name = cityInput.value.trim();
  if (!name) return;
  const favorites = getFavorites();
  const exists = favorites.some(
    (c) => c.toLowerCase() === name.toLowerCase()
  );
  if (exists) {
    setSearchStatus("Kota sudah ada di daftar favorit.", false);
    return;
  }
  favorites.push(name);
  saveFavorites(favorites);
  renderFavorites();
  setSearchStatus("Kota ditambahkan ke favorit.", false);
}

function clearSuggestions() {
  suggestionsEl.innerHTML = "";
  suggestionsEl.classList.add("hidden");
}

async function fetchSuggestions(query) {
  if (!query || query.length < 2) {
    clearSuggestions();
    return;
  }
  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
    query
  )}&limit=5&appid=${API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) {
      clearSuggestions();
      return;
    }
    suggestionsEl.innerHTML = "";
    data.forEach((item) => {
      const btn = document.createElement("div");
      btn.className = "suggestion-item";
      const cityName = `${item.name}${
        item.state ? ", " + item.state : ""
      }, ${item.country}`;
      btn.innerHTML = `<span class="city-name">${cityName}</span>`;
      btn.addEventListener("click", () => {
        cityInput.value = item.name;
        clearSuggestions();
        handleSearch(item.name, item.lat, item.lon);
      });
      suggestionsEl.appendChild(btn);
    });
    suggestionsEl.classList.remove("hidden");
  } catch (err) {
    console.error(err);
    clearSuggestions();
  }
}

function renderCurrentWeather(data) {
  const temp = data.main.temp;
  const humidity = data.main.humidity;
  const wind = data.wind.speed;
  const desc = data.weather[0].description;
  const icon = data.weather[0].icon;
  const cityName = data.name;
  const country = data.sys.country;
  const dt = new Date(data.dt * 1000);
  const timeString = dt.toLocaleString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  lastUpdatedEl.textContent = `Terakhir diperbarui: ${timeString}`;
  const windUnit = unit === "metric" ? "m/s" : "mph";
  currentWeatherEl.classList.remove("empty");
  currentWeatherEl.innerHTML = `
    <div class="current-main-row">
      <div class="current-left">
        <div class="current-location">${cityName}, ${country}</div>
        <div class="current-desc">${desc}</div>
        <div class="current-temp-row">
          <span class="current-temp">${temp.toFixed(1)}</span>
          <span class="current-unit">${getTempUnitSymbol()}</span>
        </div>
      </div>
      <div class="current-right">
        <img
          class="current-icon"
          src="https://openweathermap.org/img/wn/${icon}@2x.png"
          alt="ikon cuaca"
        />
      </div>
    </div>
    <div class="current-extra">
      <div class="current-extra-item">
        <span>🌡️</span>
        <span>Suhu: ${formatTemp(temp)}</span>
      </div>
      <div class="current-extra-item">
        <span>💧</span>
        <span>Kelembapan: ${humidity}%</span>
      </div>
      <div class="current-extra-item">
        <span>🌬️</span>
        <span>Angin: ${wind.toFixed(2)} ${windUnit}</span>
      </div>
    </div>
  `;
}

function renderForecast(data) {
  if (!data || !Array.isArray(data.list) || !data.list.length) {
    forecastEl.innerHTML =
      '<p class="muted small">Data prakiraan tidak tersedia.</p>';
    forecastEl.classList.add("empty");
    return;
  }
  const perDay = {};
  data.list.forEach((item) => {
    const date = item.dt_txt.split(" ")[0];
    if (!perDay[date]) perDay[date] = [];
    perDay[date].push(item);
  });
  const days = Object.keys(perDay).slice(0, 5);
  forecastEl.innerHTML = "";
  forecastEl.classList.remove("empty");
  days.forEach((dateStr) => {
    const items = perDay[dateStr];
    let minTemp = Infinity;
    let maxTemp = -Infinity;
    let sample = items[Math.floor(items.length / 2)];
    items.forEach((it) => {
      if (it.main.temp_min < minTemp) minTemp = it.main.temp_min;
      if (it.main.temp_max > maxTemp) maxTemp = it.main.temp_max;
    });
    const d = new Date(dateStr + "T00:00:00");
    const dayLabel = d.toLocaleDateString("id-ID", {
      weekday: "long",
    });
    const dateLabel = d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    });
    const icon = sample.weather[0].icon;
    const desc = sample.weather[0].description;
    const div = document.createElement("div");
    div.className = "forecast-item";
    div.innerHTML = `
      <div>
        <div class="forecast-day">${dayLabel}</div>
        <div class="forecast-date">${dateLabel}</div>
      </div>
      <div class="forecast-mid">
        <img
          class="forecast-icon"
          src="https://openweathermap.org/img/wn/${icon}.png"
          alt="ikon cuaca"
        />
        <div class="forecast-desc">${desc}</div>
      </div>
      <div class="forecast-temp">
        <div>Max: ${formatTemp(maxTemp)}</div>
        <div>Min: ${formatTemp(minTemp)}</div>
      </div>
    `;
    forecastEl.appendChild(div);
  });
}

async function loadWeatherAndForecast(
  lat,
  lon,
  cityNameOverride = null,
  options = {}
) {
  const { silent = false } = options;
  if (!silent) setLoading(true);
  try {
    const urlCurrent = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${unit}&lang=id`;
    const urlForecast = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${unit}&lang=id`;
    const [resCurrent, resForecast] = await Promise.all([
      fetch(urlCurrent),
      fetch(urlForecast),
    ]);
    if (!resCurrent.ok) {
      throw new Error("Gagal mengambil data cuaca.");
    }
    const currentData = await resCurrent.json();
    const forecastData = await resForecast.json();
    const cityName = cityNameOverride || currentData.name;
    currentCity = {
      name: cityName,
      lat: currentData.coord.lat,
      lon: currentData.coord.lon,
    };
    renderCurrentWeather(currentData);
    renderForecast(forecastData);
    if (!silent) {
      setSearchStatus("Data berhasil diperbarui.", false);
    }
    scheduleAutoRefresh();
  } catch (err) {
    console.error(err);
    currentWeatherEl.innerHTML =
      '<p class="muted">Gagal memuat data cuaca. Coba lagi.</p>';
    forecastEl.innerHTML =
      '<p class="muted small">Gagal memuat data prakiraan.</p>';
    forecastEl.classList.add("empty");
    setSearchStatus("Terjadi kesalahan saat mengambil data.", true);
  } finally {
    if (!silent) setLoading(false);
  }
}

async function handleSearch(name, lat, lon) {
  const city = (name || cityInput.value).trim();
  if (!city) return;
  clearSuggestions();
  setSearchStatus("");
  setLoading(true);
  try {
    let finalLat = lat;
    let finalLon = lon;
    if (finalLat == null || finalLon == null) {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
        city
      )}&appid=${API_KEY}&units=${unit}&lang=id`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Kota tidak ditemukan.");
      }
      const data = await res.json();
      finalLat = data.coord.lat;
      finalLon = data.coord.lon;
      renderCurrentWeather(data);
      currentCity = { name: data.name, lat: finalLat, lon: finalLon };
      scheduleAutoRefresh();
      const urlForecast = `https://api.openweathermap.org/data/2.5/forecast?lat=${finalLat}&lon=${finalLon}&appid=${API_KEY}&units=${unit}&lang=id`;
      const resForecast = await fetch(urlForecast);
      const forecastData = await resForecast.json();
      renderForecast(forecastData);
      setSearchStatus("Data berhasil dimuat.", false);
    } else {
      await loadWeatherAndForecast(finalLat, finalLon, city);
    }
  } catch (err) {
    console.error(err);
    currentWeatherEl.innerHTML =
      '<p class="muted">❌ Kota tidak ditemukan.</p>';
    currentWeatherEl.classList.add("empty");
    forecastEl.innerHTML =
      '<p class="muted small">Data prakiraan tidak tersedia.</p>';
    forecastEl.classList.add("empty");
    setSearchStatus(err.message || "Terjadi kesalahan.", true);
  } finally {
    setLoading(false);
  }
}

unitToggle.addEventListener("click", () => {
  const newUnit = unit === "metric" ? "imperial" : "metric";
  setUnit(newUnit);
});

themeToggle.addEventListener("click", () => {
  const newTheme = theme === "light" ? "dark" : "light";
  setTheme(newTheme);
});

searchBtn.addEventListener("click", () => {
  handleSearch();
});

cityInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    handleSearch();
  }
});

cityInput.addEventListener("input", () => {
  const q = cityInput.value.trim();
  if (autocompleteTimeout) clearTimeout(autocompleteTimeout);
  autocompleteTimeout = setTimeout(() => {
    fetchSuggestions(q);
  }, 250);
});

document.addEventListener("click", (e) => {
  if (!suggestionsEl.contains(e.target) && e.target !== cityInput) {
    clearSuggestions();
  }
});

saveFavoriteBtn.addEventListener("click", () => {
  addCurrentCityToFavorites();
});

refreshBtn.addEventListener("click", () => {
  if (!currentCity) {
    setSearchStatus("Belum ada kota yang dipilih.", true);
    return;
  }
  loadWeatherAndForecast(currentCity.lat, currentCity.lon, currentCity.name);
});

(function init() {
  setTheme(theme);
  setUnit(unit);
  renderFavorites();
})();
