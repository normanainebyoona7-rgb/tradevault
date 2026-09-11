from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import cv2
import numpy as np
import pytesseract
from PIL import Image
import io
import re
import requests
import config

app = FastAPI(title="TradeVault AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FCS_API_KEY = config.FCS_API_KEY
FCS_BASE_URL = "https://api-v4.fcsapi.com"

# Symbol mapping: our format -> FCS API format
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


class PriceRequest(BaseModel):
    pair: str


def get_fcs_price(pair: str) -> dict:
    """Fetch live price from FCS API."""
    symbol = FCS_SYMBOLS.get(pair)
    if not symbol:
        raise Exception(f"Unsupported pair: {pair}")

    # Determine endpoint: crypto vs forex
    if pair.startswith("BTC") or pair.startswith("ETH"):
        endpoint = f"{FCS_BASE_URL}/crypto/latest"
    else:
        endpoint = f"{FCS_BASE_URL}/forex/latest"

    params = {
        "symbol": symbol,
        "access_key": FCS_API_KEY,
    }

    response = requests.get(endpoint, params=params, timeout=10)
    response.raise_for_status()
    data = response.json()

    if not data.get("status"):
        raise Exception(f"FCS API error: {data.get('msg', 'Unknown error')}")

    # Parse response - FCS API returns nested "active" object
    item = data["response"][0] if isinstance(data["response"], list) else data["response"]

    # FCS API price fields (inside "active" object):
    # a = ask, b = bid, o = open, h = high, l = low
    active = item.get("active", item)

    ask = float(active.get("a", 0))
    bid = float(active.get("b", 0))
    # Use mid price (average of ask and bid)
    current_price = (ask + bid) / 2 if ask and bid else (ask or bid)

    return {
        "pair": pair,
        "price": current_price,
        "ask": ask,
        "bid": bid,
        "open": float(active.get("o", 0)),
        "high": float(active.get("h", 0)),
        "low": float(active.get("l", 0)),
        "timestamp": item.get("updateTime", ""),
        "source": "fcs_api",
    }


@app.get("/")
def root():
    return {"service": "TradeVault AI", "status": "running"}


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "fcs_api_configured": bool(FCS_API_KEY),
    }


@app.post("/api/get-price")
async def get_price(request: PriceRequest):
    """Get live price using FCS API."""
    try:
        return get_fcs_price(request.pair)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== IMAGE ANALYSIS =====

def extract_prices_from_image(image_np: np.ndarray):
    gray = cv2.cvtColor(image_np, cv2.COLOR_RGB2GRAY)
    _, enhanced = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    text = pytesseract.image_to_string(enhanced, config="--psm 6")
    prices = re.findall(r'\d+\.\d{2,5}', text)
    price_list = [float(p) for p in prices if 0.01 < float(p) < 100000]
    return price_list, text


def detect_candles(image_np: np.ndarray) -> dict:
    hsv = cv2.cvtColor(image_np, cv2.COLOR_RGB2HSV)

    lower_green = np.array([40, 50, 50])
    upper_green = np.array([80, 255, 255])
    green_mask = cv2.inRange(hsv, lower_green, upper_green)

    lower_red1 = np.array([0, 50, 50])
    upper_red1 = np.array([10, 255, 255])
    lower_red2 = np.array([170, 50, 50])
    upper_red2 = np.array([180, 255, 255])
    red_mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
    red_mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
    red_mask = cv2.bitwise_or(red_mask1, red_mask2)

    green_count = cv2.countNonZero(green_mask)
    red_count = cv2.countNonZero(red_mask)

    if green_count > red_count * 1.2:
        bias = "BULLISH"
        direction = "long"
    elif red_count > green_count * 1.2:
        bias = "BEARISH"
        direction = "short"
    else:
        bias = "MIXED"
        direction = "neutral"

    return {
        "green_candles": int(green_count),
        "red_candles": int(red_count),
        "bias": bias,
        "direction": direction,
    }


def detect_swing_levels(prices: List[float], lookback: int = 5) -> dict:
    if len(prices) < lookback * 2 + 1:
        return {"swing_highs": [], "swing_lows": []}

    swing_highs = []
    swing_lows = []

    for i in range(lookback, len(prices) - lookback):
        is_swing_high = True
        for j in range(1, lookback + 1):
            if prices[i] <= prices[i - j] or prices[i] <= prices[i + j]:
                is_swing_high = False
                break
        if is_swing_high:
            swing_highs.append({"index": i, "price": prices[i]})

        is_swing_low = True
        for j in range(1, lookback + 1):
            if prices[i] >= prices[i - j] or prices[i] >= prices[i + j]:
                is_swing_low = False
                break
        if is_swing_low:
            swing_lows.append({"index": i, "price": prices[i]})

    return {"swing_highs": swing_highs, "swing_lows": swing_lows}


def find_key_levels_from_swings(swing_highs: List[dict], swing_lows: List[dict]) -> dict:
    resistance_levels = [s["price"] for s in swing_highs[-5:]] if swing_highs else []
    support_levels = [s["price"] for s in swing_lows[-5:]] if swing_lows else []

    resistance = max(resistance_levels) if resistance_levels else 0
    support = min(support_levels) if support_levels else 0

    return {
        "resistance": resistance,
        "support": support,
        "resistance_levels": resistance_levels,
        "support_levels": support_levels,
    }


def calculate_sl_tp(direction: str, current_price: float, support: float, resistance: float) -> dict:
    if current_price <= 0:
        return {"stop_loss": 0, "take_profit1": 0, "take_profit2": 0, "take_profit3": 0}

    range_width = abs(resistance - support) if resistance > support else current_price * 0.02

    if direction == "long":
        sl = support - range_width * 0.1
        tp1 = current_price + range_width * 0.5
        tp2 = current_price + range_width * 1.0
        tp3 = resistance + range_width * 0.1
    elif direction == "short":
        sl = resistance + range_width * 0.1
        tp1 = current_price - range_width * 0.5
        tp2 = current_price - range_width * 1.0
        tp3 = support - range_width * 0.1
    else:
        sl = support - range_width * 0.1
        tp1 = current_price + range_width * 0.5
        tp2 = current_price + range_width * 1.0
        tp3 = resistance

    return {
        "stop_loss": round(sl, 5),
        "take_profit1": round(tp1, 5),
        "take_profit2": round(tp2, 5),
        "take_profit3": round(tp3, 5),
    }


@app.post("/api/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        image_np = np.array(image)

        if image_np.shape[2] == 4:
            image_np = cv2.cvtColor(image_np, cv2.COLOR_RGBA2RGB)

        prices, text = extract_prices_from_image(image_np)
        candle_analysis = detect_candles(image_np)

        swings = detect_swing_levels(prices, lookback=5)
        key_levels = find_key_levels_from_swings(swings["swing_highs"], swings["swing_lows"])

        if key_levels["support"] > 0 and key_levels["resistance"] > 0:
            support = key_levels["support"]
            resistance = key_levels["resistance"]
        else:
            sorted_prices = sorted(prices) if prices else []
            support = sorted_prices[0] if sorted_prices else 0
            resistance = sorted_prices[-1] if sorted_prices else 0

        current_price = prices[-1] if prices else 0
        sl_tp = calculate_sl_tp(candle_analysis["direction"], current_price, support, resistance)

        return {
            "status": "success",
            "prices_detected": prices[:20],
            "current_price": round(current_price, 5),
            "support": round(support, 5),
            "resistance": round(resistance, 5),
            "direction": candle_analysis["direction"],
            "bias": candle_analysis["bias"],
            "green_candles": candle_analysis["green_candles"],
            "red_candles": candle_analysis["red_candles"],
            "entry": round(current_price, 5),
            "stop_loss": sl_tp["stop_loss"],
            "take_profit1": sl_tp["take_profit1"],
            "take_profit2": sl_tp["take_profit2"],
            "take_profit3": sl_tp["take_profit3"],
            "swing_highs": [round(s["price"], 5) for s in swings["swing_highs"][-10:]],
            "swing_lows": [round(s["price"], 5) for s in swings["swing_lows"][-10:]],
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}