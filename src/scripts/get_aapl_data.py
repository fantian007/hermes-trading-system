#!/usr/bin/env python3
"""Get AAPL.US daily kline data and calculate Bollinger Bands (20,2)"""

import json
import sys

try:
    import yfinance as yf
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "yfinance", "-q", "--no-warn-script-location"])
    import yfinance as yf

import numpy as np
from datetime import datetime, timezone

# Download last 3 months of daily data
ticker = yf.Ticker("AAPL")
df = ticker.history(period="3mo", interval="1d")

if len(df) < 20:
    print(json.dumps({"error": f"Not enough data points: {len(df)}"}))
    sys.exit(1)

# Calculate Bollinger Bands (20, 2)
df['SMA20'] = df['Close'].rolling(window=20).mean()
df['STD20'] = df['Close'].rolling(window=20).std()
df['Upper'] = df['SMA20'] + 2 * df['STD20']
df['Lower'] = df['SMA20'] - 2 * df['STD20']
df['%B'] = (df['Close'] - df['Lower']) / (df['Upper'] - df['Lower'])
df['BandWidth'] = (df['Upper'] - df['Lower']) / df['SMA20'] * 100

# Latest values
latest = df.iloc[-1]
prev = df.iloc[-2]
prev5 = df.iloc[-5] if len(df) >= 5 else None

# Format dates
latest_date = latest.name.strftime('%Y-%m-%d') if hasattr(latest.name, 'strftime') else str(latest.name)
prev_date = prev.name.strftime('%Y-%m-%d') if hasattr(prev.name, 'strftime') else str(prev.name)

result = {
    "symbol": "AAPL.US",
    "data_source": "yfinance",
    "last_date": latest_date,
    "latest": {
        "close": round(float(latest['Close']), 2),
        "high": round(float(latest['High']), 2),
        "low": round(float(latest['Low']), 2),
        "volume": int(latest['Volume']),
        "sma20": round(float(latest['SMA20']), 2) if not np.isnan(latest['SMA20']) else None,
        "upper_band": round(float(latest['Upper']), 2) if not np.isnan(latest['Upper']) else None,
        "lower_band": round(float(latest['Lower']), 2) if not np.isnan(latest['Lower']) else None,
        "percent_b": round(float(latest['%B']), 4) if not np.isnan(latest['%B']) else None,
        "bandwidth_pct": round(float(latest['BandWidth']), 2) if not np.isnan(latest['BandWidth']) else None,
    },
    "prev_close": round(float(prev['Close']), 2),
    "prev_percent_b": round(float(prev['%B']), 4) if not np.isnan(prev['%B']) else None,
}

if prev5 is not None:
    result["close_5d_ago"] = round(float(prev5['Close']), 2)
    result["change_5d_pct"] = round((float(latest['Close']) / float(prev5['Close']) - 1) * 100, 2)

# Last 5 data points summary
recent = []
for i in range(max(0, len(df)-30), len(df)):
    row = df.iloc[i]
    d = row.name.strftime('%Y-%m-%d') if hasattr(row.name, 'strftime') else str(row.name)
    recent.append({
        "date": d,
        "close": round(float(row['Close']), 2),
        "%B": round(float(row['%B']), 4) if not np.isnan(row['%B']) else None,
        "bandwidth": round(float(row['BandWidth']), 2) if not np.isnan(row['BandWidth']) else None,
    })
result["recent_30"] = recent

# Check for squeeze (bandwidth near 6-month low)
bandwidths = df['BandWidth'].dropna()
current_bw = bandwidths.iloc[-1]
min_bw = bandwidths.min()
max_bw = bandwidths.max()
result["bandwidth_stats"] = {
    "current": round(float(current_bw), 2) if not np.isnan(current_bw) else None,
    "min_3mo": round(float(min_bw), 2) if not np.isnan(min_bw) else None,
    "max_3mo": round(float(max_bw), 2) if not np.isnan(max_bw) else None,
}

print(json.dumps(result, indent=2))
