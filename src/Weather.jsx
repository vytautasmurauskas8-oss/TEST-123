import { useEffect, useState } from "react";
import "./Weather.css";

const CAPITALS = [
  { name: "Vilnius", country: "Lietuva", latitude: 54.6872, longitude: 25.2797 },
  { name: "Ryga", country: "Latvija", latitude: 56.9496, longitude: 24.1052 },
  { name: "Talinas", country: "Estija", latitude: 59.437, longitude: 24.7536 },
  { name: "Varšuva", country: "Lenkija", latitude: 52.2297, longitude: 21.0122 },
  { name: "Helsinkis", country: "Suomija", latitude: 60.1699, longitude: 24.9384 },
  { name: "Stokholmas", country: "Švedija", latitude: 59.3293, longitude: 18.0686 },
  { name: "Oslas", country: "Norvegija", latitude: 59.9139, longitude: 10.7522 },
  { name: "Kopenhaga", country: "Danija", latitude: 55.6761, longitude: 12.5683 },
  { name: "Berlynas", country: "Vokietija", latitude: 52.52, longitude: 13.405 },
  { name: "Praha", country: "Čekija", latitude: 50.0755, longitude: 14.4378 },
  { name: "Viena", country: "Austrija", latitude: 48.2082, longitude: 16.3738 },
  { name: "Londonas", country: "Jungtinė Karalystė", latitude: 51.5072, longitude: -0.1276 },
  { name: "Paryžius", country: "Prancūzija", latitude: 48.8566, longitude: 2.3522 },
  { name: "Roma", country: "Italija", latitude: 41.9028, longitude: 12.4964 },
  { name: "Madridas", country: "Ispanija", latitude: 40.4168, longitude: -3.7038 },
  { name: "Lisabona", country: "Portugalija", latitude: 38.7223, longitude: -9.1393 },
  { name: "Atėnai", country: "Graikija", latitude: 37.9838, longitude: 23.7275 },
  { name: "Kyjivas", country: "Ukraina", latitude: 50.4501, longitude: 30.5234 },
];

function describeWeather(code) {
  if (code === 0) return "Giedra";
  if ([1, 2].includes(code)) return "Mažai debesuota";
  if (code === 3) return "Debesuota";
  if ([45, 48].includes(code)) return "Rūkas";
  if ([51, 53, 55, 56, 57].includes(code)) return "Dulksna";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Lietus";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Sniegas";
  if ([95, 96, 99].includes(code)) return "Perkūnija";
  return "Oro sąlygos nežinomos";
}

function Weather() {
  const [selectedCityName, setSelectedCityName] = useState("Vilnius");
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const selectedCity = CAPITALS.find((city) => city.name === selectedCityName) || CAPITALS[0];

  useEffect(() => {
    let isActive = true;

    async function loadForecast() {
      const parameters = new URLSearchParams({
        latitude: String(selectedCity.latitude),
        longitude: String(selectedCity.longitude),
        current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m",
        daily: "weather_code,temperature_2m_max,temperature_2m_min",
        forecast_days: "3",
        timezone: "auto",
      });

      try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${parameters}`);
        if (!response.ok) throw new Error(`Nepavyko gauti orų prognozės (${response.status}).`);
        const data = await response.json();
        if (isActive) {
          setWeather(data);
          setError("");
        }
      } catch (loadError) {
        if (isActive) setError(loadError.message || "Nepavyko įkelti orų prognozės.");
      } finally {
        if (isActive) setLoading(false);
      }
    }

    loadForecast();
    return () => { isActive = false; };
  }, [selectedCity]);

  function handleCityChange(event) {
    setWeather(null);
    setLoading(true);
    setError("");
    setSelectedCityName(event.target.value);
  }

  return (
    <main className="weather-page">
      <header className="weather-page__header">
        <p className="weather-page__eyebrow">EUROPA</p>
        <h1>Sostinių orai</h1>
        <p>Pasirinkite miestą ir peržiūrėkite jo prognozę</p>
      </header>

      <section className="weather-panel" aria-label="Pasirinktos sostinės orai">
        <label className="weather-city-select">
          <span>Pasirinkite sostinę</span>
          <select value={selectedCityName} onChange={handleCityChange}>
            {CAPITALS.map((city) => <option value={city.name} key={city.name}>{city.name} — {city.country}</option>)}
          </select>
        </label>

        {loading && <p className="weather-message">Kraunama orų prognozė...</p>}
        {error && <p className="weather-message weather-message--error" role="alert">{error}</p>}
        {!loading && !error && weather && (
          <article className="weather-card">
            <div className="weather-card__heading">
              <div><h2>{selectedCity.name}</h2><p>{selectedCity.country}</p></div>
              <span className="weather-card__icon" aria-hidden="true">{weather.current.weather_code === 0 ? "☀" : weather.current.weather_code >= 70 ? "❄" : "☁"}</span>
            </div>
            <p className="weather-card__temperature">{Math.round(weather.current.temperature_2m)}°</p>
            <p className="weather-card__condition">{describeWeather(weather.current.weather_code)}</p>
            <p className="weather-card__details">Jaučiama {Math.round(weather.current.apparent_temperature)}° · Drėgmė {weather.current.relative_humidity_2m}% · Vėjas {Math.round(weather.current.wind_speed_10m)} km/val.</p>
            <div className="weather-card__forecast">
              {weather.daily.time.map((day, index) => (
                <div className="weather-card__day" key={day}>
                  <span>{index === 0 ? "Šiandien" : new Date(`${day}T12:00:00`).toLocaleDateString("lt-LT", { weekday: "long" })}</span>
                  <span>{describeWeather(weather.daily.weather_code[index])}</span>
                  <strong>{Math.round(weather.daily.temperature_2m_max[index])}° / {Math.round(weather.daily.temperature_2m_min[index])}°</strong>
                </div>
              ))}
            </div>
          </article>
        )}
      </section>
      <p className="weather-attribution">Orų duomenys: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a></p>
    </main>
  );
}

export default Weather;
