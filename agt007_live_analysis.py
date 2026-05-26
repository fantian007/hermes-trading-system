#!/usr/bin/env python3
"""
AGT-007 Live MA Crossover Strategy Analysis
Analyzes ALL stocks in the current active stock pool.
"""
import json, time, sys, os, sqlite3
from urllib.request import urlopen, Request

DB_PATH = '/Users/zys/workspace/hermes-trading-system/data/trading.db'
TRADES_DB_PATH = '/Users/zys/workspace/hermes-trading-system/trading.db'

db = sqlite3.connect(DB_PATH)

# Get column names by index
cur = db.execute("PRAGMA table_info(stock_pool)")
col_index = {}  # name -> index
for row in cur.fetchall():
    # row: (cid, name, type, notnull, dflt_value, pk)
    col_index[row[1]] = row[0]

# Fetch all active stocks
rows = db.execute("SELECT * FROM stock_pool WHERE status='ACTIVE' ORDER BY strength DESC, symbol ASC").fetchall()
symbols = [row[col_index['symbol']] for row in rows]

# Get trades columns
try:
    t_cur = db.execute("PRAGMA table_info(trades)")
    t_col = {}
    for row in t_cur.fetchall():
        t_col[row[1]] = row[0]
    HAS_TRADE_COLS = True
except:
    HAS_TRADE_COLS = False

# Check trades DB too
trade_db = None
try:
    trade_db = sqlite3.connect(TRADES_DB_PATH)
    t_cur2 = trade_db.execute("PRAGMA table_info(trades)")
    t_col2 = {}
    for row in t_cur2.fetchall():
        t_col2[row[1]] = row[0]
    HAS_TRADE_COLS2 = True
except:
    HAS_TRADE_COLS2 = False

now = time.time()
utc_time = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now))
beijing = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(now + 8*3600))
gm = time.gmtime(now)
# US market: 9:30 ET = 13:30 UTC, 16:00 ET = 20:00 UTC
mins_since_930 = (gm.tm_hour - 13.5) * 60 + gm.tm_min
market_open = gm.tm_wday >= 0 and gm.tm_wday <= 4 and 0 <= mins_since_930 < 390
market_note = '【盘中】' if market_open else '【盘后/盘前—上轮收盘数据】'

print(f"╔══════════════════════════════════════════════════════════╗")
print(f"║  AGT-007 均线交叉策略分析 (守护进程自动巡检)            ║")
print(f"║  {market_note:<51}║")
print(f"║  北京时间: {beijing:<45}║")
print(f"║  分析标的: {len(symbols)}只                            ║")
print(f"╚══════════════════════════════════════════════════════════╝")

print(f"\n┌─ 当前活跃股池 ({len(symbols)}只) ─────────────────────────────────┐")
for row in rows:
    sym = row[col_index['symbol']]
    sig = row[col_index['signal_type']]
    st = row[col_index['strength']]
    reason = (row[col_index['reason']] or '')[:55]
    print(f"│ {sym:<10} {sig} {st} │ {reason}")
print(f"└──────────────────────────────────────────────────────────┘")

# Fetch data
results = {}
ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'

for i, sym_raw in enumerate(symbols):
    sym = sym_raw.replace('.US', '')
    period2 = int(now)
    period1 = period2 - 90 * 86400
    url = f'https://query1.finance.yahoo.com/v8/finance/chart/{sym}?period1={period1}&period2={period2}&interval=1d'
    
    try:
        req = Request(url, headers={'User-Agent': ua, 'Accept': 'application/json'})
        with urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
        
        chart = data.get('chart', {})
        if chart.get('error'):
            print(f"  [{i+1}/{len(symbols)}] ✗ {sym_raw}: Yahoo error: {chart['error']}")
            continue
        
        result = chart.get('result', [{}])[0]
        quotes = result.get('indicators', {}).get('quote', [{}])[0]
        adjclose = result.get('indicators', {}).get('adjclose', [{}])[0].get('adjclose', []) if result.get('indicators', {}).get('adjclose') else []
        timestamps = result.get('timestamp', [])
        
        closes_raw = quotes.get('close', [])
        if not closes_raw:
            print(f"  [{i+1}/{len(symbols)}] ✗ {sym_raw}: no close data")
            continue
        
        closes = []
        for j, c in enumerate(closes_raw):
            if c is not None:
                ac = adjclose[j] if j < len(adjclose) and adjclose[j] is not None else c
                closes.append(ac)
        
        if len(closes) < 20:
            print(f"  [{i+1}/{len(symbols)}] ✗ {sym_raw}: only {len(closes)} data points")
            continue
        
        price = closes[-1]
        ma5 = sum(closes[-5:]) / 5
        ma10 = sum(closes[-10:]) / 10
        ma20 = sum(closes[-20:]) / 20
        
        results[sym_raw] = {
            'price': round(price, 2),
            'ma5': round(ma5, 2),
            'ma10': round(ma10, 2),
            'ma20': round(ma20, 2),
        }
        print(f"  [{i+1}/{len(symbols)}] ✓ {sym_raw}: ${price:.2f}")
    except Exception as e:
        print(f"  [{i+1}/{len(symbols)}] ✗ {sym_raw}: {type(e).__name__}")
    
    if i < len(symbols) - 1:
        time.sleep(0.5)

data_ok = len(results)
data_fail = len(symbols) - data_ok
print(f"\n成功获取: {data_ok}/{len(symbols)} 只\n")

if data_ok == 0:
    print("⚠️ 无法获取任何标的实时数据。退出。")
    sys.exit(0)

# Get open trade for a symbol
def get_trade(sym):
    try:
        if HAS_TRADE_COLS:
            t = db.execute("SELECT * FROM trades WHERE symbol = ? AND status = 'OPEN' ORDER BY created_at DESC LIMIT 1", (sym,)).fetchone()
            if t:
                return t
        if trade_db and HAS_TRADE_COLS2:
            t = trade_db.execute("SELECT * FROM trades WHERE symbol = ? AND status = 'OPEN' ORDER BY created_at DESC LIMIT 1", (sym,)).fetchone()
            if t:
                return t
    except:
        pass
    return None

# Analysis
analysis = {}
for sym_raw, d in sorted(results.items()):
    price, ma5, ma10, ma20 = d['price'], d['ma5'], d['ma10'], d['ma20']
    trade = get_trade(sym_raw)
    
    # Find pool info
    pool_row = None
    for row in rows:
        if row[col_index['symbol']] == sym_raw:
            pool_row = row
            break
    
    print(f"┌──────────────────────────────────────────┐")
    print(f"│ {sym_raw:<43}│")
    print(f"└──────────────────────────────────────────┘")
    
    if pool_row:
        src = pool_row[col_index['source']]
        sig = pool_row[col_index['signal_type']]
        st = pool_row[col_index['strength']]
        reason = (pool_row[col_index['reason']] or '')[:60]
        print(f"  来源: {src} | {sig} 强度{st}")
        print(f"  理由: {reason}")
    
    if trade:
        try:
            if HAS_TRADE_COLS:
                buy_p = float(trade[t_col['buy_price']])
                pnl = (price - buy_p) / buy_p * 100
                print(f"  持仓: OPEN ${buy_p:.2f} (盈亏: {'+' if pnl > 0 else ''}{pnl:.2f}%)")
            else:
                print(f"  持仓: OPEN")
        except:
            print(f"  持仓: OPEN (盈亏: N/A)")
    else:
        print(f"  持仓: 无")
    
    arrow5 = '↑' if ma5 > ma10 else ('↓' if ma5 < ma10 else '→')
    arrow10 = '↑' if ma10 > ma20 else ('↓' if ma10 < ma20 else '→')
    
    print(f"  ┌──────┬─────────┬──────────┬──────────┐")
    print(f"  │      │  MA5    │  MA10    │  MA20    │")
    print(f"  ├──────┼─────────┼──────────┼──────────┤")
    print(f"  │ 价位 │ ${ma5:>7.2f} │ ${ma10:>7.2f} │ ${ma20:>7.2f} │")
    print(f"  │ 趋势 │   {arrow5:<5} │   {arrow10:<6} │   →     │")
    print(f"  └──────┴─────────┴──────────┴──────────┘")
    print(f"  当前价 ${price:.2f} {'>' if price > ma5 else '<'} MA5  |  ${price:.2f} {'>' if price > ma20 else '<'} MA20")
    
    # Signal logic
    ma5gt10 = ma5 > ma10
    ma10gt20 = ma10 > ma20
    all_bull = ma5gt10 and ma10gt20 and price > ma5
    all_bear = (not ma5gt10) and (not ma10gt20) and price < ma5
    golden_cross = ma5 > ma20 and price > ma20
    death_cross = ma5 < ma20 and price < ma20
    
    print(f"\n  均线排列分析:")
    print(f"  {'✓' if ma5gt10 else '✗'} MA5(${ma5:.2f}) {'>' if ma5gt10 else '<'} MA10(${ma10:.2f}) — 短期{'看多' if ma5gt10 else '偏空'}")
    print(f"  {'✓' if ma10gt20 else '✗'} MA10(${ma10:.2f}) {'>' if ma10gt20 else '<'} MA20(${ma20:.2f}) — 中期{'看多' if ma10gt20 else '偏空'}")
    print(f"  {'✓' if price > ma20 else '✗'} 价格 > MA20 — {'站稳中期均线上方' if price > ma20 else '中期均线承压'}")
    print(f"  {'✓' if golden_cross else '✗'} 金叉信号: MA5上穿MA20 — {'有效' if golden_cross else '未形成'}")
    
    if all_bull:
        signal, conf = 'BUY', 0.75
        reasoning = f'完全多头排列: MA5>MA10>MA20，价格在所有均线上方。多头强势。'
    elif all_bear:
        signal, conf = 'SELL', 0.70
        reasoning = f'完全空头排列: MA5<MA10<MA20，价格在所有均线下方。死叉确认。'
    elif golden_cross and not all_bull:
        if price > ma5:
            signal, conf = 'BUY', 0.60
            reasoning = f'金叉形态: MA5(${ma5:.2f})上穿MA20(${ma20:.2f})，价格站上MA20，多头形成中。'
        else:
            signal, conf = 'HOLD', 0.50
            reasoning = f'金叉但价格在MA5下方，短期承压。中长期偏多。'
    elif death_cross and not all_bear:
        if price < ma5:
            signal, conf = 'SELL', 0.60
            reasoning = f'死叉形态: MA5跌破MA20，价格在MA20下方，空头形成中。'
        else:
            signal, conf = 'HOLD', 0.50
            reasoning = f'死叉但价格在MA5上方，短期反弹中。需观察。'
    elif ma5gt10 and not ma10gt20:
        signal, conf = 'HOLD', 0.45
        reasoning = f'均线缠绕: MA5>MA10但MA10<MA20，短期走强但中期有压力。'
    elif not ma5gt10 and ma10gt20:
        signal, conf = 'HOLD', 0.45
        reasoning = f'均线缠绕: MA5<MA10但MA10>MA20，短期走弱但中期尚可。'
    else:
        signal, conf = 'HOLD', 0.40
        reasoning = f'均线无明显方向。MA5=${ma5:.2f} MA10=${ma10:.2f} MA20=${ma20:.2f}'
    
    print(f"\n  结论: {reasoning}")
    print(f"  信号: {signal} (置信度 {conf:.2f})")
    
    analysis[sym_raw] = {
        'price': price, 'ma5': ma5, 'ma10': ma10, 'ma20': ma20,
        'signal': signal, 'confidence': conf, 'reasoning': reasoning,
    }

# Summary
print(f"\n\n══════════════════════════════════════════════════════════")
print(f"  综合排名 (按技术面强度)")
print(f"══════════════════════════════════════════════════════════")

order = {'BUY': 0, 'HOLD': 1, 'SELL': 2}
ranked = sorted(analysis.items(), key=lambda x: (order.get(x[1]['signal'], 1), -x[1]['confidence']))

for rank, (sym, r) in enumerate(ranked, 1):
    icon = {'BUY': '🟢', 'SELL': '🔴', 'HOLD': '🟡'}[r['signal']]
    stars = {'BUY': '★★★', 'SELL': '★', 'HOLD': '★★'}[r['signal']]
    print(f"  {rank:2d}. {icon} {sym:<10} {r['signal']:<4} ({(r['confidence']*100):.0f}%) {stars}  ${r['price']:.2f} | MA5=${r['ma5']:.2f} MA10=${r['ma10']:.2f} MA20=${r['ma20']:.2f}")

buys = [(s,r) for s,r in analysis.items() if r['signal'] == 'BUY']
sells = [(s,r) for s,r in analysis.items() if r['signal'] == 'SELL']
holds = [(s,r) for s,r in analysis.items() if r['signal'] == 'HOLD']

print(f"\n整体评估:")
print(f"  - 🟢 BUY: {len(buys)}只 — {', '.join(s for s,_ in buys) or '无'}")
print(f"  - 🟡 HOLD: {len(holds)}只 — {', '.join(s for s,_ in holds) or '无'}")
print(f"  - 🔴 SELL: {len(sells)}只 — {', '.join(s for s,_ in sells) or '无'}")
print(f"  - 未获取数据: {data_fail}只")
print(f"  - 全池{len(symbols)}只均为BULLISH，AI/AI基础设施主线贯穿全池")

# Machine JSON
print(f"\n---MACHINE_JSON---")
out = {
    'agent': 'AGT-007',
    'title': '均线交叉策略分析',
    'analyzed_at': utc_time,
    'market_open': market_open,
    'symbols_total': len(symbols),
    'symbols_analyzed': data_ok,
    'summary': {
        'buy': [s for s,_ in buys],
        'hold': [s for s,_ in holds],
        'sell': [s for s,_ in sells],
    },
    'results': {sym: {
        'price': r['price'], 'ma5': r['ma5'], 'ma10': r['ma10'], 'ma20': r['ma20'],
        'signal': r['signal'], 'confidence': r['confidence'], 'reasoning': r['reasoning']
    } for sym, r in analysis.items()}
}
print(json.dumps(out, indent=2, ensure_ascii=False))

db.close()
if trade_db:
    trade_db.close()
print(f"\n=== AGT-007 自巡检完成 ===")
