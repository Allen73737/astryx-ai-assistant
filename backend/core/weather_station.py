"""Weather Station Engine — Fetches live weather data from Open-Meteo API with IP geolocation."""

from __future__ import annotations

import asyncio
import json
import structlog
import urllib.request
import urllib.parse

logger = structlog.get_logger(__name__)


async def get_location() -> dict[str, float | str]:
    """Get approximate lat/lon + city from IP geolocation (free, no API key)."""
    try:
        def _fetch():
            req = urllib.request.Request(
                "https://ipapi.co/json/",
                headers={"User-Agent": "Mozilla/5.0"},
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                return json.loads(resp.read().decode())

        data = await asyncio.to_thread(_fetch)
        return {
            "lat": data.get("latitude", 51.5),
            "lon": data.get("longitude", -0.13),
            "city": data.get("city", "Unknown"),
            "country": data.get("country_name", "Unknown"),
        }
    except Exception as e:
        logger.warning("ip_geolocation_failed", error=str(e))
        # Fallback to IP-api.com (free, no key)
        try:
            def _fallback():
                req = urllib.request.Request(
                    "http://ip-api.com/json/",
                    headers={"User-Agent": "Mozilla/5.0"},
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    return json.loads(resp.read().decode())
            data = await asyncio.to_thread(_fallback)
            return {
                "lat": data.get("lat", 51.5),
                "lon": data.get("lon", -0.13),
                "city": data.get("city", "Unknown"),
                "country": data.get("country", "Unknown"),
            }
        except Exception as e2:
            logger.error("fallback_geolocation_failed", error=str(e2))
            return {"lat": 51.5, "lon": -0.13, "city": "London", "country": "UK"}


async def fetch_weather(lat: float, lon: float) -> dict | None:
    """Fetch live weather from Open-Meteo API (free, no key required)."""
    try:
        params = urllib.parse.urlencode({
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure",
            "daily": "temperature_2m_max,temperature_2m_min,weather_code,wind_speed_10m_max",
            "wind_speed_unit": "kmh",
            "timezone": "auto",
        })
        url = f"https://api.open-meteo.com/v1/forecast?{params}"

        def _fetch():
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=8) as resp:
                return json.loads(resp.read().decode())

        data = await asyncio.to_thread(_fetch)
        return data
    except Exception as e:
        logger.error("weather_fetch_failed", error=str(e))
        return None


def weather_code_to_emoji(code: int) -> str:
    """Convert WMO weather codes to emoji."""
    if code == 0:
        return "☀️"
    if code <= 3:
        return "⛅"
    if code <= 48:
        return "🌫️"
    if code <= 57:
        return "🌧️"
    if code <= 67:
        return "🌧️"
    if code <= 77:
        return "❄️"
    if code <= 82:
        return "🌧️"
    if code <= 86:
        return "❄️"
    return "🌧️"


async def handle_weather_lab(data: str) -> str:
    """Handle the WEATHERLAB tool command.

    Format:
        fetch  — Fetches live weather data
        forecast  — Fetches 7-day forecast
    """
    action = data.strip().lower()
    logger.info("weather_lab_command", action=action)

    location = await get_location()
    lat = location["lat"]
    lon = location["lon"]
    city = location["city"]
    country = location["country"]

    weather_data = await fetch_weather(lat, lon)
    if not weather_data:
        return json.dumps({
            "error": "Could not fetch weather data. Check internet connection.",
            "city": city,
            "country": country,
        })

    current = weather_data.get("current", {})
    daily = weather_data.get("daily", {})

    if action in ["", "fetch", "current"]:
        temp = current.get("temperature_2m", "N/A")
        feels_like = current.get("apparent_temperature", "N/A")
        humidity = current.get("relative_humidity_2m", "N/A")
        wind_speed = current.get("wind_speed_10m", "N/A")
        wind_dir = current.get("wind_direction_10m", "N/A")
        pressure = current.get("surface_pressure", "N/A")
        weather_code = current.get("weather_code", 0)
        emoji = weather_code_to_emoji(weather_code)

        return json.dumps({
            "type": "current",
            "city": city,
            "country": country,
            "lat": lat,
            "lon": lon,
            "temperature": temp,
            "feels_like": feels_like,
            "humidity": humidity,
            "wind_speed": wind_speed,
            "wind_direction": wind_dir,
            "pressure": pressure,
            "weather_code": weather_code,
            "emoji": emoji,
        })

    elif action in ["forecast", "daily"]:
        forecast_days = []
        if daily:
            times = daily.get("time", [])
            temps_max = daily.get("temperature_2m_max", [])
            temps_min = daily.get("temperature_2m_min", [])
            weather_codes = daily.get("weather_code", [])
            wind_speeds = daily.get("wind_speed_10m_max", [])

            for i in range(min(len(times), 7)):
                forecast_days.append({
                    "day": times[i] if i < len(times) else "N/A",
                    "temp_max": temps_max[i] if i < len(temps_max) else "N/A",
                    "temp_min": temps_min[i] if i < len(temps_min) else "N/A",
                    "weather_code": weather_codes[i] if i < len(weather_codes) else 0,
                    "emoji": weather_code_to_emoji(weather_codes[i]) if i < len(weather_codes) else "☀️",
                    "wind_speed": wind_speeds[i] if i < len(wind_speeds) else "N/A",
                })

        return json.dumps({
            "type": "forecast",
            "city": city,
            "country": country,
            "days": forecast_days,
        })

    return json.dumps({"error": f"Unknown action: {action}"})
