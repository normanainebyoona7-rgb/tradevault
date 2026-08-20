from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import cv2
import numpy as np
import pytesseract
from PIL import Image
import io
import re
import config

app = FastAPI(title="TradeVault AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"service": "TradeVault AI", "status": "running"}

@app.get("/health")
def health():
    return {"status": "healthy"}

def extract_prices_from_image(image_np: np.ndarray) -> List[float]:
    """Use OCR to extract price numbers from chart image"""
    gray = cv2.cvtColor(image_np, cv2.COLOR_RGB2GRAY)
    _, enhanced = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    text = pytesseract.image_to_string(enhanced, config="--psm 6")
    prices = re.findall(r'\d+\.\d{2,5}', text)
    price_list = [float(p) for p in prices if 0.01 < float(p) < 100000]
    return price_list, text

def detect_candles(image_np: np.ndarray) -> dict:
    """Detect green (bullish) and red (bearish) candles"""
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
    """Detect swing highs and swing lows using lookback period"""
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
    """Find key support/resistance from swing levels"""
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
    """Calculate SL/TP based on support/resistance"""
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
    """
    FULLY analyze chart screenshot:
    1. Read prices from image using OCR
    2. Detect candle colors
    3. Find swing highs/lows
    4. Calculate SL/TP
    """
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        image_np = np.array(image)
        
        if image_np.shape[2] == 4:
            image_np = cv2.cvtColor(image_np, cv2.COLOR_RGBA2RGB)
        
        # Extract prices
        prices, text = extract_prices_from_image(image_np)
        
        # Detect candles
        candle_analysis = detect_candles(image_np)
        
        # Swing detection
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
        
        # Calculate SL/TP
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
            "lookback_period": 5,
        }
        
    except Exception as e:
        return {"status": "error", "message": str(e)}
