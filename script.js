/**
 * WeatherNow — Live Weather Forecast App
 * Vanilla JavaScript Implementation
 * 
 * Features:
 * - City geocoding via Open-Meteo Geocoding API
 * - Real-time atmospheric data & 5-day forecast via Open-Meteo Forecast API
 * - Comprehensive WMO weather-code mapping with custom SVG icons
 * - Unit switching (°C / °F) with instant recalculated metrics
 * - Race-condition prevention using active request tokens
 * - Disambiguation list for cities with identical or multiple names
 * - Local storage persistence for recent search history
 * - Full accessibility and beginner-friendly, well-commented code
 */

// ============================================================================
// 1. GLOBAL STATE & CONSTANTS
// ============================================================================

/**
 * AppState holds the current runtime state of the application.
 * Using a centralized state object makes it easy to track and update the UI.
 */
const AppState = {
  currentUnit: 'c', // 'c' for Celsius, 'f' for Fahrenheit
  currentCity: null, // Holds selected city metadata { name, admin1, country, latitude, longitude, timezone }
  currentWeatherData: null, // Raw weather data from Open-Meteo
  activeRequestId: 0, // Incremented on every search to prevent stale responses (race condition fix)
  recentSearchesKey: 'weathernow_recent_cities',
};

// Open-Meteo Public API Base URLs (No API Key required for educational/non-commercial use)
const GEOCODING_API_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_API_URL = 'https://api.open-meteo.com/v1/forecast';

// ============================================================================
// 2. WEATHER CODE MAPPING & SVG ICONS
// ============================================================================

/**
 * Returns a high-definition SVG weather icon matching the weather condition.
 * Creating SVG icons programmatically ensures crisp rendering at any screen resolution.
 */
function getConditionSVG(iconType) {
  switch (iconType) {
    case 'sun':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5" fill="#fef3c7"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>`;
    case 'moon':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="#e0e7ff"></path>
        </svg>`;
    case 'cloud-sun':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2v2" stroke="#f59e0b"></path>
          <path d="m4.93 4.93 1.41 1.41" stroke="#f59e0b"></path>
          <path d="M20 12h2" stroke="#f59e0b"></path>
          <path d="m19.07 4.93-1.41 1.41" stroke="#f59e0b"></path>
          <circle cx="12" cy="8" r="4" stroke="#f59e0b" fill="#fef3c7"></circle>
          <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" fill="#e0f2fe" stroke="#0284c7"></path>
        </svg>`;
    case 'cloud':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" fill="#f1f5f9"></path>
        </svg>`;
    case 'fog':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 14h16"></path>
          <path d="M4 18h16"></path>
          <path d="M4 10h16"></path>
          <path d="M4 6h16"></path>
        </svg>`;
    case 'drizzle':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.5 15H9a6 6 0 1 1 6-6c.3 0 .7 0 1 .1A4 4 0 1 1 17.5 15Z" fill="#e0f2fe"></path>
          <path d="m8 19-1 2"></path>
          <path d="m12 19-1 2"></path>
          <path d="m16 19-1 2"></path>
        </svg>`;
    case 'rain':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.5 15H9a6 6 0 1 1 6-6c.3 0 .7 0 1 .1A4 4 0 1 1 17.5 15Z" fill="#bae6fd"></path>
          <path d="m8 18-2 4" stroke-width="2.5"></path>
          <path d="m12 18-2 4" stroke-width="2.5"></path>
          <path d="m16 18-2 4" stroke-width="2.5"></path>
        </svg>`;
    case 'snow':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.5 15H9a6 6 0 1 1 6-6c.3 0 .7 0 1 .1A4 4 0 1 1 17.5 15Z" fill="#f0f9ff"></path>
          <path d="M8 19h.01"></path>
          <path d="M12 19h.01"></path>
          <path d="M16 19h.01"></path>
          <path d="M10 22h.01"></path>
          <path d="M14 22h.01"></path>
        </svg>`;
    case 'thunderstorm':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.5 14H9a6 6 0 1 1 6-6c.3 0 .7 0 1 .1A4 4 0 1 1 17.5 14Z" fill="#cbd5e1" stroke="#475569"></path>
          <polygon points="13 14 10 19 14 19 11 24" fill="#f59e0b" stroke="#d97706"></polygon>
        </svg>`;
    default:
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>`;
  }
}

/**
 * Comprehensive mapping of WMO Weather Interpretation Codes (WW)
 * as defined in the official Open-Meteo documentation.
 * 
 * Supports both daytime and nighttime variants where applicable.
 */
function getWeatherConditionMeta(wmoCode, isDay = 1) {
  const code = Number(wmoCode);

  switch (code) {
    case 0:
      return {
        label: 'Clear Sky',
        icon: isDay ? 'sun' : 'moon',
        emoji: isDay ? '☀️' : '🌙'
      };
    case 1:
      return {
        label: 'Mainly Clear',
        icon: isDay ? 'cloud-sun' : 'moon',
        emoji: isDay ? '🌤️' : '🌙'
      };
    case 2:
      return {
        label: 'Partly Cloudy',
        icon: 'cloud-sun',
        emoji: '⛅'
      };
    case 3:
      return {
        label: 'Overcast',
        icon: 'cloud',
        emoji: '☁️'
      };
    case 45:
      return {
        label: 'Foggy',
        icon: 'fog',
        emoji: '🌫️'
      };
    case 48:
      return {
        label: 'Depositing Rime Fog',
        icon: 'fog',
        emoji: '🌫️'
      };
    case 51:
      return {
        label: 'Light Drizzle',
        icon: 'drizzle',
        emoji: '🌦️'
      };
    case 53:
      return {
        label: 'Moderate Drizzle',
        icon: 'drizzle',
        emoji: '🌦️'
      };
    case 55:
      return {
        label: 'Dense Drizzle',
        icon: 'drizzle',
        emoji: '🌧️'
      };
    case 56:
      return {
        label: 'Light Freezing Drizzle',
        icon: 'snow',
        emoji: '🌧️❄️'
      };
    case 57:
      return {
        label: 'Dense Freezing Drizzle',
        icon: 'snow',
        emoji: '🌨️'
      };
    case 61:
      return {
        label: 'Slight Rain',
        icon: 'rain',
        emoji: '🌧️'
      };
    case 63:
      return {
        label: 'Moderate Rain',
        icon: 'rain',
        emoji: '🌧️'
      };
    case 65:
      return {
        label: 'Heavy Rain',
        icon: 'rain',
        emoji: '🌧️⛈️'
      };
    case 66:
      return {
        label: 'Light Freezing Rain',
        icon: 'snow',
        emoji: '🌧️❄️'
      };
    case 67:
      return {
        label: 'Heavy Freezing Rain',
        icon: 'snow',
        emoji: '🌨️'
      };
    case 71:
      return {
        label: 'Slight Snow Fall',
        icon: 'snow',
        emoji: '🌨️'
      };
    case 73:
      return {
        label: 'Moderate Snow Fall',
        icon: 'snow',
        emoji: '❄️'
      };
    case 75:
      return {
        label: 'Heavy Snow Fall',
        icon: 'snow',
        emoji: '❄️'
      };
    case 77:
      return {
        label: 'Snow Grains',
        icon: 'snow',
        emoji: '🌨️'
      };
    case 80:
      return {
        label: 'Slight Rain Showers',
        icon: 'rain',
        emoji: '🌦️'
      };
    case 81:
      return {
        label: 'Moderate Rain Showers',
        icon: 'rain',
        emoji: '🌧️'
      };
    case 82:
      return {
        label: 'Violent Rain Showers',
        icon: 'rain',
        emoji: '⛈️'
      };
    case 85:
      return {
        label: 'Slight Snow Showers',
        icon: 'snow',
        emoji: '🌨️'
      };
    case 86:
      return {
        label: 'Heavy Snow Showers',
        icon: 'snow',
        emoji: '❄️'
      };
    case 95:
      return {
        label: 'Thunderstorm',
        icon: 'thunderstorm',
        emoji: '⛈️'
      };
    case 96:
      return {
        label: 'Thunderstorm with Slight Hail',
        icon: 'thunderstorm',
        emoji: '⛈️'
      };
    case 99:
      return {
        label: 'Thunderstorm with Heavy Hail',
        icon: 'thunderstorm',
        emoji: '⛈️'
      };
    default:
      // Fallback for unexpected or new WMO codes
      return {
        label: `Atmospheric Condition (Code ${wmoCode})`,
        icon: 'default',
        emoji: '🌡️'
      };
  }
}

// ============================================================================
// 3. DOM ELEMENTS SELECTION
// ============================================================================

const DOM = {
  // Search Elements
  searchForm: document.getElementById('search-form'),
  cityInput: document.getElementById('city-input'),
  clearInputBtn: document.getElementById('clear-input-btn'),
  searchBtn: document.getElementById('search-btn'),
  quickPillsContainer: document.getElementById('quick-pills-container'),
  disambiguationCard: document.getElementById('disambiguation-card'),
  disambiguationList: document.getElementById('disambiguation-list'),
  disambiguationHeaderText: document.getElementById('disambiguation-header-text'),
  closeDisambiguationBtn: document.getElementById('close-disambiguation-btn'),

  // State Containers
  welcomeState: document.getElementById('welcome-state'),
  loadingState: document.getElementById('loading-state'),
  errorState: document.getElementById('error-state'),
  errorTitle: document.getElementById('error-title'),
  errorMessage: document.getElementById('error-message'),
  errorRetryBtn: document.getElementById('error-retry-btn'),

  // Main Weather Content Area
  weatherContent: document.getElementById('weather-content'),

  // Hero Card
  locationName: document.getElementById('location-name'),
  countryBadge: document.getElementById('country-badge'),
  locationSub: document.getElementById('location-sub'),
  refreshBtn: document.getElementById('refresh-btn'),
  refreshIcon: document.getElementById('refresh-icon'),
  weatherIconWrapper: document.getElementById('weather-icon-wrapper'),
  weatherCondition: document.getElementById('weather-condition'),
  dayNightIndicator: document.getElementById('day-night-indicator'),
  tempValue: document.getElementById('temp-value'),
  tempUnit: document.getElementById('temp-unit'),
  feelsLikeValue: document.getElementById('feels-like-value'),
  weatherTime: document.getElementById('weather-time'),
  timezoneBadge: document.getElementById('timezone-badge'),

  // Metrics Grid
  humidityValue: document.getElementById('humidity-value'),
  humidityStatus: document.getElementById('humidity-status'),
  windValue: document.getElementById('wind-value'),
  windUnit: document.getElementById('wind-unit'),
  windStatus: document.getElementById('wind-status'),
  metricFeelsValue: document.getElementById('metric-feels-value'),
  metricFeelsUnit: document.getElementById('metric-feels-unit'),
  feelsStatus: document.getElementById('feels-status'),
  precipValue: document.getElementById('precip-value'),
  precipStatus: document.getElementById('precip-status'),

  // Forecast Container
  forecastCardsContainer: document.getElementById('forecast-cards-container'),

  // Unit Controls
  unitBtnC: document.getElementById('unit-c'),
  unitBtnF: document.getElementById('unit-f')
};

// ============================================================================
// 4. UNIT CONVERSIONS & FORMATTING HELPERS
// ============================================================================

/**
 * Converts a temperature in Celsius to Fahrenheit if needed,
 * rounded to 1 decimal place.
 */
function formatTemperature(tempInC, unit) {
  if (tempInC === null || tempInC === undefined || isNaN(tempInC)) {
    return '--';
  }
  if (unit === 'f') {
    const tempInF = (tempInC * 9) / 5 + 32;
    return Math.round(tempInF * 10) / 10;
  }
  return Math.round(tempInC * 10) / 10;
}

/**
 * Returns qualitative descriptors for humidity levels.
 */
function getHumidityDescriptor(percentage) {
  if (percentage < 30) return 'Dry air, low humidity';
  if (percentage <= 60) return 'Comfortable humidity';
  if (percentage <= 80) return 'Moderately humid';
  return 'High humidity, muggy';
}

/**
 * Returns qualitative descriptors for wind speeds based on the Beaufort scale.
 */
function getWindDescriptor(speedKmH) {
  if (speedKmH < 2) return 'Calm conditions';
  if (speedKmH < 12) return 'Light air / gentle breeze';
  if (speedKmH < 29) return 'Moderate breeze';
  if (speedKmH < 50) return 'Strong / gusty breeze';
  return 'High wind alert';
}

/**
 * Formats a local ISO timestamp into a readable presentation string
 * e.g. "Tuesday, 08:30 PM"
 */
function formatLocalTime(isoString, timeZone) {
  try {
    // Open-Meteo returns time strings like "2026-10-20T20:00"
    const date = new Date(isoString);
    const options = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: timeZone || undefined
    };
    return new Intl.DateTimeFormat('en-US', options).format(date);
  } catch (err) {
    // Fallback if Intl fails or invalid timezone string
    return isoString.replace('T', ' ');
  }
}

/**
 * Formats daily date string ("2026-10-21") into day name ("Wed") and date ("Oct 21").
 */
function formatDailyDate(dateString) {
  try {
    // Append time to prevent UTC day shifting
    const date = new Date(dateString + 'T12:00:00');
    return {
      day: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date),
      formattedDate: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
    };
  } catch (err) {
    return { day: 'Day', formattedDate: dateString };
  }
}

// ============================================================================
// 5. VIEW & STATE TRANSITIONS
// ============================================================================

/**
 * Centralized function to manage switching between visual states:
 * 'welcome', 'loading', 'error', 'weather'
 */
function showViewState(state) {
  // Hide all primary state elements first
  DOM.welcomeState.hidden = true;
  DOM.loadingState.hidden = true;
  DOM.errorState.hidden = true;
  DOM.weatherContent.hidden = true;

  switch (state) {
    case 'loading':
      DOM.loadingState.hidden = false;
      break;
    case 'error':
      DOM.disambiguationCard.hidden = true;
      DOM.errorState.hidden = false;
      break;
    case 'weather':
      DOM.weatherContent.hidden = false;
      break;
    case 'welcome':
    default:
      DOM.disambiguationCard.hidden = true;
      DOM.welcomeState.hidden = false;
      break;
  }
}

/**
 * Displays an error state with customized title and message.
 */
function displayError(title, message) {
  DOM.errorTitle.textContent = title;
  DOM.errorMessage.textContent = message;
  showViewState('error');
}

// ============================================================================
// 6. API CLIENT FUNCTIONS (FETCH & ASYNC/AWAIT)
// ============================================================================

/**
 * Step 1: Query the Open-Meteo Geocoding API to find coordinates for a city.
 * Returns an array of matching locations.
 */
async function searchCityGeocoding(cityName) {
  const url = `${GEOCODING_API_URL}?name=${encodeURIComponent(cityName)}&count=5&language=en&format=json`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Geocoding server error (Status: ${response.status})`);
  }

  const data = await response.json();
  return data.results || [];
}

/**
 * Step 2: Query the Open-Meteo Forecast API using coordinates.
 * Fetches real-time current weather metrics and 7-day daily forecast.
 */
async function fetchWeatherData(latitude, longitude, timezone = 'auto') {
  const currentParams = [
    'temperature_2m',
    'relative_humidity_2m',
    'apparent_temperature',
    'is_day',
    'precipitation',
    'weather_code',
    'wind_speed_10m'
  ].join(',');

  const dailyParams = [
    'weather_code',
    'temperature_2m_max',
    'temperature_2m_min'
  ].join(',');

  const url = `${FORECAST_API_URL}?latitude=${latitude}&longitude=${longitude}&current=${currentParams}&daily=${dailyParams}&timezone=${encodeURIComponent(timezone)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather service responded with error (Status: ${response.status})`);
  }

  const data = await response.json();
  if (!data.current) {
    throw new Error('Weather data format unrecognized or missing current observations.');
  }

  return data;
}

// ============================================================================
// 7. RENDERING LOGIC (SAFE DOM UPDATES)
// ============================================================================

/**
 * Renders the weather dashboard using AppState.currentWeatherData and AppState.currentCity
 */
function renderWeatherDashboard() {
  const weather = AppState.currentWeatherData;
  const city = AppState.currentCity;
  const unit = AppState.currentUnit;

  if (!weather || !city) return;

  const current = weather.current;
  const conditionMeta = getWeatherConditionMeta(current.weather_code, current.is_day);

  // --- Location Header ---
  DOM.locationName.textContent = city.name;
  DOM.countryBadge.textContent = city.country || 'Global';

  // Construct detailed subtitle: Admin region + Formatted Coordinates
  const latStr = `${Math.abs(city.latitude).toFixed(2)}°${city.latitude >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(city.longitude).toFixed(2)}°${city.longitude >= 0 ? 'E' : 'W'}`;
  const regionParts = [];
  if (city.admin1 && city.admin1 !== city.name) {
    regionParts.push(city.admin1);
  }
  regionParts.push(`Coordinates: ${latStr}, ${lonStr}`);
  DOM.locationSub.textContent = regionParts.join(' • ');

  // --- Hero Weather Condition & Visuals ---
  DOM.weatherIconWrapper.innerHTML = getConditionSVG(conditionMeta.icon);
  DOM.weatherCondition.textContent = conditionMeta.label;
  DOM.dayNightIndicator.textContent = current.is_day === 1 ? '☀️ Daytime' : '🌙 Night time';

  // --- Temperatures ---
  const currentTemp = formatTemperature(current.temperature_2m, unit);
  const feelsLikeTemp = formatTemperature(current.apparent_temperature, unit);
  const unitLabel = unit === 'f' ? '°F' : '°C';

  DOM.tempValue.textContent = currentTemp;
  DOM.tempUnit.textContent = unitLabel;
  DOM.feelsLikeValue.textContent = `${feelsLikeTemp}${unitLabel}`;

  // --- Hero Footer & Timestamp ---
  const formattedTime = formatLocalTime(current.time, weather.timezone);
  DOM.weatherTime.textContent = formattedTime;
  DOM.timezoneBadge.textContent = `${weather.timezone} (${weather.timezone_abbreviation || 'GMT'})`;

  // --- Metrics Cards ---
  // 1. Humidity
  DOM.humidityValue.textContent = current.relative_humidity_2m;
  DOM.humidityStatus.textContent = getHumidityDescriptor(current.relative_humidity_2m);

  // 2. Wind Speed (km/h)
  DOM.windValue.textContent = current.wind_speed_10m;
  DOM.windUnit.textContent = 'km/h';
  DOM.windStatus.textContent = getWindDescriptor(current.wind_speed_10m);

  // 3. Apparent / Feels Like
  DOM.metricFeelsValue.textContent = feelsLikeTemp;
  DOM.metricFeelsUnit.textContent = unitLabel;
  const diff = current.apparent_temperature - current.temperature_2m;
  if (Math.abs(diff) < 0.8) {
    DOM.feelsStatus.textContent = 'Similar to actual temp';
  } else if (diff > 0) {
    DOM.feelsStatus.textContent = 'Warmer than actual';
  } else {
    DOM.feelsStatus.textContent = 'Cooler due to wind/chill';
  }

  // 4. Precipitation
  DOM.precipValue.textContent = current.precipitation;
  DOM.precipStatus.textContent = current.precipitation > 0 ? 'Active precipitation' : 'No rain detected';

  // --- 5-Day Forecast Rendering ---
  renderForecast(weather.daily, unit);

  // Switch view to weather content
  showViewState('weather');
}

/**
 * Renders the 5-day daily forecast cards.
 */
function renderForecast(daily, unit) {
  DOM.forecastCardsContainer.innerHTML = '';

  if (!daily || !daily.time || daily.time.length === 0) return;

  const unitLabel = unit === 'f' ? '°F' : '°C';
  // Render up to 5 days
  const daysToRender = Math.min(5, daily.time.length);

  for (let i = 0; i < daysToRender; i++) {
    const dateStr = daily.time[i];
    const { day, formattedDate } = formatDailyDate(dateStr);
    const code = daily.weather_code[i];
    const condition = getWeatherConditionMeta(code, 1);
    const maxTemp = formatTemperature(daily.temperature_2m_max[i], unit);
    const minTemp = formatTemperature(daily.temperature_2m_min[i], unit);
    const isToday = i === 0;

    const card = document.createElement('div');
    card.className = `forecast-card ${isToday ? 'today-card' : ''}`;

    card.innerHTML = `
      <span class="forecast-day">${isToday ? 'Today' : day}</span>
      <span class="forecast-date">${formattedDate}</span>
      <div class="forecast-icon" aria-label="${condition.label}">
        ${getConditionSVG(condition.icon)}
      </div>
      <span class="forecast-condition" title="${condition.label}">${condition.label}</span>
      <div class="forecast-temp-range">
        <span class="temp-max" title="Daily High">${maxTemp}${unitLabel}</span>
        <span class="temp-min" title="Daily Low">${minTemp}${unitLabel}</span>
      </div>
    `;

    DOM.forecastCardsContainer.appendChild(card);
  }
}

/**
 * Renders the disambiguation list when multiple city matches are returned.
 * Shows matching locations and highlights the currently active city.
 */
function renderDisambiguationList(locations, activeLocation) {
  DOM.disambiguationList.innerHTML = '';

  if (DOM.disambiguationHeaderText) {
    const activeName = activeLocation ? activeLocation.name : '';
    const activeCountry = activeLocation ? (activeLocation.country || activeLocation.country_code || '') : '';
    const query = (DOM.cityInput.value || '').trim();
    DOM.disambiguationHeaderText.textContent = `Multiple matches for "${query || activeName}". Showing ${activeName}${activeCountry ? ', ' + activeCountry : ''}. Select below to switch:`;
  }

  locations.forEach((loc) => {
    const li = document.createElement('li');
    const isCurrent = activeLocation && (
      (loc.id && activeLocation.id && loc.id === activeLocation.id) ||
      (loc.latitude === activeLocation.latitude && loc.longitude === activeLocation.longitude)
    );

    li.className = `disambiguation-item ${isCurrent ? 'active-location' : ''}`;
    li.tabIndex = 0;
    li.setAttribute('role', 'button');
    li.setAttribute('aria-label', `Select ${loc.name}, ${loc.admin1 || ''}, ${loc.country || ''}`);

    const leftCol = document.createElement('div');
    const cityName = document.createElement('div');
    cityName.className = 'disambiguation-city';
    cityName.textContent = loc.name;

    if (isCurrent) {
      const currentBadge = document.createElement('span');
      currentBadge.className = 'current-indicator-badge';
      currentBadge.textContent = 'Selected';
      cityName.appendChild(currentBadge);
    }

    const regionName = document.createElement('div');
    regionName.className = 'disambiguation-region';
    regionName.textContent = loc.admin1 ? `${loc.admin1}` : (loc.country || 'Location');

    leftCol.appendChild(cityName);
    leftCol.appendChild(regionName);

    const countryBadge = document.createElement('span');
    countryBadge.className = 'disambiguation-country';
    countryBadge.textContent = loc.country || loc.country_code || 'Global';

    li.appendChild(leftCol);
    li.appendChild(countryBadge);

    // Event handler to select this specific location
    const selectLocation = () => {
      renderDisambiguationList(locations, loc);
      loadWeatherForLocation(loc);
      saveRecentSearch(loc.name);
    };

    li.addEventListener('click', selectLocation);
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectLocation();
      }
    });

    DOM.disambiguationList.appendChild(li);
  });

  DOM.disambiguationCard.hidden = false;
}

// ============================================================================
// 8. CONTROLLER & SEARCH WORKFLOW
// ============================================================================

/**
 * Master function to execute a city search.
 * Validates input, coordinates geocoding and forecast fetching.
 */
async function handleSearch(query) {
  const trimmed = (query || '').trim();

  // Empty input validation
  if (!trimmed) {
    displayError('Empty Search', 'Please enter a city or location name to search for weather.');
    DOM.cityInput.focus();
    return;
  }

  // Prevent race conditions with an incrementing requestId token
  const currentRequestId = ++AppState.activeRequestId;

  // Reset any previous disambiguation list
  DOM.disambiguationCard.hidden = true;
  showViewState('loading');

  try {
    // 1. Geocoding
    const locations = await searchCityGeocoding(trimmed);

    // Check if another search was triggered while waiting for this network response
    if (currentRequestId !== AppState.activeRequestId) {
      return; // Stale request, ignore result
    }

    // No matching cities found
    if (!locations || locations.length === 0) {
      displayError(
        'Location Not Found',
        `We could not find any geographical locations matching "${trimmed}". Please verify the spelling and try again.`
      );
      return;
    }

    // If multiple distinct locations exist, display the disambiguation switcher
    if (locations.length > 1) {
      renderDisambiguationList(locations, locations[0]);
    } else {
      DOM.disambiguationCard.hidden = true;
    }

    // Automatically load weather for the top/first match
    await loadWeatherForLocation(locations[0], currentRequestId);
    
    // Save to search history
    saveRecentSearch(locations[0].name);

  } catch (error) {
    if (currentRequestId !== AppState.activeRequestId) return;

    console.error('WeatherNow Search Error:', error);

    // Check network connectivity
    if (!navigator.onLine) {
      displayError('No Internet Connection', 'You appear to be offline. Please check your internet connection.');
    } else {
      displayError(
        'Unable to Fetch Weather',
        error.message || 'An unexpected error occurred while communicating with the weather services. Please try again.'
      );
    }
  }
}

/**
 * Loads weather data for a specific location object.
 */
async function loadWeatherForLocation(location, requestId) {
  const currentRequestId = requestId || ++AppState.activeRequestId;

  showViewState('loading');

  try {
    const weatherData = await fetchWeatherData(
      location.latitude,
      location.longitude,
      location.timezone || 'auto'
    );

    if (currentRequestId !== AppState.activeRequestId) return;

    AppState.currentCity = location;
    AppState.currentWeatherData = weatherData;

    renderWeatherDashboard();
  } catch (error) {
    if (currentRequestId !== AppState.activeRequestId) return;

    console.error('Weather Data Fetch Error:', error);
    displayError(
      'Forecast Data Unavailable',
      `Failed to retrieve current atmospheric conditions for ${location.name}. Please try again shortly.`
    );
  }
}

/**
 * Refreshes weather data for the currently selected city.
 */
async function refreshCurrentWeather() {
  if (!AppState.currentCity) return;

  DOM.refreshBtn.classList.add('spinning');
  try {
    await loadWeatherForLocation(AppState.currentCity);
  } finally {
    setTimeout(() => {
      DOM.refreshBtn.classList.remove('spinning');
    }, 600);
  }
}

// ============================================================================
// 9. LOCAL STORAGE & RECENT SEARCHES
// ============================================================================

/**
 * Saves a city name to localStorage (keeps last 5 unique cities)
 */
function saveRecentSearch(cityName) {
  try {
    let recent = JSON.parse(localStorage.getItem(AppState.recentSearchesKey)) || [];
    // Remove if already exists to move it to the front
    recent = recent.filter((name) => name.toLowerCase() !== cityName.toLowerCase());
    recent.unshift(cityName);
    // Keep top 5
    if (recent.length > 5) recent = recent.slice(0, 5);

    localStorage.setItem(AppState.recentSearchesKey, JSON.stringify(recent));
    renderRecentPills();
  } catch (e) {
    // Graceful fallback if localStorage is disabled or restricted
    console.warn('localStorage is not available:', e);
  }
}

/**
 * Renders the quick pills using saved recent cities (or defaults if empty)
 */
function renderRecentPills() {
  let cities = ['Delhi', 'Mumbai', 'London', 'Tokyo', 'New York'];

  try {
    const stored = JSON.parse(localStorage.getItem(AppState.recentSearchesKey));
    if (stored && Array.isArray(stored) && stored.length > 0) {
      cities = stored;
    }
  } catch (e) {
    // Use fallback
  }

  DOM.quickPillsContainer.innerHTML = '';
  cities.forEach((city) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'quick-pill';
    btn.setAttribute('data-city', city);
    btn.textContent = city;
    btn.addEventListener('click', () => {
      DOM.cityInput.value = city;
      DOM.clearInputBtn.hidden = false;
      handleSearch(city);
    });
    DOM.quickPillsContainer.appendChild(btn);
  });
}

// ============================================================================
// 10. TEMPERATURE UNIT TOGGLE
// ============================================================================

function setTemperatureUnit(unit) {
  if (AppState.currentUnit === unit) return;

  AppState.currentUnit = unit;

  if (unit === 'c') {
    DOM.unitBtnC.classList.add('active');
    DOM.unitBtnC.setAttribute('aria-checked', 'true');
    DOM.unitBtnF.classList.remove('active');
    DOM.unitBtnF.setAttribute('aria-checked', 'false');
  } else {
    DOM.unitBtnF.classList.add('active');
    DOM.unitBtnF.setAttribute('aria-checked', 'true');
    DOM.unitBtnC.classList.remove('active');
    DOM.unitBtnC.setAttribute('aria-checked', 'false');
  }

  // Re-render dashboard with new units instantly without refetching from network!
  if (AppState.currentWeatherData && AppState.currentCity) {
    renderWeatherDashboard();
  }
}

// ============================================================================
// 11. EVENT LISTENERS INITIALIZATION
// ============================================================================

function initEventListeners() {
  // Search Form Submission (Handles both button click and Enter key press)
  DOM.searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSearch(DOM.cityInput.value);
  });

  // Input Clear Button visibility toggle
  DOM.cityInput.addEventListener('input', () => {
    DOM.clearInputBtn.hidden = DOM.cityInput.value.length === 0;
  });

  // Clear Button Click
  DOM.clearInputBtn.addEventListener('click', () => {
    DOM.cityInput.value = '';
    DOM.clearInputBtn.hidden = true;
    DOM.cityInput.focus();
  });

  // Retry Button in Error State
  DOM.errorRetryBtn.addEventListener('click', () => {
    DOM.cityInput.value = '';
    DOM.cityInput.focus();
    showViewState('welcome');
  });

  // Refresh Weather Button
  DOM.refreshBtn.addEventListener('click', refreshCurrentWeather);

  // Unit Toggle Buttons
  DOM.unitBtnC.addEventListener('click', () => setTemperatureUnit('c'));
  DOM.unitBtnF.addEventListener('click', () => setTemperatureUnit('f'));

  // Close Disambiguation Card
  if (DOM.closeDisambiguationBtn) {
    DOM.closeDisambiguationBtn.addEventListener('click', () => {
      DOM.disambiguationCard.hidden = true;
    });
  }
}

// ============================================================================
// 12. APP BOOTSTRAP
// ============================================================================

function initApp() {
  initEventListeners();
  renderRecentPills();
  showViewState('welcome');

  // Focus input on initial page load for fast user experience
  DOM.cityInput.focus();
}

// Start application when DOM is fully parsed
document.addEventListener('DOMContentLoaded', initApp);
