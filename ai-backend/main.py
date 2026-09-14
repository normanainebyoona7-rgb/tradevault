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
    return {"pair": pair, "price": price, "source": "fcs_api"}


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


@app.post("/api/get-history")
async def get_history(request: HistoryRequest):
    try:
        return get_fcs_history(request.pair, request.timeframe, request.limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== Y-AXIS READER (Multi-Strategy) =====

def clean_price_number(text: str) -> Optional[float]:
    """Clean OCR text and return a float if it looks like a price."""
    if not text:
        return None
    # Remove everything except digits, dots, commas, minus
    cleaned = re.sub(r'[^\d.,\-]', '', text)
    if not cleaned:
        return None
    # Handle cases like "2,400.50" -> 2400.50
    # Handle cases like "2400,50" -> 2400.50 (European)
    if ',' in cleaned and '.' in cleaned:
        # Both present - figure out which is decimal
        if cleaned.rfind('.') > cleaned.rfind(','):
            cleaned = cleaned.replace(',', '')  # comma is thousands
        else:
            cleaned = cleaned.replace('.', '').replace(',', '.')  # swap
    elif ',' in cleaned:
        # Only comma - could be decimal or thousands
        parts = cleaned.split(',')
        if len(parts) == 2 and len(parts[1]) <= 2:
            cleaned = cleaned.replace(',', '.')  # decimal comma
        else:
            cleaned = cleaned.replace(',', '')

    try:
        val = float(cleaned)
        if 0.001 < val < 10_000_000:
            return val
    except ValueError:
        pass
    return None


def read_y_axis_labels_v2(image_np: np.ndarray) -> list:
    """
    Robust y-axis reader. Tries multiple strips, themes, and OCR configs.
    Returns list of {price, y_pixel} sorted by y_pixel ascending.
    """
    h, w = image_np.shape[:2]
    all_labels = []

    # Try different strip widths
    for strip_pct in [0.06, 0.10, 0.15, 0.20]:
        strip_x_start = int(w * (1 - strip_pct))
        strip = image_np[:, strip_x_start:]

        # Upscale for OCR
        scale = 4
        big = cv2.resize(strip, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        gray = cv2.cvtColor(big, cv2.COLOR_RGB2GRAY)

        # Try multiple thresholding methods
        attempts = []
        # Method 1: Otsu on dark text
        _, t1 = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        attempts.append(t1)
        # Method 2: Inverted (light text on dark bg)
        attempts.append(cv2.bitwise_not(t1))
        # Method 3: Adaptive threshold
        t3 = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
        attempts.append(t3)

        for thresh in attempts:
            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            for contour in contours:
                x, y, cw, ch = cv2.boundingRect(contour)
                # Filter text-like boxes
                if ch < 12 or ch > 100 or cw < 15 or cw > 250:
                    continue
                if ch / max(cw, 1) > 1.8:
                    continue
                if cw * ch < 100:
                    continue

                # OCR this specific box
                roi = thresh[y:y+ch, x:x+cw]
                for psm in [8, 7, 13, 6]:
                    text = pytesseract.image_to_string(
                        roi,
                        config=f"--psm {psm} -c tessedit_char_whitelist=0123456789.,-"
                    ).strip()

                    price = clean_price_number(text)
                    if price is not None:
                        # Convert to original pixel coords
                        orig_y = (y + ch / 2) / scale
                        all_labels.append({
                            "price": price,
                            "y_pixel": orig_y,
                            "strip_pct": strip_pct,
                        })
                        break  # Got one from this box, move on

        if len(all_labels) >= 3:
            break  # Enough labels from this strip

    if not all_labels:
        return []

    # Deduplicate by y position (keep unique y within 3px)
    all_labels.sort(key=lambda l: l["y_pixel"])
    unique = []
    for label in all_labels:
        is_duplicate = False
        for u in unique:
            if abs(u["y_pixel"] - label["y_pixel"]) < 5 and abs(u["price"] - label["price"]) < 0.01:
                is_duplicate = True
                break
        if not is_duplicate:
            unique.append(label)

    return unique


def calibrate_price_mapping(labels: list, chart_height: int) -> Optional[dict]:
    """Build a linear price mapping from y-axis labels."""
    if len(labels) < 2:
        return None

    ys = np.array([l["y_pixel"] for l in labels])
    prices = np.array([l["price"] for l in labels])

    # Fit line
    try:
        slope, intercept = np.polyfit(ys, prices, 1)
    except Exception:
        return None

    if slope >= 0:
        return None

    # Validate top > bottom
    top_price = float(intercept)
    bottom_price = float(slope * chart_height + intercept)

    if top_price <= bottom_price:
        return None

    return {
        "slope": float(slope),
        "intercept": float(intercept),
        "min_price": bottom_price,
        "max_price": top_price,
    }


def pixel_to_price(y_pixel: float, mapping: dict) -> float:
    return mapping["slope"] * y_pixel + mapping["intercept"]


# ===== CANDLE DETECTION =====

def detect_candles_from_image(image_np: np.ndarray, mapping: dict) -> list:
    """Detect candle bodies + wicks from chart area."""
    h, w = image_np.shape[:2]
    chart = image_np[:, :int(w * 0.85)]
    ch, cw = chart.shape[:2]

    hsv = cv2.cvtColor(chart, cv2.COLOR_RGB2HSV)

    # Broad green range
    green_mask = cv2.inRange(hsv, np.array([35, 30, 30]), np.array([90, 255, 255]))

    # Broad red range (two hues)
    red_mask = cv2.bitwise_or(
        cv2.inRange(hsv, np.array([0, 30, 30]), np.array([15, 255, 255])),
        cv2.inRange(hsv, np.array([165, 30, 30]), np.array([180, 255, 255]))
    )

    candle_mask = cv2.bitwise_or(green_mask, red_mask)

    # Clean
    kernel = np.ones((2, 2), np.uint8)
    candle_mask = cv2.morphologyEx(candle_mask, cv2.MORPH_OPEN, kernel)
    candle_mask = cv2.morphologyEx(candle_mask, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(candle_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    candles = []
    for contour in contours:
        x, y, cw2, ch2 = cv2.boundingRect(contour)

        if cw2 < 1 or cw2 > 30 or ch2 < 3 or ch2 > 400:
            continue

        top_y = y
        bottom_y = y + ch2

        top_price = pixel_to_price(top_y, mapping)
        bottom_price = pixel_to_price(bottom_y, mapping)

        center_x = x + cw2 // 2
        center_y = y + ch2 // 2

        sample = chart[max(0, center_y - 2):center_y + 3, max(0, center_x - 1):center_x + 2]
        if sample.size == 0:
            continue

        sample_hsv = cv2.cvtColor(sample, cv2.COLOR_RGB2HSV)
        avg_hue = float(np.median(sample_hsv[:, :, 0]))

        is_green = 35 <= avg_hue <= 90
        is_red = avg_hue <= 15 or avg_hue >= 165

        if not (is_green or is_red):
            continue

        if is_green:
            open_price = bottom_price
            close_price = top_price
        else:
            open_price = top_price
            close_price = bottom_price

        candle_col = candle_mask[:, center_x]
        wick_pixels = np.where(candle_col > 0)[0]

        if len(wick_pixels) > 0:
            high_y = wick_pixels.min()
            low_y = wick_pixels.max()
            high_price = pixel_to_price(high_y, mapping)
            low_price = pixel_to_price(low_y, mapping)
        else:
            high_price = max(open_price, close_price)
            low_price = min(open_price, close_price)

        candles.append({
            "x_pixel": x + cw2 // 2,
            "open": float(open_price),
            "high": float(high_price),
            "low": float(low_price),
            "close": float(close_price),
            "is_green": bool(is_green),
        })

    candles.sort(key=lambda c: c["x_pixel"])
    return candles


# ===== SMC DETECTION =====

def detect_swing_points(candles: list, lookback: int = 3) -> dict:
    swing_highs = []
    swing_lows = []
    for i in range(lookback, len(candles) - lookback):
        c = candles[i]
        is_high = all(c["high"] >= candles[i - j]["high"] and c["high"] >= candles[i + j]["high"] for j in range(1, lookback + 1))
        is_low = all(c["low"] <= candles[i - j]["low"] and c["low"] <= candles[i + j]["low"] for j in range(1, lookback + 1))
        if is_high:
            swing_highs.append({"price": c["high"], "index": i})
        if is_low:
            swing_lows.append({"price": c["low"], "index": i})
    return {"swing_highs": swing_highs, "swing_lows": swing_lows}


def detect_liquidity(candles: list, tolerance_pct: float = 0.0015) -> list:
    if len(candles) < 10:
        return []
    swings = detect_swing_points(candles, 3)
    avg_price = sum(c["close"] for c in candles) / len(candles)
    tolerance = avg_price * tolerance_pct

    liquidity = []
    for i, h1 in enumerate(swings["swing_highs"]):
        touches = 1
        highest = h1["price"]
        for h2 in swings["swing_highs"][i + 1:]:
            if abs(h2["price"] - h1["price"]) <= tolerance:
                touches += 1
                highest = max(highest, h2["price"])
        swept = any(c["high"] > highest + tolerance for c in candles[h1["index"] + 1:])
        if not swept:
            liquidity.append({"type": "buy_side", "price": highest, "touches": touches, "index": h1["index"]})

    for i, l1 in enumerate(swings["swing_lows"]):
        touches = 1
        lowest = l1["price"]
        for l2 in swings["swing_lows"][i + 1:]:
            if abs(l2["price"] - l1["price"]) <= tolerance:
                touches += 1
                lowest = min(lowest, l2["price"])
        swept = any(c["low"] < lowest - tolerance for c in candles[l1["index"] + 1:])
        if not swept:
            liquidity.append({"type": "sell_side", "price": lowest, "touches": touches, "index": l1["index"]})

    return liquidity


def detect_order_blocks(candles: list) -> list:
    if len(candles) < 5:
        return []
    obs = []
    avg_range = sum(c["high"] - c["low"] for c in candles[-30:]) / min(30, len(candles))

    for i in range(1, len(candles) - 2):
        prev = candles[i - 1]
        curr = candles[i]
        nxt = candles[i + 1]

        if not prev["is_green"] and nxt["close"] > curr["high"]:
            move = nxt["close"] - nxt["open"]
            if move > avg_range * 1.2:
                obs.append({"type": "bullish", "top": max(prev["high"], curr["high"]), "bottom": min(prev["low"], curr["low"]), "index": i})

        if prev["is_green"] and nxt["close"] < curr["low"]:
            move = nxt["open"] - nxt["close"]
            if move > avg_range * 1.2:
                obs.append({"type": "bearish", "top": max(prev["high"], curr["high"]), "bottom": min(prev["low"], curr["low"]), "index": i})

    return obs[-10:]


def detect_fvgs(candles: list) -> list:
    if len(candles) < 3:
        return []
    fvgs = []
    avg_range = sum(c["high"] - c["low"] for c in candles[-30:]) / min(30, len(candles))

    for i in range(2, len(candles)):
        c1 = candles[i - 2]
        c3 = candles[i]

        if c3["low"] > c1["high"]:
            gap = c3["low"] - c1["high"]
            if gap > avg_range * 0.3:
                fvgs.append({"type": "bullish", "top": c3["low"], "bottom": c1["high"], "index": i})

        if c3["high"] < c1["low"]:
            gap = c1["low"] - c3["high"]
            if gap > avg_range * 0.3:
                fvgs.append({"type": "bearish", "top": c1["low"], "bottom": c3["high"], "index": i})

    return fvgs[-10:]


# ===== MAIN ENDPOINT =====

@app.post("/api/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        image_np = np.array(image)

        if len(image_np.shape) == 2:
            image_np = cv2.cvtColor(image_np, cv2.COLOR_GRAY2RGB)
        elif image_np.shape[2] == 4:
            image_np = cv2.cvtColor(image_np, cv2.COLOR_RGBA2RGB)

        h, w = image_np.shape[:2]

        # Read y-axis labels with the robust multi-strategy reader
        labels = read_y_axis_labels_v2(image_np)

        if len(labels) < 2:
            return {
                "status": "error",
                "message": f"Could not read y-axis prices from the image. Found {len(labels)} labels. Make sure the price scale is visible on the right.",
                "labels_found": len(labels),
                "image_size": f"{w}x{h}",
            }

        mapping = calibrate_price_mapping(labels, h)

        if not mapping:
            return {
                "status": "error",
                "message": f"Found {len(labels)} price labels but could not build price scale. Upload a clearer chart.",
                "labels_found": len(labels),
            }

        candles = detect_candles_from_image(image_np, mapping)

        if len(candles) < 20:
            return {
                "status": "error",
                "message": f"Only {len(candles)} candles detected. Please upload a larger, clearer chart.",
                "candles_found": len(candles),
                "labels_found": len(labels),
            }

        liquidity = detect_liquidity(candles)
        order_blocks = detect_order_blocks(candles)
        fvgs = detect_fvgs(candles)

        current_price = candles[-1]["close"]
        trend = "bullish" if candles[-1]["is_green"] else "bearish"

        return {
            "status": "success",
            "candles": candles,
            "liquidity": liquidity,
            "order_blocks": order_blocks,
            "fvgs": fvgs,
            "current_price": current_price,
            "trend": trend,
            "y_axis": {
                "min": mapping["min_price"],
                "max": mapping["max_price"],
                "labels_read": len(labels),
            },
            "candle_count": len(candles),
        }

    except Exception as e:
        return {"status": "error", "message": f"Image analysis error: {str(e)}"}