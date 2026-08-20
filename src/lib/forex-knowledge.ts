// src/lib/forex-knowledge.ts

export interface KnowledgeTopic {
  keywords: string[];
  response: string;
  category: string;
}

export const FOREX_KNOWLEDGE_BASE: KnowledgeTopic[] = [
  // ==================== BASICS ====================
  {
    keywords: [
      "what is forex",
      "forex meaning",
      "what is fx",
      "foreign exchange",
      "forex trading explained",
    ],
    category: "Basics",
    response:
      "Forex (Foreign Exchange) is the global marketplace where currencies are traded. It's the largest financial market in the world with over $7.5 trillion traded daily. Traders buy one currency while simultaneously selling another. For example, buying EUR/USD means buying Euros while selling US Dollars. The forex market operates 24 hours a day, 5 days a week, across major financial centers including London, New York, Tokyo, and Sydney. Unlike stocks, forex has no central exchange — it trades over-the-counter (OTC) through banks, brokers, and electronic networks.",
  },
  {
    keywords: [
      "currency pair",
      "base currency",
      "quote currency",
      "what is pair",
      "currency pairs",
    ],
    category: "Basics",
    response:
      "A currency pair shows the exchange rate between two currencies. The first currency is the BASE currency, and the second is the QUOTE currency. For EUR/USD at 1.0850: EUR is the base, USD is the quote. This means 1 Euro = 1.0850 US Dollars. Major pairs (EUR/USD, GBP/USD, USD/JPY) have the highest liquidity. Cross pairs (EUR/GBP, GBP/JPY) don't include USD. Exotic pairs (USD/TRY, USD/ZAR) involve emerging market currencies and typically have wider spreads.",
  },
  {
    keywords: ["pip", "what is pip", "pipette", "point", "price movement"],
    category: "Basics",
    response:
      "A pip (Percentage in Point) is the smallest standard price movement in forex. For most pairs: 1 pip = 0.0001 (e.g., EUR/USD from 1.0850 to 1.0851). For JPY pairs: 1 pip = 0.01 (e.g., USD/JPY from 148.50 to 148.51). A pipette is 1/10 of a pip (0.00001 for most pairs). Pip value depends on position size: 1 standard lot (100,000 units) = $10 per pip for USD-quoted pairs. 1 mini lot (10,000 units) = $1 per pip. 1 micro lot (1,000 units) = $0.10 per pip.",
  },
  {
    keywords: [
      "lot",
      "lot size",
      "position size",
      "standard lot",
      "mini lot",
      "micro lot",
    ],
    category: "Basics",
    response:
      "Lot sizes determine your position size in forex:\n\n• STANDARD LOT = 100,000 units (pip value = $10 for USD pairs)\n• MINI LOT = 10,000 units (pip value = $1)\n• MICRO LOT = 1,000 units (pip value = $0.10)\n• NANO LOT = 100 units (pip value = $0.01)\n\nChoosing the right lot size is crucial for risk management. Your lot size should be based on your account balance, risk percentage, and stop loss distance.",
  },
  {
    keywords: ["bid", "ask", "spread", "what is spread", "bid ask"],
    category: "Basics",
    response:
      "BID price = the price at which you can SELL. ASK price = the price at which you can BUY. The SPREAD is the difference between bid and ask. For EUR/USD with bid 1.0848 and ask 1.0850, the spread is 2 pips. Spreads are how brokers make money. Major pairs typically have spreads of 0-2 pips. Exotic pairs can have spreads of 10-100+ pips. During high volatility (news events), spreads widen significantly.",
  },
  {
    keywords: [
      "broker",
      "what is broker",
      "forex broker",
      "choose broker",
      "best broker",
    ],
    category: "Basics",
    response:
      "A forex broker is an intermediary that gives you access to the forex market. When choosing a broker, consider:\n\n1. REGULATION: Ensure they're regulated (FCA, CySEC, ASIC, etc.)\n2. SPREADS: Lower spreads = better for you\n3. EXECUTION SPEED: Fast execution reduces slippage\n4. DEPOSIT/WITHDRAWAL: Easy and fast\n5. CUSTOMER SUPPORT: Responsive when you need help\n6. PLATFORM: MT4, MT5, or proprietary\n7. LEVERAGE: Appropriate levels\n8. REPUTATION: Read reviews from other traders",
  },
  {
    keywords: [
      "leverage",
      "what is leverage",
      "margin trading",
      "leverage explained",
    ],
    category: "Basics",
    response:
      "Leverage allows you to control a larger position with less capital. Examples:\n\n• 1:10 leverage = control $10,000 with $1,000\n• 1:50 leverage = control $50,000 with $1,000\n• 1:100 leverage = control $100,000 with $1,000\n• 1:500 leverage = control $500,000 with $1,000\n\nADVANTAGES: Amplifies profits, allows trading with small capital.\nDISADVANTAGES: Amplifies losses. High leverage can wipe out your account quickly.\n\nPRO TIP: Most professional traders use 1:10 to 1:30 leverage. High leverage is a trap for beginners.",
  },
  {
    keywords: ["margin", "what is margin", "margin call", "free margin"],
    category: "Basics",
    response:
      "MARGIN is the amount of money required to open a leveraged position. If your broker offers 1:100 leverage, you need 1% margin (=$100 for a $10,000 position).\n\nFREE MARGIN = Equity - Used Margin. This is the money available for new positions.\n\nMARGIN CALL: When your losses reduce your free margin below the required level, the broker asks you to deposit more money.\n\nSTOP OUT: If you don't add funds, the broker automatically closes your positions to prevent going negative.\n\nAlways maintain adequate free margin to avoid margin calls.",
  },

  // ==================== TECHNICAL ANALYSIS ====================
  {
    keywords: [
      "technical analysis",
      "chart analysis",
      "technical",
      "chart patterns",
    ],
    category: "Technical Analysis",
    response:
      "Technical analysis is the study of price movements and patterns to predict future direction. Key components:\n\n1. PRICE ACTION: Reading candlestick patterns\n2. TREND LINES: Connecting highs/lows to identify direction\n3. SUPPORT/RESISTANCE: Key price levels where reversals occur\n4. INDICATORS: Moving averages, RSI, MACD, Bollinger Bands\n5. CHART PATTERNS: Head & Shoulders, Double Top, Flags, Triangles\n\nTechnical analysis works on the assumption that history repeats itself and price movements reflect all available information.",
  },
  {
    keywords: [
      "support",
      "resistance",
      "support level",
      "resistance level",
      "key level",
      "key levels",
    ],
    category: "Technical Analysis",
    response:
      "SUPPORT: A price level where buying pressure overcomes selling pressure, causing price to bounce upward. It's like a floor.\n\nRESISTANCE: A price level where selling pressure overcomes buying pressure, causing price to reverse downward. It's like a ceiling.\n\nHOW TO FIND:\n1. Previous swing highs/lows\n2. Round numbers (1.1000, 1.2000)\n3. Moving averages (MA50, MA200)\n4. Fibonacci retracement levels\n5. Previous day high/low\n\nTIPS:\n- Support/resistance become stronger each time they're tested\n- When broken, support becomes resistance and vice versa\n- Trade bounces at support/resistance in ranging markets\n- Trade breakouts in trending markets",
  },
  {
    keywords: ["trend line", "trendline", "draw trend", "trend lines"],
    category: "Technical Analysis",
    response:
      "Trend lines are diagonal lines connecting price points:\n\nUPTREND LINE: Connect at least 2 higher lows. Price stays above this line.\n\nDOWNTREND LINE: Connect at least 2 lower highs. Price stays below this line.\n\nVALIDITY: A trend line needs at least 2 touch points, but 3+ is more reliable.\n\nBREAKOUT: When price breaks a trend line, it signals a potential trend reversal.\n\nANGLE: Very steep trend lines are less sustainable. Moderate angles (30-45 degrees) tend to be more reliable.",
  },
  {
    keywords: ["moving average", "ma", "sma", "ema", "moving averages"],
    category: "Technical Analysis",
    response:
      "Moving averages smooth out price data to identify trends:\n\nSMA (Simple): Average of last N prices. Slower but smoother.\nEMA (Exponential): Gives more weight to recent prices. Faster response.\n\nPOPULAR PERIODS:\n• MA20: Short-term trend (1-2 weeks)\n• MA50: Medium-term trend (2-3 months)\n• MA200: Long-term trend (1 year)\n\nSIGNALS:\n1. Price above MA = uptrend, below = downtrend\n2. MA20 crosses above MA50 = golden cross (bullish)\n3. MA20 crosses below MA50 = death cross (bearish)\n4. MA can act as support/resistance\n\nTREND CONFIRMATION: MA20 > MA50 > MA200 = strong uptrend",
  },
  {
    keywords: ["rsi", "relative strength", "overbought", "oversold"],
    category: "Technical Analysis",
    response:
      "RSI (Relative Strength Index) measures momentum on a 0-100 scale:\n\n• RSI > 70 = Overbought (price may reverse down)\n• RSI < 30 = Oversold (price may reverse up)\n• RSI = 50 = Neutral\n\nDIVERGENCE:\n• Bullish: Price makes lower low, RSI makes higher low → potential reversal up\n• Bearish: Price makes higher high, RSI makes lower high → potential reversal down\n\nTIPS:\n- RSI works best in ranging markets\n- In strong trends, RSI can stay overbought/oversold for extended periods\n- Use RSI with other indicators for confirmation",
  },
  {
    keywords: ["macd", "moving average convergence", "macd indicator"],
    category: "Technical Analysis",
    response:
      "MACD (Moving Average Convergence Divergence) shows momentum:\n\nCOMPONENTS:\n1. MACD Line = EMA(12) - EMA(26)\n2. Signal Line = EMA(9) of MACD Line\n3. Histogram = MACD Line - Signal Line\n\nSIGNALS:\n1. MACD crosses above Signal = bullish\n2. MACD crosses below Signal = bearish\n3. MACD above zero = bullish momentum\n4. MACD below zero = bearish momentum\n5. Histogram increasing = momentum strengthening\n\nDIVERGENCE: When price makes new high but MACD doesn't, it signals weakening momentum.",
  },
  {
    keywords: ["bollinger bands", "bollinger", "volatility indicator"],
    category: "Technical Analysis",
    response:
      "Bollinger Bands consist of 3 lines:\n1. Middle band = Simple Moving Average (usually 20-period)\n2. Upper band = SMA + 2 standard deviations\n3. Lower band = SMA - 2 standard deviations\n\nHOW TO USE:\n• Bands widen = high volatility\n• Bands narrow = low volatility (squeeze)\n• Price touching upper band = overbought condition\n• Price touching lower band = oversold condition\n\nSQUEEZE STRATEGY: When bands narrow significantly, a big move is likely coming. Trade the breakout direction.",
  },
  {
    keywords: [
      "candlestick",
      "candles",
      "candlestick patterns",
      "doji",
      "engulfing",
      "hammer",
    ],
    category: "Technical Analysis",
    response:
      "Key candlestick patterns:\n\nBULLISH PATTERNS:\n1. Hammer: Small body, long lower wick, at support → reversal up\n2. Bullish Engulfing: Green candle fully covers previous red candle\n3. Morning Star: Red, small body, then green → reversal up\n4. Bullish Doji: Open=Close with long lower wick\n\nBEARISH PATTERNS:\n1. Shooting Star: Small body, long upper wick, at resistance → reversal down\n2. Bearish Engulfing: Red candle fully covers previous green candle\n3. Evening Star: Green, small body, then red → reversal down\n4. Hanging Man: Like hammer but at resistance\n\nAlways confirm patterns with other indicators before trading.",
  },
  {
    keywords: [
      "head and shoulders",
      "double top",
      "double bottom",
      "triangle pattern",
      "flag pattern",
      "chart pattern",
    ],
    category: "Technical Analysis",
    response:
      "Chart patterns signal potential reversals or continuations:\n\nREVERSAL PATTERNS:\n1. HEAD & SHOULDERS: Three peaks, middle highest → bearish reversal\n2. INVERSE H&S: Three troughs, middle lowest → bullish reversal\n3. DOUBLE TOP: Two equal peaks → bearish reversal\n4. DOUBLE BOTTOM: Two equal troughs → bullish reversal\n\nCONTINUATION PATTERNS:\n1. BULL FLAG: Sharp up, then consolidation → continue up\n2. BEAR FLAG: Sharp down, then consolidation → continue down\n3. ASCENDING TRIANGLE: Higher lows → bullish breakout\n4. DESCENDING TRIANGLE: Lower highs → bearish breakout\n5. SYMMETRICAL TRIANGLE: Breakout can go either direction\n\nPROFIT TARGET: Measure pattern height and project from breakout point.",
  },

  // ==================== FUNDAMENTAL ANALYSIS ====================
  {
    keywords: [
      "fundamental analysis",
      "fundamentals",
      "economic news",
      "news trading",
    ],
    category: "Fundamental Analysis",
    response:
      "Fundamental analysis evaluates economic factors that influence currency values:\n\nKEY FACTORS:\n1. Interest Rates: Higher rates attract foreign investment → stronger currency\n2. Inflation: High inflation weakens currency\n3. GDP: Strong economic growth strengthens currency\n4. Employment: Low unemployment strengthens currency\n5. Trade Balance: Surplus strengthens, deficit weakens\n6. Political Stability: Stable countries have stronger currencies\n\nKEY EVENTS:\n• Central bank rate decisions\n• Non-Farm Payrolls (US)\n• CPI/Inflation data\n• GDP reports\n• PMI (Purchasing Managers Index)",
  },
  {
    keywords: [
      "interest rate",
      "central bank",
      "fed",
      "ecb",
      "bank of england",
      "rate decision",
    ],
    category: "Fundamental Analysis",
    response:
      "Central banks control monetary policy and interest rates:\n\nMAJOR CENTRAL BANKS:\n1. Federal Reserve (Fed) - US Dollar\n2. European Central Bank (ECB) - Euro\n3. Bank of England (BoE) - British Pound\n4. Bank of Japan (BoJ) - Japanese Yen\n5. Reserve Bank of Australia (RBA) - Australian Dollar\n6. Swiss National Bank (SNB) - Swiss Franc\n\nHIGHER RATES: Attract foreign investment → currency strengthens\nLOWER RATES: Reduce investment → currency weakens\n\nTRADING TIP: Pay attention to rate decision announcements and press conferences. They cause major volatility.",
  },
  {
    keywords: ["non farm payroll", "nfp", "employment data", "jobs report"],
    category: "Fundamental Analysis",
    response:
      "Non-Farm Payrolls (NFP) is released on the first Friday of each month at 8:30 AM EST by the US Bureau of Labor Statistics. It shows how many jobs were added/lost in the US economy (excluding farming).\n\nIMPACT:\n• Higher than expected → USD strengthens\n• Lower than expected → USD weakens\n\nEXPECTATIONS vs ACTUAL:\n• If actual > forecast → positive for USD\n• If actual < forecast → negative for USD\n\nVOLATILITY: NFP causes major volatility in USD pairs. Spreads widen significantly. Some traders avoid trading during NFP; others specialize in it.",
  },
  {
    keywords: ["cpi", "inflation", "consumer price", "inflation data"],
    category: "Fundamental Analysis",
    response:
      "CPI (Consumer Price Index) measures inflation:\n\n• HIGH CPI = High inflation = Central bank may raise rates = Currency may strengthen\n• LOW CPI = Low inflation = Central bank may cut rates = Currency may weaken\n\nCPI releases are monthly and closely watched by central banks for monetary policy decisions.",
  },
  {
    keywords: ["gdp", "gross domestic product", "economic growth"],
    category: "Fundamental Analysis",
    response:
      "GDP (Gross Domestic Product) measures a country's total economic output:\n\n• GDP growth > expectations → currency strengthens\n• GDP contraction → currency weakens\n• Two consecutive quarters of negative GDP = recession\n\nGDP is released quarterly and is a lagging indicator — it shows what already happened, not what's coming.",
  },

  // ==================== TRADING STRATEGIES ====================
  {
    keywords: [
      "trading strategy",
      "strategy",
      "trading plan",
      "how to trade",
      "trading system",
    ],
    category: "Strategies",
    response:
      "A complete trading strategy includes:\n\n1. ENTRY RULES: What conditions must exist before entering a trade?\n   • Technical setup (pattern, indicator)\n   • Fundamental alignment\n   • Time of day/session\n\n2. EXIT RULES:\n   • Take profit levels\n   • Trailing stop rules\n   • Time-based exits\n\n3. STOP LOSS: Always defined before entry\n   • Based on technical levels\n   • Based on ATR (Average True Range)\n   • Never moved further from entry (only closer)\n\n4. POSITION SIZING:\n   • Risk 1-2% per trade\n   • Calculate lot size based on stop loss distance\n\n5. RISK MANAGEMENT:\n   • Maximum daily loss limit\n   • Maximum concurrent trades\n   • Journal every trade\n\nTest any strategy on demo for at least 3 months before using real money.",
  },
  {
    keywords: ["scalping", "scalp", "day trading", "intraday"],
    category: "Strategies",
    response:
      "SCALPING: Trading very short timeframes (seconds to minutes) for small profits (5-15 pips per trade).\n\n• Requires fast execution\n• High frequency trading (10-50+ trades per day)\n• Low spreads are essential\n• High stress\n• Best during high liquidity (London/NY sessions)\n\nDAY TRADING: Opening and closing trades within the same day.\n• No overnight risk\n• Typically 1-5 trades per day\n• Uses 5m-1H charts\n• Focus on one session\n\nBoth require discipline and strict risk management.",
  },
  {
    keywords: ["swing trading", "swing trade", "position trading"],
    category: "Strategies",
    response:
      "SWING TRADING: Holding positions for days to weeks.\n\n• Uses 4H and daily charts\n• Target 50-200+ pips per trade\n• Fewer trades (3-10 per month)\n• Less time-intensive\n• Can hold overnight (swap fees apply)\n\nPOSITION TRADING: Holding for weeks to months.\n\n• Uses daily and weekly charts\n• Target 200-1000+ pips\n• Very few trades (1-3 per month)\n• Ignores short-term noise\n• Requires patience\n\nBoth are better suited for traders with day jobs.",
  },
  {
    keywords: ["breakout strategy", "breakout trading", "breakout"],
    category: "Strategies",
    response:
      "Breakout trading involves entering when price breaks a key level:\n\nSETUP:\n1. Identify a clear range/consolidation\n2. Wait for price to break above resistance (buy) or below support (sell)\n3. Enter on breakout with volume confirmation\n4. Stop loss: Below the breakout candle or back inside the range\n5. Target: Range height projected from breakout\n\nTIPS:\n• Look for tight consolidations (narrow range) before breakout\n• Volume should increase on breakout\n• Avoid false breakouts by waiting for candle close\n• Breakouts work best during London/NY sessions",
  },
  {
    keywords: [
      "trend following",
      "trend trading",
      "follow trend",
      "trend strategy",
    ],
    category: "Strategies",
    response:
      "Trend following is the most reliable long-term strategy:\n\nRULES:\n1. Identify trend using moving averages (MA20 > MA50 = uptrend)\n2. Only trade in the direction of the trend\n3. Enter on pullbacks to support (uptrend) or resistance (downtrend)\n4. Stop loss: Beyond the pullback extreme\n5. Target: Previous swing high/low\n6. Trail stop as trend progresses\n\nADVANTAGES:\n• Higher win rate in strong trends\n• Clear rules\n• Works across all timeframes\n\nDISADVANTAGES:\n• Losing streaks during ranging markets\n• Requires patience",
  },
  {
    keywords: [
      "support resistance strategy",
      "range trading",
      "range strategy",
    ],
    category: "Strategies",
    response:
      "Range trading works when price moves between clear support and resistance:\n\nSETUP:\n1. Identify a clear range (at least 2 touches on each side)\n2. Buy at support, sell at resistance\n3. Stop loss: Beyond support/resistance\n4. Target: Opposite side of the range\n\nTIPS:\n• Works best in quiet markets (Asian session)\n• Avoid during major news\n• Ranges break eventually — be ready for breakout\n• Use oscillator confirmations (RSI, Stochastic)",
  },
  {
    keywords: ["price action", "price action trading", "candlestick strategy"],
    category: "Strategies",
    response:
      "Price action trading uses raw price movements without indicators:\n\nKEY CONCEPTS:\n1. Pin Bars: Long wicks showing rejection\n2. Inside Bars: Consolidation candles\n3. Engulfing Patterns: Momentum shifts\n4. Key Levels: Support/resistance interaction\n\nSETUP:\n• Wait for price to reach a key level\n• Look for rejection candle (pin bar, engulfing)\n• Enter on next candle open\n• Stop loss: Beyond the rejection candle\n\nADVANTAGES: Clean charts, clear signals, works on all timeframes.",
  },

  // ==================== RISK MANAGEMENT ====================
  {
    keywords: ["risk management", "risk", "manage risk", "risk control"],
    category: "Risk Management",
    response:
      "Risk management is THE most important aspect of trading:\n\nGOLDEN RULES:\n1. Never risk more than 1-2% per trade\n2. Use stop losses on EVERY trade\n3. Maintain at least 1:1.5 risk-reward ratio (1:2+ is better)\n4. Maximum daily loss: 3-5% of account\n5. Maximum weekly loss: 10% of account\n6. Never average down on losing positions\n7. Don't move stop losses further from entry\n\nPOSITION SIZE CALCULATION:\nLot size = (Account balance × Risk %) / (Stop loss pips × Pip value)\n\nExample: $10,000 account, 1% risk, 25 pip stop\n= ($10,000 × 0.01) / (25 × $10) = $100 / $250 = 0.40 lots",
  },
  {
    keywords: [
      "position size",
      "position sizing",
      "lot size calculation",
      "calculate position",
    ],
    category: "Risk Management",
    response:
      "Position sizing formula:\n\nPosition Size (lots) = (Account × Risk%) / (SL pips × Pip Value per Lot)\n\nEXAMPLE:\nAccount = $10,000\nRisk = 2% = $200\nStop Loss = 50 pips\nPip Value = $10 per standard lot\n\nPosition Size = $200 / (50 × $10) = $200 / $500 = 0.40 standard lots\n\nFor mini lots: 0.40 × 10 = 4 mini lots\nFor micro lots: 0.40 × 100 = 40 micro lots\n\nAlways calculate position size BEFORE entering any trade.",
  },
  {
    keywords: [
      "risk reward",
      "risk reward ratio",
      "rr ratio",
      "risk to reward",
    ],
    category: "Risk Management",
    response:
      "Risk-Reward (R:R) ratio compares potential loss to potential gain:\n\n• 1:1 = Risk $100 to make $100\n• 1:2 = Risk $100 to make $200\n• 1:3 = Risk $100 to make $300\n\nWHY IT MATTERS:\nWith 1:2 R:R, you only need 33% win rate to breakeven.\nWith 1:3 R:R, you only need 25% win rate to breakeven.\nWith 1:1 R:R, you need 50%+ win rate to be profitable.\n\nPRO TIP: Aim for at least 1:2 R:R on every trade. This gives you a statistical edge even with a lower win rate.",
  },
  {
    keywords: ["stop loss", "stoploss", "sl", "where to put stop loss"],
    category: "Risk Management",
    response:
      "Stop loss placement rules:\n\n1. BELOW SUPPORT (for long trades)\n2. ABOVE RESISTANCE (for short trades)\n3. Beyond the recent swing high/low\n4. At least 5-10 pips beyond the structure\n5. Never wider than 2% of account risk\n\nMETHODS:\n• Fixed pip stop (e.g., 25 pips)\n• ATR-based (e.g., 1.5 × ATR)\n• Structure-based (beyond swing)\n• Percentage-based (e.g., stop when -1.5% of account)\n\nRULES:\n• Always set stop loss BEFORE entering\n• Never move stop loss further from entry\n• Move stop to breakeven after 1R profit\n• Trail stop as trade moves in your favor",
  },
  {
    keywords: ["drawdown", "max drawdown", "account drawdown"],
    category: "Risk Management",
    response:
      "Drawdown is the decline from peak account balance to trough:\n\n• 10% drawdown = account drops from $10,000 to $9,000\n• 20% drawdown = drops to $8,000\n\nWHY IT MATTERS:\nTo recover from drawdown:\n• 10% loss requires 11% gain\n• 20% loss requires 25% gain\n• 50% loss requires 100% gain\n• 90% loss requires 900% gain\n\nMAXIMUM ACCEPTABLE DRAWDOWN:\n• Conservative: 5-10%\n• Moderate: 10-15%\n• Aggressive: 15-20%\n\nIf your drawdown exceeds 20%, STOP trading and review your strategy.",
  },

  // ==================== TRADING PSYCHOLOGY ====================
  {
    keywords: [
      "trading psychology",
      "psychology",
      "mindset",
      "emotions",
      "discipline",
    ],
    category: "Psychology",
    response:
      "Trading psychology is 80% of trading success:\n\nCOMMON MISTAKES:\n1. REVENGE TRADING: Trying to win back losses → leads to bigger losses\n2. FOMO (Fear Of Missing Out): Entering trades without setup\n3. OVERTRADING: Too many trades = more fees + worse decisions\n4. MOVING STOP LOSS: Not accepting small losses\n5. GREED: Not taking profit, holding too long\n6. FEAR: Exiting too early, missing profits\n\nSOLUTIONS:\n• Follow your trading plan exactly\n• Keep a journal of every trade\n• Set daily loss limits\n• Take breaks after losses\n• Meditate/exercise\n• Accept that losses are part of trading",
  },
  {
    keywords: ["fomo", "fear of missing", "revenge trading", "overtrading"],
    category: "Psychology",
    response:
      "FOMO (Fear Of Missing Out) and REVENGE TRADING are the two biggest account killers:\n\nFOMO: Seeing price move without you → jump in late → get trapped → lose.\n\nREVENGE: After a loss → immediately enter another trade → emotional decisions → bigger loss.\n\nSOLUTIONS:\n1. Set alerts at your entry levels — if price hits, trade; if not, accept\n2. After a loss, take a 30-minute break\n3. Set maximum 3 losses per day — after that, stop\n4. Journal your emotions with each trade\n5. Remember: there's always another trade tomorrow\n\nPRO TIP: If you feel angry, anxious, or desperate, DO NOT trade. Close the platform and walk away.",
  },
  {
    keywords: [
      "trading journal",
      "journaling",
      "trade journal",
      "record trades",
    ],
    category: "Psychology",
    response:
      "A trading journal is essential for improvement:\n\nWHAT TO RECORD:\n1. Date/time of trade\n2. Currency pair\n3. Direction (long/short)\n4. Entry price, stop loss, take profit\n5. Position size\n6. Strategy used\n7. Screenshot of setup\n8. Emotions before/during/after\n9. Result (win/loss, pips, money)\n10. Notes on what you did well/wrong\n\nREVIEW:\n• Weekly: Look for patterns in wins/losses\n• Monthly: Calculate stats (win rate, R:R, expectancy)\n• Adjust strategy based on findings\n\nMost professional traders review their journal daily.",
  },

  // ==================== MARKET SESSIONS ====================
  {
    keywords: [
      "trading session",
      "session",
      "london session",
      "new york session",
      "asian session",
      "market hours",
    ],
    category: "Sessions",
    response:
      "Forex market sessions (UTC):\n\nSYDNEY: 10:00 PM - 7:00 AM\n• Quiet, low volatility\n• AUD/NZD pairs active\n\nTOKYO (ASIAN): 12:00 AM - 9:00 AM\n• Moderate volatility\n• JPY pairs active\n• Good for range trading\n\nLONDON: 8:00 AM - 5:00 PM\n• HIGHEST volatility\n• EUR/GBP pairs active\n• Best for breakout trades\n• 30% of all forex volume\n\nNEW YORK: 1:00 PM - 10:00 PM\n• High volatility\n• USD pairs active\n• NFP released here\n\nLONDON/NY OVERLAP (1PM-5PM UTC):\n• Highest volatility\n• Best trading opportunities\n• Tightest spreads",
  },
  {
    keywords: [
      "best time to trade",
      "when to trade",
      "trading hours",
      "market hours",
    ],
    category: "Sessions",
    response:
      "Best times to trade forex:\n\n1. LONDON/NY OVERLAP (1PM-5PM UTC):\n   • Highest volatility and volume\n   • Tightest spreads\n   • Best for all strategies\n\n2. LONDON SESSION (8AM-5PM UTC):\n   • Great for EUR/GBP pairs\n   • Breakout strategies work well\n\n3. NEW YORK SESSION (1PM-10PM UTC):\n   • USD pairs move most\n   • Economic data releases\n\nAVOID:\n• Late Friday (low liquidity)\n• Asian session for high-impact trades\n• Major holidays (US/UK/Europe)\n• 30 minutes before/after major news",
  },

  // ==================== ADVANCED ====================
  {
    keywords: ["risk of ruin", "probability", "expectancy", "win rate math"],
    category: "Advanced",
    response:
      "Trading expectancy formula:\n\nExpectancy = (Win Rate × Average Win) - (Loss Rate × Average Loss)\n\nEXAMPLE:\nWin rate = 40%, Average win = $200, Average loss = $100\nExpectancy = (0.4 × $200) - (0.6 × $100) = $80 - $60 = +$20 per trade\n\nThis system is profitable despite only 40% win rate because wins are bigger than losses.\n\nRISK OF RUIN: Probability of losing your entire account.\n\nWith 1% risk per trade:\n• Need 100 consecutive losses to go to zero (virtually impossible)\nWith 10% risk per trade:\n• Need only 10 consecutive losses\n\nALWAYS risk 1-2% per trade to minimize risk of ruin.",
  },
  {
    keywords: ["correlation", "currency correlation", "correlated pairs"],
    category: "Advanced",
    response:
      "Currency correlation measures how pairs move together:\n\nPOSITIVE CORRELATION (move same direction):\n• EUR/USD and GBP/USD (correlation ~0.9)\n• AUD/USD and NZD/USD (~0.85)\n\nNEGATIVE CORRELATION (move opposite):\n• EUR/USD and USD/CHF (correlation ~-0.9)\n• GBP/USD and USD/JPY (~-0.5)\n\nWHY IT MATTERS:\n• Don't open multiple correlated trades (increases risk)\n• EUR/USD + GBP/USD = double exposure\n• If you're long EUR/USD and long USD/CHF, you're fighting yourself\n\nRISK MANAGEMENT: Never risk more than 3% total across correlated pairs.",
  },
  {
    keywords: ["swap", "swap fee", "overnight fee", "rollover", "swap rates"],
    category: "Advanced",
    response:
      "Swap (also called rollover or overnight fee) is interest paid or earned for holding positions overnight:\n\n• Positive swap: You EARN interest (holding higher-yield currency long)\n• Negative swap: You PAY interest\n\nWHEN APPLIED:\n• Typically at 5:00 PM New York time\n• Only for positions held overnight\n• Triple swap on Wednesdays (accounts for weekend)\n\nIMPORTANT:\n• Day traders avoid swap by closing before rollover\n• Swing/position traders must account for swap in strategy\n• Check your broker's swap rates before holding overnight",
  },
  {
    keywords: ["slippage", "what is slippage", "requote", "execution"],
    category: "Advanced",
    response:
      "Slippage occurs when your order is filled at a different price than requested:\n\nCAUSES:\n1. High volatility (news events)\n2. Low liquidity\n3. Market gaps\n\nTYPES:\n• Positive slippage: Better price than requested (rare)\n• Negative slippage: Worse price (more common)\n\nHOW TO MINIMIZE:\n1. Use limit orders instead of market orders\n2. Avoid trading during news\n3. Trade major pairs (more liquidity)\n4. Use brokers with fast execution\n\nSLIPPAGE IS NORMAL: Small slippage (1-2 pips) is normal and should be factored into your strategy.",
  },
  {
    keywords: [
      "prop firm",
      "prop trading",
      "funded account",
      "ftmo",
      "proprietary trading",
    ],
    category: "Advanced",
    response:
      "Prop firms provide capital to successful traders:\n\nHOW IT WORKS:\n1. Pay evaluation fee ($50-$500)\n2. Pass challenge (hit profit target without breaking rules)\n3. Get funded account ($10,000-$200,000)\n4. Profit split (typically 70-90% to you)\n\nCOMMON RULES:\n• Maximum daily loss (typically 5%)\n• Maximum total loss (typically 10%)\n• Minimum trading days\n• Profit target (typically 8-10%)\n\nPOPULAR FIRMS:\n• FTMO\n• MyForexFunds\n• The Funded Trader\n• E8 Funding\n\nTIPS:\n• Trade conservatively during evaluation\n• Focus on consistency, not big wins\n• Read all rules carefully",
  },
  {
    keywords: ["gold trading", "xauusd", "gold", "trade gold", "gold strategy"],
    category: "Advanced",
    response:
      "Gold (XAU/USD) trading specifics:\n\nCHARACTERISTICS:\n• High volatility\n• Safe haven asset\n• Moves inversely to USD (usually)\n• Best during London/NY sessions\n\nKEY FACTORS:\n• US Dollar strength\n• Interest rates\n• Inflation\n• Geopolitical events\n• Physical demand\n\nTRADING TIPS:\n• Wider stops needed ($3-10 per trade)\n• Watch for key levels ($2350, $2400, $2450)\n• Correlates with USD pairs\n• Use 4H/daily charts for clear levels\n• Be careful with leverage (gold moves fast)",
  },
];

export function searchKnowledge(query: string): string {
  const q = query.toLowerCase();

  for (const topic of FOREX_KNOWLEDGE_BASE) {
    for (const keyword of topic.keywords) {
      if (q.includes(keyword) || keyword.includes(q)) {
        return topic.response;
      }
    }
  }

  return "I don't have specific information on that topic. Try asking about: forex basics, pips, leverage, support/resistance, trends, technical analysis, fundamental analysis, trading strategies, risk management, trading psychology, market sessions, or advanced topics like prop firms and gold trading.";
}
