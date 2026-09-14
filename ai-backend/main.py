from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import requests
import config

app = FastAPI(title="TradeVault SMC Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FCS_API_KEY = config.FCS_API_KEY
FCS_BASE_URL = "https://api-v4.fcsapi.com"

FCS_SYMBOLS = {
    "EUR/USD": "EURUSD",
    "GBP/USD": "GBPUSD",
    "USD/JPY": "USDJPY",
    "XAU/USD": "XAUUSD",
    "XAG/USD": "XAGUSD",
    "GBP/JPY": "GBPJPY",
    "BTC/USD": "BINANCE:BTCUSDT",
    "ETH/USD": "BINANCE:ETHUSDT",
}

FCS_TIMEFRAME_MAP = {
    "1m": "1m",
    "5m": "5m",
    "15m": "15m",
    "30m": "30m",
    "1H": "1h",
    "4H": "4h",
    "1D": "1d",
    "1W": "1w",
}


class PriceRequest(BaseModel):
    pair: str


class SMCRequest(BaseModel):
    pair: str
    timeframe: str = "1H"
    limit: int = 200


# ===== FCS API =====

def get_fcs_price(pair: str) -> dict:
    symbol = FCS_SYMBOLS.get(pair)
    if not symbol:
        raise Exception(f"Unsupported pair: {pair}")
    endpoint = f"{FCS_BASE_URL}/crypto/latest" if pair.startswith(("BTC", "ETH")) else f"{FCS_BASE_URL}/forex/latest"
    params = {"symbol": symbol, "access_key": FCS_API_KEY}
    response = requests.get(endpoint, params=params, timeout=10)
    response.raise_for_status()
    data = response.json()
    if not data.get("status"):
        raise Exception(f"FCS API error: {data.get('msg', 'Unknown')}")
    item = data["response"][0] if isinstance(data["response"], list) else data["response"]
    active = item.get("active", item)
    ask = float(active.get("a", 0))
    bid = float(active.get("b", 0))
    price = (ask + bid) / 2 if ask and bid else (ask or bid)
    return {"pair": pair, "price": price, "ask": ask, "bid": bid, "source": "fcs_api"}


def get_fcs_candles(pair: str, timeframe: str, limit: int = 200) -> dict:
    """Fetch full OHLC candles from FCS API using /forex/history."""
    symbol = FCS_SYMBOLS.get(pair)
    if not symbol:
        raise Exception(f"Unsupported pair: {pair}")

    period = FCS_TIMEFRAME_MAP.get(timeframe, "1h")

    endpoint = f"{FCS_BASE_URL}/forex/history"
    params = {
        "symbol": symbol,
        "period": period,
        "access_key": FCS_API_KEY,
    }

    response = requests.get(endpoint, params=params, timeout=20)
    response.raise_for_status()
    data = response.json()

    if not data.get("status"):
        raise Exception(f"FCS API error: {data.get('msg', 'Unknown')}")

    raw = data.get("response", {})

    # FCS returns an object keyed by timestamp — convert to sorted array
    candles = []

    if isinstance(raw, dict):
        # Sort by timestamp key ascending (oldest first)
        sorted_keys = sorted(raw.keys(), key=lambda k: int(k) if k.isdigit() else 0)
        for key in sorted_keys:
            c = raw[key]
            try:
                o = float(c.get("o", 0))
                h = float(c.get("h", 0))
                l = float(c.get("l", 0))
                cl = float(c.get("c", 0))
                if o <= 0 or h <= 0 or l <= 0 or cl <= 0:
                    continue
                candles.append({
                    "open": o,
                    "high": h,
                    "low": l,
                    "close": cl,
                    "is_green": cl >= o,
                })
            except (ValueError, TypeError):
                continue

    elif isinstance(raw, list):
        # Fallback: already an array
        for c in raw:
            try:
                o = float(c.get("o", 0))
                h = float(c.get("h", 0))
                l = float(c.get("l", 0))
                cl = float(c.get("c", 0))
                if o <= 0 or h <= 0 or l <= 0 or cl <= 0:
                    continue
                candles.append({
                    "open": o,
                    "high": h,
                    "low": l,
                    "close": cl,
                    "is_green": cl >= o,
                })
            except (ValueError, TypeError):
                continue

    # Take last N (most recent)
    if len(candles) > limit:
        candles = candles[-limit:]

    if not candles:
        raise Exception(f"No candles returned for {pair} {timeframe}")

    return {
        "pair": pair,
        "timeframe": timeframe,
        "candles": candles,
        "count": len(candles),
        "source": "fcs_api",
    }


# ===== ENDPOINTS =====

@app.get("/")
def root():
    return {"service": "TradeVault SMC", "status": "running"}


@app.get("/health")
def health():
    return {"status": "healthy", "fcs_api_configured": bool(FCS_API_KEY)}


@app.post("/api/get-price")
async def get_price(request: PriceRequest):
    try:
        return get_fcs_price(request.pair)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/smc-candles")
async def smc_candles(request: SMCRequest):
    """Fetch OHLC candles for pair + timeframe. Frontend runs SMC analysis."""
    try:
        return get_fcs_candles(request.pair, request.timeframe, request.limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))