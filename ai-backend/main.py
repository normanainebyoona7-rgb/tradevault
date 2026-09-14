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


# ===== CHART IMAGE READER =====

def crop_to_plot_area(image_np: np.ndarray) -> tuple:
    """
    Find the chart plot area (largest region with candles).
    Returns (cropped_image, offset_x, offset_y).
    """
    h, w = image_np.shape[:2]

    # Convert to grayscale and detect edges
    gray = cv2.cvtColor(image_np, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 50, 150)

    # Find contours (potential chart areas)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return image_np, 0, 0

    # Largest rectangular contour = plot area
    largest = max(contours, key=cv2.contourArea)
    x, y, cw, ch = cv2.boundingRect(largest)

    # Pad slightly to be safe
    x = max(0, x - 5)
    y = max(0, y - 5)
    cw = min(w - x, cw + 10)
    ch = min(h - y, ch + 10)

    # Crop
    return image_np[y:y+ch, x:x+cw], x, y


def read_y_axis_labels(image_np: np.ndarray) -> list:
    """
    Read y-axis price labels from the right side of the chart.
    Returns list of {price, y_pixel} sorted by y_pixel ascending.
    """
    h, w = image_np.shape[:2]

    # Right 12% of image contains y-axis
    strip_x_start = int(w * 0.88)
    right_strip = image_np[:, strip_x_start:]

    # Upscale for better OCR
    scale = 3
    strip_resized = cv2.resize(right_strip, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    gray = cv2.cvtColor(strip_resized, cv2.COLOR_RGB2GRAY)

    # Try both dark-on-light and light-on-dark
    _, thresh1 = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    thresh2 = cv2.bitwise_not(thresh1)

    labels = []

    for thresh in [thresh1, thresh2]:
        # Get bounding boxes for each text region
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for contour in contours:
            x, y, cw, ch = cv2.boundingRect(contour)
            if ch < 15 or ch > 80 or cw < 20 or cw > 200:
                continue
            if ch / max(cw, 1) > 1.5:
                continue

            # Extract the region and OCR just this text
            roi = thresh[y:y+ch, x:x+cw]
            text = pytesseract.image_to_string(roi, config="--psm 8 -c tessedit_char_whitelist=0123456789.,-").strip()

            if not text:
                continue

            # Clean up
            cleaned = re.sub(r'[^\d.\-]', '', text)
            if not cleaned or cleaned in (".", "-", ".."):
                continue

            try:
                price = float(cleaned)
                if 0.00001 < price < 1_000_000:
                    # Convert y-coordinate back to original image scale
                    orig_y = (y + ch / 2) / scale
                    labels.append({"price": price, "y_pixel": orig_y})
            except ValueError:
                continue

        if labels:
            break

    # Deduplicate by y_pixel (keep unique y positions)
    unique = []
    seen_y = set()
    for label in sorted(labels, key=lambda l: l["y_pixel"]):
        y_int = int(label["y_pixel"])
        if y_int not in seen_y:
            seen_y.add(y_int)
            unique.append(label)

    return unique


def calibrate_price_mapping(labels: list, chart_height: int) -> Optional[dict]:
    """
    Build a linear mapping from y_pixel → price.
    Returns {slope, intercept, min_price, max_price} or None if insufficient labels.
    """
    if len(labels) < 2:
        return None

    # Sort by y (top = highest price)
    sorted_labels = sorted(labels, key=lambda l: l["y_pixel"])

    # Linear regression: price = slope * y_pixel + intercept
    ys = np.array([l["y_pixel"] for l in sorted_labels])
    prices = np.array([l["price"] for l in sorted_labels])

    # Fit line
    slope, intercept = np.polyfit(ys, prices, 1)

    # Sanity: slope should be negative (lower on screen = lower price)
    if slope >= 0:
        return None

    # Validate: top of chart = highest price, bottom = lowest
    top_price = slope * 0 + intercept
    bottom_price = slope * chart_height + intercept

    if top_price <= bottom_price:
        return None

    return {
        "slope": float(slope),
        "intercept": float(intercept),
        "min_price": float(bottom_price),
        "max_price": float(top_price),
    }


def pixel_to_price(y_pixel: float, mapping: dict) -> float:
    return mapping["slope"] * y_pixel + mapping["intercept"]


def detect_candles_from_image(image_np: np.ndarray, mapping: dict) -> list:
    """
    Detect candle bodies and wicks from the chart area.
    Returns list of {open, high, low, close, x_pixel, y_center}.
    """
    h, w = image_np.shape[:2]

    # Use only the chart area (exclude y-axis on right)
    chart = image_np[:, :int(w * 0.88)]
    ch, cw = chart.shape[:2]

    # Detect candle colors (green = bullish, red = bearish)
    hsv = cv2.cvtColor(chart, cv2.COLOR_RGB2HSV)

    # Green mask
    lower_green = np.array([40, 40, 40])
    upper_green = np.array([85, 255, 255])
    green_mask = cv2.inRange(hsv, lower_green, upper_green)

    # Red mask (two hue ranges)
    lower_red1 = np.array([0, 40, 40])
    upper_red1 = np.array([10, 255, 255])
    lower_red2 = np.array([170, 40, 40])
    upper_red2 = np.array([180, 255, 255])
    red_mask = cv2.bitwise_or(
        cv2.inRange(hsv, lower_red1, upper_red1),
        cv2.inRange(hsv, lower_red2, upper_red2)
    )

    # Combine candle bodies
    candle_mask = cv2.bitwise_or(green_mask, red_mask)

    # Clean small noise
    kernel = np.ones((2, 2), np.uint8)
    candle_mask = cv2.morphologyEx(candle_mask, cv2.MORPH_OPEN, kernel)
    candle_mask = cv2.morphologyEx(candle_mask, cv2.MORPH_CLOSE, kernel)

    # Find contours (each candle is a contour)
    contours, _ = cv2.findContours(candle_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    candles = []
    for contour in contours:
        x, y, cw2, ch2 = cv2.boundingRect(contour)

        # Filter: candle width should be 1-20 px, height 3-300 px
        if cw2 < 1 or cw2 > 20 or ch2 < 3 or ch2 > 300:
            continue

        # Candle body extends from (x, y) to (x + cw2, y + ch2)
        # Top of body = close (if bullish) or open (if bearish)
        # Bottom of body = open (if bullish) or close (if bearish)
        top_y = y
        bottom_y = y + ch2

        # Convert to price
        top_price = pixel_to_price(top_y, mapping)
        bottom_price = pixel_to_price(bottom_y, mapping)

        # Determine if bullish or bearish by checking color in center
        center_x = x + cw2 // 2
        center_y = y + ch2 // 2

        # Sample a small region
        sample = chart[max(0, center_y - 2):center_y + 3, max(0, center_x - 1):center_x + 2]
        if sample.size == 0:
            continue

        sample_hsv = cv2.cvtColor(sample, cv2.COLOR_RGB2HSV)
        avg_hue = np.median(sample_hsv[:, :, 0])

        is_green = 40 <= avg_hue <= 85
        is_red = avg_hue <= 10 or avg_hue >= 170

        if not (is_green or is_red):
            continue

        # Bullish = open at bottom, close at top
        # Bearish = open at top, close at bottom
        if is_green:
            open_price = bottom_price
            close_price = top_price
        else:
            open_price = top_price
            close_price = bottom_price

        # High/Low: check wicks above/below body
        # Look at the column above and below the body for thin wick pixels
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

    # Sort by x_pixel (left to right = time order)
    candles.sort(key=lambda c: c["x_pixel"])
    return candles


# ===== SMC ANALYSIS FROM CANDLES =====

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
    """
    Find liquidity zones (equal highs/lows where stops cluster).
    """
    if len(candles) < 10:
        return []

    swings = detect_swing_points(candles, 3)
    avg_price = sum(c["close"] for c in candles) / len(candles)
    tolerance = avg_price * tolerance_pct

    liquidity = []

    # Buy-side liquidity (above equal highs)
    for i, h1 in enumerate(swings["swing_highs"]):
        touches = 1
        highest = h1["price"]
        for h2 in swings["swing_highs"][i + 1:]:
            if abs(h2["price"] - h1["price"]) <= tolerance:
                touches += 1
                highest = max(highest, h2["price"])

        # Check if swept
        swept = any(c["high"] > highest + tolerance for c in candles[h1["index"] + 1:])

        if not swept:
            liquidity.append({
                "type": "buy_side",
                "price": highest,
                "touches": touches,
                "index": h1["index"],
            })

    # Sell-side liquidity (below equal lows)
    for i, l1 in enumerate(swings["swing_lows"]):
        touches = 1
        lowest = l1["price"]
        for l2 in swings["swing_lows"][i + 1:]:
            if abs(l2["price"] - l1["price"]) <= tolerance:
                touches += 1
                lowest = min(lowest, l2["price"])

        swept = any(c["low"] < lowest - tolerance for c in candles[l1["index"] + 1:])

        if not swept:
            liquidity.append({
                "type": "sell_side",
                "price": lowest,
                "touches": touches,
                "index": l1["index"],
            })

    return liquidity


def detect_order_blocks(candles: list) -> list:
    """
    Order blocks: last opposite candle before an impulsive move.
    """
    if len(candles) < 5:
        return []

    obs = []
    avg_range = sum(c["high"] - c["low"] for c in candles[-30:]) / min(30, len(candles))

    for i in range(1, len(candles) - 2):
        prev = candles[i - 1]
        curr = candles[i]
        nxt = candles[i + 1]

        # Bullish OB: last bearish candle before strong bullish move
        if not prev["is_green"] and nxt["close"] > curr["high"]:
            move_size = nxt["close"] - nxt["open"]
            if move_size > avg_range * 1.2:
                obs.append({
                    "type": "bullish",
                    "top": max(prev["high"], curr["high"]),
                    "bottom": min(prev["low"], curr["low"]),
                    "index": i,
                })

        # Bearish OB: last bullish candle before strong bearish move
        if prev["is_green"] and nxt["close"] < curr["low"]:
            move_size = nxt["open"] - nxt["close"]
            if move_size > avg_range * 1.2:
                obs.append({
                    "type": "bearish",
                    "top": max(prev["high"], curr["high"]),
                    "bottom": min(prev["low"], curr["low"]),
                    "index": i,
                })

    return obs[-10:]  # Last 10 order blocks


def detect_fvgs(candles: list) -> list:
    """
    Fair Value Gaps: gap between candle 1 and candle 3.
    """
    if len(candles) < 3:
        return []

    fvgs = []
    avg_range = sum(c["high"] - c["low"] for c in candles[-30:]) / min(30, len(candles))

    for i in range(2, len(candles)):
        c1 = candles[i - 2]
        c3 = candles[i]

        # Bullish FVG: gap between c1.high and c3.low
        if c3["low"] > c1["high"]:
            gap = c3["low"] - c1["high"]
            if gap > avg_range * 0.3:
                fvgs.append({
                    "type": "bullish",
                    "top": c3["low"],
                    "bottom": c1["high"],
                    "index": i,
                })

        # Bearish FVG: gap between c3.high and c1.low
        if c3["high"] < c1["low"]:
            gap = c1["low"] - c3["high"]
            if gap > avg_range * 0.3:
                fvgs.append({
                    "type": "bearish",
                    "top": c1["low"],
                    "bottom": c3["high"],
                    "index": i,
                })

    return fvgs[-10:]


# ===== MAIN ENDPOINT =====

@app.post("/api/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    """
    Full SMC analysis from a chart screenshot.
    Returns candles, liquidity, order blocks, FVGs.
    """
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        image_np = np.array(image)

        if len(image_np.shape) == 2:
            image_np = cv2.cvtColor(image_np, cv2.COLOR_GRAY2RGB)
        elif image_np.shape[2] == 4:
            image_np = cv2.cvtColor(image_np, cv2.COLOR_RGBA2RGB)

        # Step 1: Crop to plot area
        cropped, ox, oy = crop_to_plot_area(image_np)

        # Step 2: Read y-axis labels
        labels = read_y_axis_labels(cropped)

        if len(labels) < 2:
            return {
                "status": "error",
                "message": "Could not read y-axis prices from the image. Make sure the price scale is visible.",
                "labels_found": len(labels),
            }

        # Step 3: Build price mapping
        mapping = calibrate_price_mapping(labels, cropped.shape[0])

        if not mapping:
            return {
                "status": "error",
                "message": "Could not calibrate price scale. Please upload a clearer chart.",
                "labels_found": len(labels),
            }

        # Step 4: Detect candles
        candles = detect_candles_from_image(cropped, mapping)

        if len(candles) < 20:
            return {
                "status": "error",
                "message": f"Only {len(candles)} candles detected. Please upload a clearer chart.",
                "candles_found": len(candles),
            }

        # Step 5: SMC analysis
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
        return {"status": "error", "message": str(e)}