#!/usr/bin/env python3
"""
Fetch historical stock data for backtesting from Yahoo Finance.
Outputs JSON that can be consumed by the backtest runner.

Usage: python3 scripts/fetch-backtest-data.py <SYMBOL> [DAYS]
Example: python3 scripts/fetch-backtest-data.py NVDA 180
Output: ./data/backtest/NVDA_180d.json
"""
import sys
import json
import time
import os
from urllib.request import urlopen, Request

def fetch_yahoo(symbol: str, days: int) -> list[dict]:
    """
    Fetch daily OHLCV data from Yahoo Finance.
    Uses the v8 chart API which returns up to ~730 days of daily data.
    Period 1: days ago, Period 2: now (in seconds)
    """
    period2 = int(time.time())
    period1 = period2 - (days + 60) * 86400  # extra 60 days for warmup

    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?period1={period1}&period2={period2}&interval=1d"
    req = Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        "Accept": "application/json",
    })

    with urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode())

    result = data.get("chart", {}).get("result", [])
    if not result:
        raise ValueError(f"No data for {symbol}: {data.get('chart', {}).get('error', 'unknown')}")

    meta = result[0]
    timestamps = meta.get("timestamp", [])
    indicators = meta.get("indicators", {})
    quotes = indicators.get("quote", [{}])[0]
    adjclose = indicators.get("adjclose", [{}])[0].get("adjclose", [])

    klines = []
    for i, ts in enumerate(timestamps):
        o = quotes.get("open", [None] * len(timestamps))[i]
        h = quotes.get("high", [None] * len(timestamps))[i]
        l = quotes.get("low", [None] * len(timestamps))[i]
        c = quotes.get("close", [None] * len(timestamps))[i]
        v = quotes.get("volume", [None] * len(timestamps))[i]
        ac = adjclose[i] if i < len(adjclose) else c

        if o is None or c is None or c == 0:
            continue

        # Format like longbridge output
        dt = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(ts))
        klines.append({
            "close": str(c),
            "high": str(h),
            "low": str(l),
            "open": str(o),
            "volume": str(v),
            "time": dt,
        })

    return klines


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/fetch-backtest-data.py <SYMBOL> [DAYS]")
        sys.exit(1)

    raw_symbol = sys.argv[1]
    days = int(sys.argv[2]) if len(sys.argv) > 2 else 180

    # Map common symbols: NVDA -> NVDA (US-listed)
    # Yahoo uses plain ticker without .US suffix
    symbol = raw_symbol.replace(".US", "").replace(".HK", ".HK").replace(".L", ".L")

    print(f"[fetch] Fetching {symbol} for {days} days from Yahoo Finance...")
    klines = fetch_yahoo(symbol, days)
    print(f"[fetch] Got {len(klines)} k-lines")

    # Save to data directory
    outdir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "backtest")
    os.makedirs(outdir, exist_ok=True)
    outfile = os.path.join(outdir, f"{symbol}_{days}d.json")
    with open(outfile, "w") as f:
        json.dump(klines, f, indent=2)

    print(f"[fetch] Saved to {outfile}")
    print(f"[fetch] Date range: {klines[0]['time'][:10]} ~ {klines[-1]['time'][:10]}")


if __name__ == "__main__":
    main()
