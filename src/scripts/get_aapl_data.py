#!/Library/Frameworks/Python.framework/Versions/3.12/bin/python3
"""Get AAPL.US daily kline data and calculate Bollinger Bands (20,2)"""
import json, sys
import yfinance as yf
import numpy as np

ticker = yf.Ticker("AAPL")
df = ticker.history(period="3mo", interval="1d")
if len(df) < 20:
    print(json.dumps({"error": f"Not enough data: {len(df)} points"}))
    sys.exit(1)

df['SMA20'] = df['Close'].rolling(window=20).mean()
df['STD20'] = df['Close'].rolling(window=20).std()
df['Upper'] = df['SMA20'] + 2 * df['STD20']
df['Lower'] = df['SMA20'] - 2 * df['STD20']
df['%B'] = (df['Close'] - df['Lower']) / (df['Upper'] - df['Lower'])
df['BandWidth'] = (df['Upper'] - df['Lower']) / df['SMA20'] * 100

latest = df.iloc[-1]
prev = df.iloc[-2]
prev5 = df.iloc[-5] if len(df) >= 5 else None
latest_date = latest.name.strftime('%Y-%m-%d') if hasattr(latest.name, 'strftime') else str(latest.name)

def r(v):
    """Round a value, handling NaN"""
    if v is None:
        return None
    try:
        vf = float(v)
        if np.isnan(vf):
            return None
        return round(vf, 2)
    except (ValueError, TypeError):
        return None

result = {
    "symbol": "AAPL.US",
    "data_source": "yfinance",
    "last_date": latest_date,
    "latest": {
        "close": r(latest['Close']),
        "high": r(latest['High']),
        "low": r(latest['Low']),
        "volume": int(latest['Volume']),
        "sma20": r(latest['SMA20']),
        "upper_band": r(latest['Upper']),
        "lower_band": r(latest['Lower']),
        "percent_b": r(latest['%B']),
        "bandwidth_pct": r(latest['BandWidth']),
    },
    "prev_close": r(prev['Close']),
    "prev_percent_b": r(prev['%B']),
}
if prev5 is not None:
    result["close_5d_ago"] = r(prev5['Close'])
    result["change_5d_pct"] = round((float(latest['Close'])/float(prev5['Close'])-1)*100, 2)

bandwidths = df['BandWidth'].dropna()
result["bandwidth_stats"] = {
    "current": r(bandwidths.iloc[-1]),
    "min_3mo": r(bandwidths.min()),
    "max_3mo": r(bandwidths.max()),
}

recent = []
for i in range(max(0, len(df)-30), len(df)):
    row = df.iloc[i]
    d = row.name.strftime('%Y-%m-%d') if hasattr(row.name, 'strftime') else str(row.name)
    recent.append({
        "date": d, "close": r(row['Close']),
        "%B": r(row['%B']),
        "bandwidth": r(row['BandWidth'])
    })
result["recent_30"] = recent
print(json.dumps(result, indent=2))
