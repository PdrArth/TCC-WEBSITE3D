/** Scenic fronts follow calm -> rain -> storm -> clearing; no live forecast. */
const transitions = {
  clear: [["dusk", .56], ["rain", .44]],
  dusk: [["clear", .78], ["rain", .22]],
  rain: [["clear", .46], ["storm", .42], ["dusk", .12]],
  storm: [["rain", .9], ["clear", .1]],
};

const durationRanges = {
  clear: [45_000, 80_000],
  rain: [40_000, 65_000],
  storm: [35_000, 50_000],
  dusk: [45_000, 75_000],
};

// Inland Southeast: a dry winter and a wetter summer. These probabilities are
// art direction for a brief session, not measured climatological percentages.
const seasonalStarts = {
  spring: [["clear", .59], ["dusk", .24], ["rain", .17]],
  summer: [["clear", .46], ["dusk", .20], ["rain", .34]],
  autumn: [["clear", .65], ["dusk", .25], ["rain", .10]],
  winter: [["clear", .77], ["dusk", .20], ["rain", .03]],
};
const seasonalRain = { spring: .39, summer: .64, autumn: .23, winter: .08 };

function draw(random) {
  const value = random();
  return Number.isFinite(value) ? Math.min(.999999999, Math.max(0, value)) : .5;
}

function choose(choices, random) {
  let remaining = draw(random);
  for (const [weather, weight] of choices) {
    remaining -= weight;
    if (remaining < 0) return weather;
  }
  return choices.at(-1)[0];
}

/** Open on a calm or rainy sky; severe events need a visible weather front first. */
export function initialWeather(random = Math.random, season = "spring") {
  return choose(seasonalStarts[season] ?? seasonalStarts.spring, random);
}

export function nextWeather(current, random = Math.random, season = "spring") {
  if (current === "clear") {
    const rain = seasonalRain[season] ?? seasonalRain.spring;
    return choose([["dusk", 1 - rain], ["rain", rain]], random);
  }
  return choose(transitions[current] ?? transitions.clear, random);
}

export function weatherDuration(weather, random = Math.random) {
  const [minimum, maximum] = durationRanges[weather] ?? durationRanges.clear;
  return Math.round(minimum + (maximum - minimum) * draw(random));
}

export const weatherKinds = ["clear", "partly-cloudy", "overcast", "fog", "drizzle", "rain", "freezing-rain", "snow", "storm", "hail", "dusk"];
export const weatherNames = { clear: "Céu limpo", "partly-cloudy": "Entre nuvens", overcast: "Nublado", fog: "Neblina", drizzle: "Garoa", rain: "Chuva", "freezing-rain": "Chuva congelante", snow: "Neve", storm: "Tempestade", hail: "Granizo", dusk: "Entardecer" };
export function weatherFromCode(code) {
  if (code === 0) return "clear";
  if (code === 1 || code === 2) return "partly-cloudy";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "fog";
  if ([51, 53, 55].includes(code)) return "drizzle";
  if ([56, 57, 66, 67].includes(code)) return "freezing-rain";
  if ([61, 63, 65, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if (code === 95) return "storm";
  if (code === 96 || code === 99) return "hail";
  return null;
}
export function roundCoordinates(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error("Localização inválida");
  return { latitude: Math.round(latitude * 10) / 10, longitude: Math.round(longitude * 10) / 10 };
}
export function forecastUrl(input) {
  const coordinates = roundCoordinates(input.latitude, input.longitude);
  const query = new URLSearchParams({ latitude: String(coordinates.latitude), longitude: String(coordinates.longitude), timezone: "auto", forecast_days: "1", current: "temperature_2m,is_day,precipitation,snowfall,weather_code,cloud_cover,wind_speed_10m", daily: "sunrise,sunset" });
  return `https://api.open-meteo.com/v1/forecast?${query}`;
}
// All timestamps are provider-local wall-clock ISO values: never compare them
// against the execution host's timezone.
export function weatherPhase(time, sunrise, sunset, isDay = true) {
  const stamp = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) ? Date.parse(value.slice(0, 19) + "Z") : NaN;
  const now = stamp(time), rise = stamp(sunrise), set = stamp(sunset);
  if (Number.isFinite(now) && Number.isFinite(rise) && Math.abs(now - rise) <= 30 * 60_000) return "dawn";
  if (Number.isFinite(now) && Number.isFinite(set) && Math.abs(now - set) <= 30 * 60_000) return "dusk";
  return isDay ? "day" : "night";
}
export function seasonAtLocation(time, latitude = -20) {
  const month = typeof time === "string" ? Number(time.slice(5, 7)) - 1 : new Date().getMonth();
  if (!Number.isInteger(month) || month < 0 || month > 11) return "spring";
  const south = month === 11 || month < 2 ? "summer" : month < 5 ? "autumn" : month < 8 ? "winter" : "spring";
  return latitude < 0 ? south : ({ summer: "winter", autumn: "spring", winter: "summer", spring: "autumn" })[south];
}
export function normalizeForecast(data, coordinates, fetchedAt = new Date().toISOString()) {
  const current = data?.current;
  const weather = weatherFromCode(current?.weather_code);
  if (!weather || typeof current?.time !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(current.time) || !Number.isFinite(current?.temperature_2m) || ![0, 1].includes(current?.is_day)) throw new Error("Dados meteorológicos indisponíveis");
  const finite = (value, minimum = 0, maximum = 200) => Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : 0;
  return {
    weather, code: current.weather_code, phase: weatherPhase(current.time, data.daily?.sunrise?.[0], data.daily?.sunset?.[0], current.is_day === 1),
    temperature: finite(current.temperature_2m, -100, 70), windSpeed: finite(current.wind_speed_10m), precipitation: finite(current.precipitation), snowfall: finite(current.snowfall),
    cloudCover: finite(current.cloud_cover, 0, 100), season: seasonAtLocation(current.time, coordinates.latitude),
    observedAt: current.time, fetchedAt, timezone: typeof data.timezone === "string" ? data.timezone : "UTC",
    source: "Open-Meteo", sourceUrl: "https://open-meteo.com/", approximate: true, stale: false,
  };
}
