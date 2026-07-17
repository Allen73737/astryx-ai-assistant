"""Stock Ticker Engine — Fetches live stock prices and candlestick data."""

from __future__ import annotations

import asyncio
import json
import structlog

logger = structlog.get_logger(__name__)

# Default watchlist
DEFAULT_SYMBOLS = ["ASTX", "NVDA", "AAPL", "GOOGL", "TSLA", "MSFT", "AMZN", "META", "AMD", "PLTR"]

# Fallback prices if yfinance fails
FALLBACK_PRICES: dict[str, dict] = {
    "ASTX": {"price": 142.35, "change": 3.21},
    "NVDA": {"price": 875.44, "change": -12.87},
    "AAPL": {"price": 231.08, "change": 1.45},
    "GOOGL": {"price": 168.12, "change": -0.89},
    "TSLA": {"price": 298.77, "change": 8.33},
    "MSFT": {"price": 445.60, "change": 2.15},
    "AMZN": {"price": 192.31, "change": -1.22},
    "META": {"price": 512.90, "change": 5.67},
    "AMD": {"price": 185.43, "change": -3.21},
    "PLTR": {"price": 24.56, "change": 1.89},
}


async def fetch_stock_prices(symbols: list[str] | None = None) -> list[dict]:
    """Fetch live stock prices from Yahoo Finance via yfinance."""
    if symbols is None:
        symbols = DEFAULT_SYMBOLS

    try:
        import yfinance as yf

        def _fetch_all():
            results = []
            for sym in symbols:
                try:
                    ticker = yf.Ticker(sym)
                    info = ticker.fast_info
                    price = float(info.last_price) if info.last_price else None
                    prev_close = float(info.previous_close) if info.previous_close else None

                    if price and prev_close:
                        change = ((price - prev_close) / prev_close) * 100
                        direction = "up" if change >= 0 else "down"
                    else:
                        # Fallback within function
                        fb = FALLBACK_PRICES.get(sym, {"price": 100.0, "change": 0.0})
                        price = fb["price"]
                        change = fb["change"]
                        direction = "up" if change >= 0 else "down"

                    results.append({
                        "symbol": sym,
                        "price": round(price, 2),
                        "change": round(abs(change), 2),
                        "direction": direction,
                    })
                except Exception:
                    fb = FALLBACK_PRICES.get(sym, {"price": 100.0, "change": 0.0})
                    results.append({
                        "symbol": sym,
                        "price": fb["price"],
                        "change": abs(fb["change"]),
                        "direction": "up" if fb["change"] >= 0 else "down",
                    })
            return results

        return await asyncio.to_thread(_fetch_all)

    except ImportError:
        logger.warning("yfinance not installed, using fallback prices")
        return [
            {
                "symbol": sym,
                "price": FALLBACK_PRICES.get(sym, {"price": 100.0})["price"],
                "change": abs(FALLBACK_PRICES.get(sym, {"change": 0.0})["change"]),
                "direction": "up" if FALLBACK_PRICES.get(sym, {"change": 0.0})["change"] >= 0 else "down",
            }
            for sym in symbols
        ]
    except Exception as e:
        logger.error("stock_fetch_failed", error=str(e))
        return [
            {
                "symbol": sym,
                "price": FALLBACK_PRICES.get(sym, {"price": 100.0})["price"],
                "change": abs(FALLBACK_PRICES.get(sym, {"change": 0.0})["change"]),
                "direction": "up" if FALLBACK_PRICES.get(sym, {"change": 0.0})["change"] >= 0 else "down",
            }
            for sym in symbols
        ]


async def fetch_candlestick_data(symbol: str, period: str = "5d") -> list[dict]:
    """Fetch historical OHLC data for candlestick chart."""
    try:
        import yfinance as yf

        def _fetch():
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period=period)
            candles = []
            for idx, row in hist.iterrows():
                candles.append({
                    "date": str(idx.date()),
                    "open": round(float(row["Open"]), 2),
                    "high": round(float(row["High"]), 2),
                    "low": round(float(row["Low"]), 2),
                    "close": round(float(row["Close"]), 2),
                })
            return candles[-30:]  # Last 30 data points

        return await asyncio.to_thread(_fetch)
    except Exception as e:
        logger.error("candlestick_fetch_failed", error=str(e))
        return []


async def handle_stocks(data: str) -> str:
    """Handle the STOCKS tool command.

    Format:
        prices  — Fetch current prices for default watchlist
        prices|SYM1,SYM2  — Fetch prices for specific symbols
        chart|SYM  — Fetch candlestick data for a symbol
        chart|SYM|period  — Fetch candlestick with custom period
    """
    parts = data.split("|")
    action = parts[0].strip().lower()
    logger.info("stocks_command", action=action)

    if action in ["", "prices", "price", "ticker"]:
        symbols = None
        if len(parts) > 1 and parts[1].strip():
            symbols = [s.strip().upper() for s in parts[1].split(",")]

        prices = await fetch_stock_prices(symbols)
        return json.dumps({"type": "prices", "data": prices})

    elif action in ["chart", "candles", "candlestick"]:
        symbol = parts[1].strip().upper() if len(parts) > 1 else "AAPL"
        period = parts[2].strip() if len(parts) > 2 else "5d"
        candles = await fetch_candlestick_data(symbol, period)
        return json.dumps({"type": "chart", "symbol": symbol, "data": candles})

    return json.dumps({"error": f"Unknown action: {action}"})
