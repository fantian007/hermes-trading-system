"""
CrewAI Trading System — Streamlit Dashboard
"""

import streamlit as st
import pandas as pd
import time
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from crewai_trading.tools.db_tools import DbTools
from crewai_trading.tools.market_tools import MarketTools

st.set_page_config(page_title="AI 选举交易系统", page_icon="📊", layout="wide")

# ── 主题 ──────────────────────────────────────────
st.markdown("""
<style>
* { font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
[data-testid="stAppViewContainer"] { background: #0f0f13; }
[data-testid="stHeader"] { background: transparent; }
[data-testid="stSidebar"] { background: #16161d; border-right: 1px solid #1e1e2a; }
[data-testid="stSidebarContent"] { background: #16161d; }
.stTabs [data-baseweb="tab-list"] { gap: 0; background: #16161d; padding: 8px 16px; border-radius: 12px; border: 1px solid #1e1e2a; margin-bottom: 24px; }
.stTabs [data-baseweb="tab"] { border-radius: 8px; padding: 8px 20px; font-weight: 500; font-size: 14px; color: #6b7280; }
.stTabs [aria-selected="true"] { background: #2563eb; color: white !important; }
[data-testid="stMetricLabel"] { color: #9ca3af !important; font-size: 13px !important; font-weight: 500 !important; }
[data-testid="stMetricValue"] { color: #f3f4f6 !important; font-size: 28px !important; font-weight: 700 !important; }
.stButton button { background: #2563eb; color: white; border: none; border-radius: 8px; font-weight: 600; padding: 8px 20px; width: 100%; }
.stButton button:hover { background: #1d4ed8; }
.badge { display: inline-block; padding: 2px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; }
.badge-green { background: rgba(34,197,94,0.15); color: #22c55e; }
.badge-red { background: rgba(239,68,68,0.15); color: #ef4444; }
.card { background: #16161d; border: 1px solid #1e1e2a; border-radius: 12px; padding: 20px; }
.card-label { color: #9ca3af; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
.card-value { color: #f3f4f6; font-size: 24px; font-weight: 700; }
</style>
""", unsafe_allow_html=True)

# ── 数据缓存 ─────────────────────────────────────
@st.cache_data(ttl=30)
def get_positions_data(): return DbTools.get_positions()
@st.cache_data(ttl=60)
def get_account_data(): return DbTools.get_account()
@st.cache_data(ttl=30)
def get_pool_data(): return DbTools.get_pool()
@st.cache_data(ttl=30)
def get_trades_data(): return DbTools.get_trades()
@st.cache_data(ttl=10)
def get_quote_data(s): return MarketTools.get_quote(s)
@st.cache_data(ttl=60)
def get_strategy_count():
    from crewai_trading.strategies.core_strategies import CORE_STRATEGIES
    from crewai_trading.strategies.extra_strategies import EXTRA_STRATEGIES
    from crewai_trading.strategies.advanced_strategies import ADVANCED_STRATEGIES
    return len(CORE_STRATEGIES) + len(EXTRA_STRATEGIES) + len(ADVANCED_STRATEGIES)

# ── 侧边栏 ───────────────────────────────────────
with st.sidebar:
    st.markdown("<div style='font-size:22px;font-weight:700;color:#f3f4f6;padding:16px 0;'>🧠 AI 选举交易系统</div>", unsafe_allow_html=True)
    st.markdown("<hr style='border-color:#1e1e2a;'>", unsafe_allow_html=True)
    st.markdown("<div style='color:#9ca3af;font-size:13px;font-weight:600;text-transform:uppercase;margin-bottom:12px;'>系统状态</div>", unsafe_allow_html=True)
    try:
        account = get_account_data()
        if account and "error" not in account:
            v = account.get("net_assets", account.get("total_assets", 0))
            if isinstance(v, (int, float)): st.metric("净资产", f"${v:,.2f}")
    except: pass
    st.markdown(f"<div style='margin:8px 0;'><span style='color:#9ca3af;font-size:13px;'>策略视角</span><span style='color:#f3f4f6;font-size:16px;font-weight:600;float:right;'>{get_strategy_count()}</span></div>", unsafe_allow_html=True)
    st.markdown(f"<div style='margin:8px 0;'><span style='color:#9ca3af;font-size:13px;'>常驻Agent</span><span style='color:#f3f4f6;font-size:16px;font-weight:600;float:right;'>10</span></div>", unsafe_allow_html=True)
    st.markdown(f"<div style='margin:8px 0;'><span style='color:#9ca3af;font-size:13px;'>更新时间</span><span style='color:#f3f4f6;font-size:13px;float:right;'>{datetime.now().strftime('%H:%M:%S')}</span></div>", unsafe_allow_html=True)
    st.markdown("<hr style='border-color:#1e1e2a;'>", unsafe_allow_html=True)
    if st.button("🔄 刷新数据"): st.cache_data.clear(); st.rerun()
    if st.button("🔍 持仓分析"):
        from crewai_trading.crew.ceo_loop import CEOMainLoop; CEOMainLoop()._execute_position_analysis(); st.success("已触发"); time.sleep(1)
    if st.button("📋 系统巡检"):
        from crewai_trading.crew.patrol_crew import create_patrol_crew; create_patrol_crew().kickoff(); st.success("已触发"); time.sleep(1)
    st.markdown("<hr style='border-color:#1e1e2a;'>", unsafe_allow_html=True)
    st.caption("Powered by DeepSeek · Longbridge")

# ── 顶部概览卡片 ────────────────────────────────
positions = get_positions_data()
total_mv = 0; total_pnl = 0
if positions and isinstance(positions, list):
    for p in positions:
        if isinstance(p, dict) and "error" not in p:
            qty = float(p.get("quantity", 0))
            cost = float(p.get("buy_price", 0))
            quote = get_quote_data(p.get("symbol", ""))
            price = float(quote.get("last", quote.get("price", 0))) if isinstance(quote, dict) and "error" not in quote else 0
            total_mv += qty * price
            total_pnl += (price - cost) * qty

c1, c2, c3, c4 = st.columns(4)
with c1: st.markdown(f"<div class='card'><div class='card-label'>持仓市值</div><div class='card-value'>${total_mv:,.2f}</div></div>", unsafe_allow_html=True)
with c2: st.markdown(f"<div class='card'><div class='card-label'>浮动盈亏</div><div class='card-value' style='color:{'#22c55e' if total_pnl>=0 else '#ef4444'}'>{'+' if total_pnl>=0 else ''}${total_pnl:,.2f}</div></div>", unsafe_allow_html=True)
with c3: st.markdown(f"<div class='card'><div class='card-label'>持仓数量</div><div class='card-value'>{len(positions) if positions and isinstance(positions,list) else 0}</div></div>", unsafe_allow_html=True)
with c4: st.markdown(f"<div class='card'><div class='card-label'>策略视角</div><div class='card-value'>{get_strategy_count()}</div></div>", unsafe_allow_html=True)

# ── Tabs ──────────────────────────────────────────
t1, t2, t3, t4 = st.tabs(["📈 持仓", "🗳️ 交易记录", "📋 股池", "📜 日志"])

with t1:
    st.markdown("<div style='font-size:18px;font-weight:600;color:#f3f4f6;margin-bottom:16px;'>当前持仓</div>", unsafe_allow_html=True)
    if positions and isinstance(positions, list) and len(positions) > 0:
        rows = []
        for p in positions:
            if isinstance(p, dict) and "error" not in p:
                symbol = p.get("symbol", "")
                qty = float(p.get("quantity", 0))
                cost = float(p.get("buy_price", 0))
                quote = get_quote_data(symbol)
                price = float(quote.get("last", quote.get("price", 0))) if isinstance(quote, dict) and "error" not in quote else 0
                mv = qty * price
                pnl = (price - cost) * qty
                pnl_pct = ((price - cost) / cost * 100) if cost > 0 else 0
                pnl_color = "#22c55e" if pnl >= 0 else "#ef4444"
                pnl_sign = "+" if pnl >= 0 else ""
                badge = '<span class="badge badge-green">盈利</span>' if pnl >= 0 else '<span class="badge badge-red">亏损</span>'
                rows.append({
                    "标的": f"<b>{symbol}</b>",
                    "数量": int(qty),
                    "成本": f"${cost:.2f}",
                    "现价": f"${price:.2f}" if price > 0 else "—",
                    "市值": f"${mv:,.2f}",
                    "盈亏": f'<span style="color:{pnl_color}">{pnl_sign}${pnl:,.2f}</span>',
                    "收益率": f'<span style="color:{pnl_color}">{pnl_sign}{pnl_pct:.2f}%</span>',
                    "状态": badge,
                })
        st.write(pd.DataFrame(rows).to_html(escape=False, index=False), unsafe_allow_html=True)
    else:
        st.markdown("<div style='color:#6b7280;text-align:center;padding:48px;'>暂无持仓数据</div>", unsafe_allow_html=True)

    # ── 排序表格（不覆盖原始数据） ────────────────
    sort_col = st.selectbox("排序方式", ["收益率(降序)", "收益率(升序)", "市值(降序)", "市值(升序)", "盈亏(降序)", "盈亏(升序)"], label_visibility="collapsed")
    if rows:
        df_display = pd.DataFrame(rows)
        asc = True if "升序" in sort_col else False
        col_map = {"收益率": "收益率", "市值": "市值", "盈亏": "盈亏"}
        sort_key = next(v for k,v in col_map.items() if k in sort_col)
        df_display = df_display.sort_values(by=sort_key, ascending=asc, key=lambda x: x.str.extract(r'[-+]?\d+\.?\d*', expand=False).astype(float) if x.dtype == object else x)
        st.dataframe(df_display, use_container_width=True, hide_index=True)

with t2:
    st.markdown("<div style='font-size:18px;font-weight:600;color:#f3f4f6;margin-bottom:16px;'>交易记录</div>", unsafe_allow_html=True)
    try:
        trades = get_trades_data()
        if trades and isinstance(trades, list):
            rows = []
            for t in trades[-50:]:
                if isinstance(t, dict):
                    d = t.get("direction", t.get("side", ""))
                    badge = '<span class="badge badge-green">买入</span>' if d in ("BUY","LONG") else '<span class="badge badge-red">卖出</span>'
                    pnl = t.get("pnl")
                    pnl_str = "—"
                    if pnl and float(pnl) != 0:
                        pnl_color = "#22c55e" if float(pnl) >= 0 else "#ef4444"
                        pnl_sign = "+" if float(pnl) >= 0 else ""
                        pnl_str = f'<span style="color:{pnl_color}">{pnl_sign}${float(pnl):,.2f}</span>'
                    price = t.get("price", t.get("buy_price", 0))
                    price_str = f"${float(price):.2f}" if price else "—"
                    rows.append({
                        "标的": t.get("symbol", "—"),
                        "方向": badge,
                        "数量": t.get("quantity", 0),
                        "价格": price_str,
                        "盈亏": pnl_str,
                        "时间": str(t.get("created_at", t.get("buy_time", "—")))[:19],
                    })
            if rows:
                st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)
            else:
                st.markdown("<div style='color:#6b7280;text-align:center;padding:48px;'>暂无交易记录</div>", unsafe_allow_html=True)
        else:
            st.markdown("<div style='color:#6b7280;text-align:center;padding:48px;'>暂无交易记录</div>", unsafe_allow_html=True)
    except:
        st.markdown("<div style='color:#ef4444;text-align:center;padding:48px;'>读取失败</div>", unsafe_allow_html=True)

with t3:
    st.markdown("<div style='font-size:18px;font-weight:600;color:#f3f4f6;margin-bottom:16px;'>候选股池</div>", unsafe_allow_html=True)
    try:
        pool = get_pool_data()
        if pool and isinstance(pool, list):
            bullish = sum(1 for p in pool if isinstance(p, dict) and p.get("signal_type") == "BULLISH")
            bearish = sum(1 for p in pool if isinstance(p, dict) and p.get("signal_type") == "BEARISH")
            st.markdown(f"<div style='display:flex;gap:16px;margin-bottom:16px;'><div style='background:#16161d;border:1px solid #1e1e2a;border-radius:8px;padding:12px 20px;'><span style='color:#9ca3af;font-size:12px;'>总数</span><span style='color:#f3f4f6;font-size:20px;font-weight:700;margin-left:12px;'>{len(pool)}</span></div><div style='background:#16161d;border:1px solid #1e1e2a;border-radius:8px;padding:12px 20px;'><span style='color:#9ca3af;font-size:12px;'>利好</span><span style='color:#22c55e;font-size:20px;font-weight:700;margin-left:12px;'>{bullish}</span></div><div style='background:#16161d;border:1px solid #1e1e2a;border-radius:8px;padding:12px 20px;'><span style='color:#9ca3af;font-size:12px;'>利空</span><span style='color:#ef4444;font-size:20px;font-weight:700;margin-left:12px;'>{bearish}</span></div></div>", unsafe_allow_html=True)
            rows = []
            for item in pool:
                if isinstance(item, dict):
                    sig = item.get("signal_type", "")
                    badge = f'<span class="badge {"badge-green" if sig=="BULLISH" else "badge-red"}">{"利好" if sig=="BULLISH" else "利空"}</span>'
                    s = "⭐" * int(item.get("strength", 0))
                    rows.append({"标的": f"<b>{item.get('symbol','')}</b>", "信号": badge, "强度": s, "来源": (item.get("source","") or "")[:30], "理由": (item.get("reason","") or "")[:60], "时间": str(item.get("added_at","") or "")[:19]})
            if rows:
                st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)
        else:
            st.markdown("<div style='color:#6b7280;text-align:center;padding:48px;'>股池为空</div>", unsafe_allow_html=True)
    except:
        st.markdown("<div style='color:#ef4444;text-align:center;padding:48px;'>读取失败</div>", unsafe_allow_html=True)

with t4:
    st.markdown("<div style='font-size:18px;font-weight:600;color:#f3f4f6;margin-bottom:16px;'>系统日志</div>", unsafe_allow_html=True)
    log_lines = st.slider("显示行数", 20, 300, 80, label_visibility="collapsed")
    log_path = Path(__file__).resolve().parent.parent / "ceo_loop.log"
    logs = []
    if log_path.exists():
        with open(log_path) as f:
            logs = f.read().strip().split("\n")
    logs = logs[-log_lines:]
    st.markdown(f'<div style="background:#0d0d11;border:1px solid #1e1e2a;border-radius:8px;padding:16px;font-family:monospace;font-size:12px;line-height:1.6;color:#6b7280;height:500px;overflow-y:auto;">{"<br>".join(logs)}</div>', unsafe_allow_html=True)
    if st.button("🔄 刷新日志"): st.rerun()

# ── 自动刷新 ─────────────────────────────────────
st.markdown("<hr style='border-color:#1e1e2a;'>", unsafe_allow_html=True)
if 'auto_refresh' not in st.session_state: st.session_state.auto_refresh = False
auto = st.checkbox("🔄 自动刷新（每30秒）", value=st.session_state.auto_refresh)
if auto:
    st.session_state.auto_refresh = True
    time.sleep(30)
    st.cache_data.clear()
    st.rerun()
