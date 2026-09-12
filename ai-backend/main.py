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

FCS_SYMBOLS = {
    "EUR/USD": "EURUSD", "GBP/USD": "GBPUSD", "USD/JPY": "USDJPY",
    "XAU/USD": "XAUUSD", "XAG/USD": "XAGUSD", "GBP/JPY": "GBPJPY",
    "BTC/USD": "BINANCE:BTCUSDT", "ETH/USD": "BINANCE:ETHUSDT",
}

FCS_TIMEFRAME_MAP = {
    "1m": "1", "5m": "5", "15m": "15", "30m": "30",
    "1H": "60", "4H": "240", "1D": "D", "1W": "W",
}


class PriceRequest(BaseModel):
    pair: str


class HistoryRequest(BaseModel):
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


def get_fcs_history(pair: str, timeframe: str, limit: int = 200) -> dict:
    symbol = FCS_SYMBOLS.get(pair)
    if not symbol:
        raise Exception(f"Unsupported pair: {pair}")

    period = FCS_TIMEFRAME_MAP.get(timeframe, "60")

    endpoint = f"{FCS_BASE_URL}/forex/candle"
    params = {"symbol": symbol, "period": period, "limit": limit, "access_key": FCS_API_KEY}

    response = requests.get(endpoint, params=params, timeout=15)
    response.raise_for_status()
    data = response.json()

    if not data.get("status"):
        raise Exception(f"FCS API error: {data.get('msg', 'Unknown')}")

    candles = data.get("response", [])
    closes = [float(c["c"]) for c in candles if c.get("c")]

    return {"pair": pair, "timeframe": timeframe, "closes": closes, "count": len(closes), "source": "fcs_api"}


# ===== ENDPOINTS =====

@app.get("/")
def root():
    return {"service": "TradeVault AI", "status": "running"}


@app.get("/health")
def health():
    return {"status": "healthy", "fcs_api_configured": bool(FCS_API_KEY)}


@app.post("/api/get-price")
async def get_price(request: PriceRequest):
    try:
        return get_fcs_price(request.pair)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/get-history")
async def get_history(request: HistoryRequest):
    try:
        return get_fcs_history(request.pair, request.timeframe, request.limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== CHART IMAGE ANALYSIS =====
# Extracts from the uploaded chart:
# - Y-axis price range (via OCR)
# - Support/resistance levels (horizontal pixel clusters)
# - Candle direction (green vs red pixel mass)
# - Chart trend

def extract_y_axis_range(image_np: np.ndarray) -> tuple:
    """
    Reads price labels from the right side of the chart (y-axis).
    Returns (min_price, max_price, [list of detected prices])
    """
    h, w = image_np.shape[:2]
    # Right 15% of image usually contains y-axis labels
    right_strip = image_np[:, int(w * 0.85):]

    gray = cv2.cvtColor(right_strip, cv2.COLOR_RGB2GRAY)
    # Upscale for better OCR
    gray = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    _, enhanced = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    text = pytesseract.image_to_string(enhanced, config="--psm 6")

    # Extract numbers (price format: 1234.56 or 1234.5 or 12345)
    matches = re.findall(r'\b\d{1,6}\.?\d{0,5}\b', text)
    prices = []
    for m in matches:
        try:
            v = float(m)
            if 0.01 < v < 1_000_000:
                prices.append(v)
        except ValueError:
            continue

    if not prices:
        return (0, 0, [])

    return (min(prices), max(prices), sorted(set(prices)))


def detect_sr_levels_by_pixels(image_np: np.ndarray, y_min: float, y_max: float) -> dict:
    """
    Detects support/resistance as horizontal bands where price has reversed.
    Uses pixel density of wicks in a horizontal strip.
    """
    h, w = image_np.shape[:2]

    if y_max <= y_min:
        return {"support": [], "resistance": []}

    # Focus on middle 80% (exclude toolbars)
    chart = image_np[int(h * 0.05):int(h * 0.95), int(w * 0.02):int(w * 0.85)]
    ch, cw = chart.shape[:2]

    # Detect wick pixels (thin vertical lines). Use darker pixels on light bg.
    gray = cv2.cvtColor(chart, cv2.COLOR_RGB2GRAY)
    _, binary = cv2.threshold(gray, 100, 255, cv2.THRESH_BINARY_INV)

    # Horizontal projection of pixel density
    row_density = binary.sum(axis=1) / 255  # count of active pixels per row

    # Smooth
    kernel = np.ones(5) / 5
    smoothed = np.convolve(row_density, kernel, mode='same')

    # Find peaks (rows where many wicks align = S/R level)
    threshold = smoothed.mean() + smoothed.std() * 1.5
    peak_rows = []
    for i in range(3, ch - 3):
        if smoothed[i] > threshold and smoothed[i] >= smoothed[i-1] and smoothed[i] >= smoothed[i+1]:
            peak_rows.append(i)

    # Deduplicate nearby peaks
    deduped = []
    for r in peak_rows:
        if not deduped or r - deduped[-1] > 8:
            deduped.append(r)

    # Convert pixel rows to prices (image y=0 is top = highest price)
    levels = []
    for r in deduped[:10]:
        price = y_max - (r / ch) * (y_max - y_min)
        levels.append(round(price, 5))

    # Split: above mid = resistance, below = support (relative to mid price)
    mid_price = (y_min + y_max) / 2
    resistance = sorted([p for p in levels if p > mid_price], reverse=True)
    support = sorted([p for p in levels if p < mid_price])

    return {"support": support[:4], "resistance": resistance[:4]}


def detect_trend_from_candles(image_np: np.ndarray) -> dict:
    """Uses color mass to determine bullish vs bearish."""
    hsv = cv2.cvtColor(image_np, cv2.COLOR_RGB2HSV)

    # Green candles
    green_mask = cv2.inRange(hsv, np.array([40, 40, 40]), np.array([85, 255, 255]))
    # Red candles (two ranges)
    red_mask = cv2.bitwise_or(
        cv2.inRange(hsv, np.array([0, 40, 40]), np.array([10, 255, 255])),
        cv2.inRange(hsv, np.array([170, 40, 40]), np.array([180, 255, 255]))
    )

    green_count = int(cv2.countNonZero(green_mask))
    red_count = int(cv2.countNonZero(red_mask))

    total = green_count + red_count
    if total == 0:
        return {"bias": "NEUTRAL", "green": 0, "red": 0, "green_pct": 50}

    green_pct = round((green_count / total) * 100, 1)

    if green_pct >= 60:
        bias = "BULLISH"
    elif green_pct <= 40:
        bias = "BEARISH"
    else:
        bias = "MIXED"

    return {"bias": bias, "green": green_count, "red": red_count, "green_pct": green_pct}


@app.post("/api/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    """
    Extracts chart structure from an uploaded screenshot.
    Returns levels used by the frontend to place SL/TP.
    """
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        image_np = np.array(image)

        if len(image_np.shape) == 2:
            image_np = cv2.cvtColor(image_np, cv2.COLOR_GRAY2RGB)
        elif image_np.shape[2] == 4:
            image_np = cv2.cvtColor(image_np, cv2.COLOR_RGBA2RGB)

        # 1. Y-axis price range (OCR)
        y_min, y_max, ocr_prices = extract_y_axis_range(image_np)

        # 2. Candle trend
        trend = detect_trend_from_candles(image_np)

        # 3. S/R levels from pixels
        sr = detect_sr_levels_by_pixels(image_np, y_min, y_max) if y_max > y_min else {"support": [], "resistance": []}

        # 4. Confidence based on data richness
        confidence = 30
        if ocr_prices: confidence += 25
        if sr["support"] or sr["resistance"]: confidence += 25
        if trend["bias"] in ("BULLISH", "BEARISH"): confidence += 20

        return {
            "status": "success",
            "y_axis_range": {"min": y_min, "max": y_max},
            "ocr_prices": ocr_prices[:20],
            "support_levels": sr["support"],
            "resistance_levels": sr["resistance"],
            "trend": trend,
            "confidence": confidence,
            "notes": f"Detected {len(sr['support'])} support, {len(sr['resistance'])} resistance levels",
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}