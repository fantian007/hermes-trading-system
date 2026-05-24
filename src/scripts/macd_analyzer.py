#!/usr/bin/env python3
"""MACD Analysis for AGT-002"""

import json
import math
import subprocess
import sys

def calc_ema(prices, period):
    """Calculate EMA"""
    k = 2.0 / (period + 1)
    ema = [prices[0]]  # init with first close
    for p in prices[1:]:
        ema.append(p * k + ema[-1] * (1 - k))
    return ema

def calc_macd(prices):
    """Calculate MACD (DIF, DEA, BAR)"""
    ema12 = calc_ema(prices, 12)
    ema26 = calc_ema(prices, 26)
    dif = [ema12[i] - ema26[i] for i in range(len(prices))]
    dea = calc_ema(dif, 9)
    bar = [2 * (dif[i] - dea[i]) for i in range(len(prices))]
    return dif, dea, bar

def get_kline_data(symbol):
    """Get kline data from analyze-and-vote.ts"""
    result = subprocess.run(
        ["npx", "tsx", "src/scripts/analyze-and-vote.ts",
         "--agent-id", "AGT-002", "--symbol", symbol],
        capture_output=True, text=True, timeout=120,
        cwd="/Users/zys/workspace/hermes-trading-system"
    )
    # Parse JSON from output
    output = result.stdout
    # Find first { and last }
    start = output.find('{')
    end = output.rfind('}')
    if start >= 0 and end > start:
        data = json.loads(output[start:end+1])
    else:
        raise ValueError(f"Cannot parse JSON output for {symbol}")
    
    klines = data.get("market", {}).get("kline", [])
    quote = data.get("market", {}).get("quote", {})
    closes = [float(k["close"]) for k in klines]
    return closes, quote, klines

def analyze_stock(symbol):
    """Full MACD analysis"""
    closes, quote, klines = get_kline_data(symbol)
    
    dif, dea, bar = calc_macd(closes)
    
    # Latest values
    latest_dif = dif[-1]
    latest_dea = dea[-1]
    latest_bar = bar[-1]
    
    # Cross detection (last 3 bars)
    cross_up = False
    cross_down = False
    for i in range(-3, 0):
        if dif[i-1] < dea[i-1] and dif[i] >= dea[i]:
            cross_up = True
        if dif[i-1] > dea[i-1] and dif[i] <= dea[i]:
            cross_down = True
    
    # DIF trend (last 3)
    dif_trend = "flat"
    if dif[-1] > dif[-3] + 0.1:
        dif_trend = "rising"
    elif dif[-1] < dif[-3] - 0.1:
        dif_trend = "falling"
    
    # Bar trend
    bar_trend = "shrinking"
    if abs(bar[-1]) > abs(bar[-3]) + 0.01:
        bar_trend = "expanding"
    elif abs(bar[-1]) < abs(bar[-3]) - 0.01:
        bar_trend = "shrinking"
    else:
        bar_trend = "neutral"
    
    # Zero axis position
    zero_axis = "above" if latest_dif > 0 else ("below" if latest_dif < 0 else "on")
    
    # Divergence detection (compare price vs DIF over last 20 bars)
    divergence = "none"
    lookback = min(20, len(closes))
    recent_prices = closes[-lookback:]
    recent_dif = dif[-lookback:]
    
    # Check bearish divergence (higher price high, lower DIF high)
    price_max_idx = recent_prices.index(max(recent_prices))
    dif_max_idx = recent_dif.index(max(recent_dif))
    if price_max_idx > dif_max_idx and max(recent_prices) > recent_prices[dif_max_idx]:
        divergence = "bearish_divergence"
    
    # Check bullish divergence (lower price low, higher DIF low)
    price_min_idx = recent_prices.index(min(recent_prices))
    dif_min_idx = recent_dif.index(min(recent_dif))
    if price_min_idx > dif_min_idx and min(recent_prices) < recent_prices[dif_min_idx]:
        divergence = "bullish_divergence"
    
    # Signal decision
    last_close = float(klines[-1]["close"])
    prev_close = float(quote.get("prev_close", last_close))
    current_price = float(quote.get("last", prev_close))
    
    # Generate signal
    signal = "HOLD"
    confidence = 0.5
    price_range = (current_price * 0.98, current_price * 1.02)
    
    if cross_up and zero_axis == "above" and bar_trend == "expanding":
        signal = "BUY"
        confidence = 0.75
        price_range = (current_price, current_price * 1.03)
    elif cross_up and zero_axis == "below" and dif_trend == "rising":
        signal = "BUY"
        confidence = 0.60
        price_range = (current_price * 0.99, current_price * 1.02)
    elif cross_down and zero_axis == "below" and bar_trend == "expanding":
        signal = "SELL"
        confidence = 0.75
        price_range = (current_price * 0.97, current_price)
    elif cross_down and zero_axis == "above" and dif_trend == "falling":
        signal = "SELL"
        confidence = 0.60
        price_range = (current_price * 0.98, current_price * 1.01)
    
    # Override for divergence
    if divergence == "bearish_divergence" and signal == "BUY":
        confidence -= 0.2
        signal = "HOLD"
    elif divergence == "bullish_divergence" and signal == "SELL":
        confidence -= 0.2
        signal = "HOLD"
    
    return {
        "symbol": symbol,
        "last_close": last_close,
        "current_price": round(current_price, 2),
        "change_pct": quote.get("change_percentage", "N/A"),
        "macd": {
            "dif": round(latest_dif, 4),
            "dea": round(latest_dea, 4),
            "bar": round(latest_bar, 4),
            "zero_axis": zero_axis,
            "dif_trend": dif_trend,
            "bar_trend": bar_trend,
        },
        "cross": "golden" if cross_up else ("death" if cross_down else "none"),
        "divergence": divergence,
        "signal": signal,
        "confidence": round(confidence, 2),
        "price_range": [round(price_range[0], 2), round(price_range[1], 2)],
        "price": current_price,
    }

if __name__ == "__main__":
    symbols = ["NVDA.US", "MSFT.US", "AAPL.US", "AMD.US"]
    results = []
    for s in symbols:
        try:
            result = analyze_stock(s)
            results.append(result)
            print(f"✓ {s} analyzed", file=sys.stderr)
        except Exception as e:
            print(f"✗ {s} failed: {e}", file=sys.stderr)
            results.append({"symbol": s, "error": str(e)})
    
    print(json.dumps(results, indent=2))
