"""CrewAI Trading System — Extra Strategies (CAT-001~020)"""

import math
from typing import Dict, Any
from crewai_trading.strategies.base_strategy import BaseStrategy


class CAT001_DualMACrossover(BaseStrategy):
    name = "CAT-001 双均线交叉追踪"
    category = "趋势跟踪"
    def execute(self, symbol: str, price_data: Dict) -> Dict:
        closes = price_data.get("closes", [])
        if len(closes) < 50:
            return {"direction": "HOLD", "confidence": 0.5, "reasoning": "数据不足"}
        ma5 = sum(closes[-5:]) / 5
        ma20 = sum(closes[-20:]) / 20
        ma50 = sum(closes[-50:]) / 50
        if ma5 > ma20 > ma50:
            return {"direction": "BUY", "confidence": 0.65, "reasoning": f"MA5({ma5:.2f})>MA20({ma20:.2f})>MA50({ma50:.2f})多头排列"}
        elif ma5 < ma20 < ma50:
            return {"direction": "SELL", "confidence": 0.65, "reasoning": f"MA5({ma5:.2f})<MA20({ma20:.2f})<MA50({ma50:.2f})空头排列"}
        return {"direction": "HOLD", "confidence": 0.50, "reasoning": "均线粘合无方向"}


class CAT002_MACDDivergence(BaseStrategy):
    name = "CAT-002 MACD背离"
    category = "反转"
    def execute(self, symbol: str, price_data: Dict) -> Dict:
        closes = price_data.get("closes", [])
        if len(closes) < 30:
            return {"direction": "HOLD", "confidence": 0.5, "reasoning": "数据不足"}
        ema12 = sum(closes[-12:]) / 12
        ema26 = sum(closes[-26:]) / 26
        macd = ema12 - ema26
        recent_high = max(closes[-10:])
        prev_high = max(closes[-20:-10])
        if recent_high > prev_high and macd < 0:
            return {"direction": "SELL", "confidence": 0.55, "reasoning": "价格新高但MACD走弱，潜在顶背离"}
        recent_low = min(closes[-10:])
        prev_low = min(closes[-20:-10])
        if recent_low < prev_low and macd > 0:
            return {"direction": "BUY", "confidence": 0.55, "reasoning": "价格新低但MACD走强，潜在底背离"}
        return {"direction": "HOLD", "confidence": 0.50, "reasoning": f"MACD={macd:.2f}，无明显背离"}


class CAT003_KeltnerChannel(BaseStrategy):
    name = "CAT-003 凯尔特纳通道"
    category = "趋势/波动率"
    def execute(self, symbol: str, price_data: Dict) -> Dict:
        closes = price_data.get("closes", [])
        highs = price_data.get("highs", closes)
        lows = price_data.get("lows", closes)
        if len(closes) < 20:
            return {"direction": "HOLD", "confidence": 0.5, "reasoning": "数据不足"}
        ema20 = sum(closes[-20:]) / 20
        tr = [max(highs[i] - lows[i], abs(highs[i] - closes[i-1]), abs(lows[i] - closes[i-1])) for i in range(1, len(closes))]
        atr = sum(tr[-14:]) / min(14, len(tr)) if tr else 1
        upper = ema20 + 2 * atr
        lower = ema20 - 2 * atr
        price = closes[-1]
        if price > upper:
            return {"direction": "BUY", "confidence": 0.60, "reasoning": f"价格{price:.2f}突破上轨{upper:.2f}，强势"}
        elif price < lower:
            return {"direction": "SELL", "confidence": 0.60, "reasoning": f"价格{price:.2f}跌破下轨{lower:.2f}，弱势"}
        return {"direction": "HOLD", "confidence": 0.50, "reasoning": "价格在通道内运行"}


class CAT004_ParabolicSAR(BaseStrategy):
    name = "CAT-004 抛物线转向"
    category = "趋势跟踪"
    def execute(self, symbol: str, price_data: Dict) -> Dict:
        closes = price_data.get("closes", [])
        if len(closes) < 10:
            return {"direction": "HOLD", "confidence": 0.5, "reasoning": "数据不足"}
        price = closes[-1]
        prev_price = closes[-2]
        ma5 = sum(closes[-5:]) / 5
        if price > ma5 and prev_price < sum(closes[-6:-1]) / 5:
            return {"direction": "BUY", "confidence": 0.55, "reasoning": f"价格{price:.2f}上穿MA5{ma5:.2f}，SAR翻转向上"}
        elif price < ma5 and prev_price > sum(closes[-6:-1]) / 5:
            return {"direction": "SELL", "confidence": 0.55, "reasoning": f"价格{price:.2f}下穿MA5{ma5:.2f}，SAR翻转向下"}
        return {"direction": "HOLD", "confidence": 0.50, "reasoning": "趋势方向未变"}


class CAT005_VWAP(BaseStrategy):
    name = "CAT-005 VWAP"
    category = "日内动量"
    def execute(self, symbol: str, price_data: Dict) -> Dict:
        closes = price_data.get("closes", [])
        volumes = price_data.get("volumes", [1]*len(closes))
        if len(closes) < 5:
            return {"direction": "HOLD", "confidence": 0.5, "reasoning": "数据不足"}
        total_pv = sum(c * v for c, v in zip(closes, volumes))
        total_v = sum(volumes)
        vwap = total_pv / total_v if total_v > 0 else closes[-1]
        price = closes[-1]
        if price > vwap * 1.01:
            return {"direction": "BUY", "confidence": 0.55, "reasoning": f"价格{price:.2f}高于VWAP{vwap:.2f}，偏强"}
        elif price < vwap * 0.99:
            return {"direction": "SELL", "confidence": 0.55, "reasoning": f"价格{price:.2f}低于VWAP{vwap:.2f}，偏弱"}
        return {"direction": "HOLD", "confidence": 0.50, "reasoning": "价格围绕VWAP震荡"}


class CAT006_VolumeProfile(BaseStrategy):
    name = "CAT-006 成交量分布"
    category = "微观结构"
    def execute(self, symbol: str, price_data: Dict) -> Dict:
        return {"direction": "HOLD", "confidence": 0.50, "reasoning": "成交量分布 — 需专业数据"}

class CAT007_PairsTrading(BaseStrategy):
    name = "CAT-007 配对套利"
    category = "套利"
    def execute(self, symbol: str, price_data: Dict) -> Dict:
        return {"direction": "HOLD", "confidence": 0.50, "reasoning": "配对套利 — 需双标的价差数据"}

class CAT008_TripleScreen(BaseStrategy):
    name = "CAT-008 三屏交易"
    category = "多时间框架"
    def execute(self, symbol: str, price_data: Dict) -> Dict:
        closes = price_data.get("closes", [])
        if len(closes) < 50:
            return {"direction": "HOLD", "confidence": 0.5, "reasoning": "数据不足"}
        weekly_ma = sum(closes[-20:]) / 20  # 简化
        daily_ma = sum(closes[-5:]) / 5
        price = closes[-1]
        if price > weekly_ma and price > daily_ma:
            return {"direction": "BUY", "confidence": 0.60, "reasoning": "周线向上+日线向上，三屏共振做多"}
        elif price < weekly_ma and price < daily_ma:
            return {"direction": "SELL", "confidence": 0.60, "reasoning": "周线向下+日线向下，三屏共振做空"}
        return {"direction": "HOLD", "confidence": 0.50, "reasoning": "方向不一致，等待信号同步"}

class CAT009_CrossSectionalMomentum(BaseStrategy):
    name = "CAT-009 截面动量"
    category = "动量"
    def execute(self, symbol: str, price_data: Dict) -> Dict:
        closes = price_data.get("closes", [])
        if len(closes) < 120:
            return {"direction": "HOLD", "confidence": 0.5, "reasoning": "数据不足"}
        ret_6m = (closes[-1] - closes[-120]) / closes[-120] * 100
        if ret_6m > 20:
            return {"direction": "BUY", "confidence": 0.65, "reasoning": f"6个月涨幅{ret_6m:.1f}%，强者恒强"}
        elif ret_6m < -20:
            return {"direction": "SELL", "confidence": 0.65, "reasoning": f"6个月跌幅{ret_6m:.1f}%，继续走弱可能"}
        return {"direction": "HOLD", "confidence": 0.50, "reasoning": f"6个月涨幅{ret_6m:.1f}%，动量不明显"}

class CAT010_LongTermContrarian(BaseStrategy):
    name = "CAT-010 长期反转"
    category = "反转/价值"
    def execute(self, symbol: str, price_data: Dict) -> Dict:
        closes = price_data.get("closes", [])
        if len(closes) < 60:
            return {"direction": "HOLD", "confidence": 0.5, "reasoning": "数据不足"}
        ret_3m = (closes[-1] - closes[-60]) / closes[-60] * 100
        if ret_3m < -15:
            return {"direction": "BUY", "confidence": 0.55, "reasoning": f"3个月跌幅{ret_3m:.1f}%，过度反应，预期反转"}
        elif ret_3m > 25:
            return {"direction": "SELL", "confidence": 0.55, "reasoning": f"3个月涨幅{ret_3m:.1f}%，过度乐观，预期回调"}
        return {"direction": "HOLD", "confidence": 0.50, "reasoning": "无极端涨跌"}


class CAT011_ADX(BaseStrategy):
    name = "CAT-011 ADX趋势强度"
    category = "趋势/过滤"
    def execute(self, symbol: str, price_data: Dict) -> Dict:
        closes = price_data.get("closes", [])
        if len(closes) < 20:
            return {"direction": "HOLD", "confidence": 0.5, "reasoning": "数据不足"}
        # 简化ADX: 用价格变化率代替
        changes = [abs(closes[i] - closes[i-1]) / closes[i-1] * 100 for i in range(1, len(closes))]
        adx = sum(changes[-14:]) / min(14, len(changes)) * 10
        if adx > 25:
            trend_up = closes[-1] > closes[-5]
            return {"direction": "BUY" if trend_up else "SELL", "confidence": 0.55,
                    "reasoning": f"ADX={adx:.1f}>25，趋势明确，方向{'向上' if trend_up else '向下'}"}
        return {"direction": "HOLD", "confidence": 0.50, "reasoning": f"ADX={adx:.1f}<25，震荡市不入场"}

class CAT012_TripleResonance(BaseStrategy):
    name = "CAT-012 三重共振"
    category = "震荡"
    def execute(self, symbol: str, price_data: Dict) -> Dict:
        closes = price_data.get("closes", [])
        if len(closes) < 20:
            return {"direction": "HOLD", "confidence": 0.5, "reasoning": "数据不足"}
        price = closes[-1]
        ma20 = sum(closes[-20:]) / 20
        bb_upper = ma20 + 2 * (sum(abs(c - ma20) for c in closes[-20:]) / 20)  # 简化std
        bb_lower = ma20 - 2 * (sum(abs(c - ma20) for c in closes[-20:]) / 20)
        rsi = 50 + (closes[-1] - closes[-5]) / closes[-5] * 100  # 简化RSI
        buy_signals = sum([price < bb_lower, rsi < 30])
        sell_signals = sum([price > bb_upper, rsi > 70])
        if buy_signals >= 2:
            return {"direction": "BUY", "confidence": 0.60, "reasoning": "三重共振做多信号"}
        elif sell_signals >= 2:
            return {"direction": "SELL", "confidence": 0.60, "reasoning": "三重共振做空信号"}
        return {"direction": "HOLD", "confidence": 0.50, "reasoning": "无共振信号"}


class CAT013_PEAD(BaseStrategy):
    name = "CAT-013 PEAD盈利漂移"
    category = "事件驱动"
    def execute(self, symbol: str, price_data: Dict) -> Dict:
        return {"direction": "HOLD", "confidence": 0.50, "reasoning": "PEAD — 需财报数据"}

class CAT014_OpeningRangeBreakout(BaseStrategy):
    name = "CAT-014 开盘区间突破"
    category = "日内动量"
    def execute(self, symbol: str, price_data: Dict) -> Dict:
        return {"direction": "HOLD", "confidence": 0.50, "reasoning": "ORB — 需日内分钟数据"}

class CAT015_GridTrading(BaseStrategy):
    name = "CAT-015 网格交易"
    category = "震荡"
    def execute(self, symbol: str, price_data: Dict) -> Dict:
        closes = price_data.get("closes", [])
        if len(closes) < 20:
            return {"direction": "HOLD", "confidence": 0.5, "reasoning": "数据不足"}
        recent_range = max(closes[-20:]) - min(closes[-20:])
        avg_range = sum(max(closes[i:i+5]) - min(closes[i:i+5]) for i in range(len(closes)-5)) / max(len(closes)-5, 1)
        if recent_range < avg_range * 0.5:
            return {"direction": "HOLD", "confidence": 0.60, "reasoning": "窄幅震荡适合网格，但需手动设置"}
        return {"direction": "HOLD", "confidence": 0.50, "reasoning": "波动过大不适合网格"}

class CAT016_FibonacciRetracement(BaseStrategy):
    name = "CAT-016 斐波那契回调"
    category = "趋势/回调"
    def execute(self, symbol: str, price_data: Dict) -> Dict:
        closes = price_data.get("closes", [])
        if len(closes) < 20:
            return {"direction": "HOLD", "confidence": 0.5, "reasoning": "数据不足"}
        high = max(closes[-20:])
        low = min(closes[-20:])
        price = closes[-1]
        fib_levels = [high - (high - low) * r for r in [0.382, 0.5, 0.618]]
        # 检查价格是否在关键斐波那契位获得支撑
        for i, level in enumerate(fib_levels):
            if abs(price - level) / level < 0.02:
                direction = "BUY" if price > low + (high - low) * 0.3 else "SELL"
                return {"direction": direction, "confidence": 0.55,
                        "reasoning": f"价格接近38.2%-61.8%区域({level:.2f})，关键支撑/阻力位"}
        return {"direction": "HOLD", "confidence": 0.50, "reasoning": "价格不在关键斐波那契位"}


class CAT017_CoveredCall(BaseStrategy):
    name = "CAT-017 期权备兑"
    category = "期权收入"
    def execute(self, symbol: str, price_data: Dict) -> Dict:
        return {"direction": "HOLD", "confidence": 0.50, "reasoning": "期权备兑 — 需期权数据"}

class CAT018_Straddle(BaseStrategy):
    name = "CAT-018 期权跨式"
    category = "波动率"
    def execute(self, symbol: str, price_data: Dict) -> Dict:
        return {"direction": "HOLD", "confidence": 0.50, "reasoning": "期权跨式 — 重大事件前双押波动"}

class CAT019_ShortVolatility(BaseStrategy):
    name = "CAT-019 做空波动率"
    category = "波动率/套利"
    def execute(self, symbol: str, price_data: Dict) -> Dict:
        return {"direction": "HOLD", "confidence": 0.50, "reasoning": "做空波动率 — 需VIX/IV数据"}

class CAT020_RSIDivergence(BaseStrategy):
    name = "CAT-020 RSI+背离"
    category = "反转"
    def execute(self, symbol: str, price_data: Dict) -> Dict:
        closes = price_data.get("closes", [])
        if len(closes) < 20:
            return {"direction": "HOLD", "confidence": 0.5, "reasoning": "数据不足"}
        gains = sum(max(closes[i] - closes[i-1], 0) for i in range(1, 15))
        losses = sum(max(closes[i-1] - closes[i], 0) for i in range(1, 15))
        rsi = 50 if losses == 0 else 100 - 100 / (1 + gains / losses)
        price = closes[-1]
        if rsi < 30 and price > min(closes[-10:-5]):
            return {"direction": "BUY", "confidence": 0.60, "reasoning": f"RSI={rsi:.1f}<30超卖，价格未创新低，底背离"}
        elif rsi > 70 and price < max(closes[-10:-5]):
            return {"direction": "SELL", "confidence": 0.60, "reasoning": f"RSI={rsi:.1f}>70超买，价格未创新高，顶背离"}
        return {"direction": "HOLD", "confidence": 0.50, "reasoning": f"RSI={rsi:.1f}，无背离信号"}


# 策略注册表
EXTRA_STRATEGIES = {
    "CAT-001": CAT001_DualMACrossover,
    "CAT-002": CAT002_MACDDivergence,
    "CAT-003": CAT003_KeltnerChannel,
    "CAT-004": CAT004_ParabolicSAR,
    "CAT-005": CAT005_VWAP,
    "CAT-006": CAT006_VolumeProfile,
    "CAT-007": CAT007_PairsTrading,
    "CAT-008": CAT008_TripleScreen,
    "CAT-009": CAT009_CrossSectionalMomentum,
    "CAT-010": CAT010_LongTermContrarian,
    "CAT-011": CAT011_ADX,
    "CAT-012": CAT012_TripleResonance,
    "CAT-013": CAT013_PEAD,
    "CAT-014": CAT014_OpeningRangeBreakout,
    "CAT-015": CAT015_GridTrading,
    "CAT-016": CAT016_FibonacciRetracement,
    "CAT-017": CAT017_CoveredCall,
    "CAT-018": CAT018_Straddle,
    "CAT-019": CAT019_ShortVolatility,
    "CAT-020": CAT020_RSIDivergence,
}
