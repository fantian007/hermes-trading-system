"""
Core strategy implementations (AGT-002 ~ AGT-008).
"""

import math
from typing import Dict, Any, List

from .base_strategy import BaseStrategy


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def _sma(data: List[float], period: int) -> List[float]:
    """Simple moving average. Returns list of length len(data), NaN-padded."""
    result = [float("nan")] * len(data)
    for i in range(period - 1, len(data)):
        total = 0.0
        for j in range(i - period + 1, i + 1):
            total += data[j]
        result[i] = total / period
    return result


def _ema(data: List[float], period: int) -> List[float]:
    """Exponential moving average."""
    result = [float("nan")] * len(data)
    multiplier = 2.0 / (period + 1)
    # seed with SMA
    total = 0.0
    for i in range(period):
        total += data[i]
    seed = total / period
    result[period - 1] = seed
    for i in range(period, len(data)):
        result[i] = (data[i] - result[i - 1]) * multiplier + result[i - 1]
    return result


def _stddev(data: List[float], period: int, mean: List[float]) -> List[float]:
    """Rolling standard deviation."""
    result = [float("nan")] * len(data)
    for i in range(period - 1, len(data)):
        total = 0.0
        for j in range(i - period + 1, i + 1):
            diff = data[j] - mean[i]
            total += diff * diff
        result[i] = math.sqrt(total / period)
    return result


def _tr(high: List[float], low: List[float], close: List[float]) -> List[float]:
    """True Range."""
    tr = [float("nan")] * len(high)
    for i in range(1, len(high)):
        hl = high[i] - low[i]
        hc = abs(high[i] - close[i - 1])
        lc = abs(low[i] - close[i - 1])
        tr[i] = max(hl, hc, lc)
    tr[0] = high[0] - low[0]
    return tr


def _atr(high: List[float], low: List[float], close: List[float], period: int) -> List[float]:
    """Average True Range (EMA of True Range)."""
    tr = _tr(high, low, close)
    return _ema(tr, period)


def _roc(data: List[float], period: int) -> List[float]:
    """Rate of Change."""
    result = [float("nan")] * len(data)
    for i in range(period, len(data)):
        result[i] = (data[i] - data[i - period]) / data[i - period] * 100.0
    return result


def _rsi(data: List[float], period: int = 14) -> List[float]:
    """Relative Strength Index."""
    result = [float("nan")] * len(data)
    gains = [0.0] * len(data)
    losses = [0.0] * len(data)
    for i in range(1, len(data)):
        diff = data[i] - data[i - 1]
        if diff > 0:
            gains[i] = diff
        else:
            losses[i] = -diff
    avg_gain = 0.0
    avg_loss = 0.0
    for i in range(1, period + 1):
        avg_gain += gains[i]
        avg_loss += losses[i]
    avg_gain /= period
    avg_loss /= period
    if avg_loss == 0:
        result[period] = 100.0
    else:
        rs = avg_gain / avg_loss
        result[period] = 100.0 - (100.0 / (1.0 + rs))
    for i in range(period + 1, len(data)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        if avg_loss == 0:
            result[i] = 100.0
        else:
            rs = avg_gain / avg_loss
            result[i] = 100.0 - (100.0 / (1.0 + rs))
    return result


def _last_valid(values: List[float]) -> float:
    """Return last non-NaN value."""
    for v in reversed(values):
        if not math.isnan(v):
            return v
    return float("nan")


def _min(a: float, b: float) -> float:
    return a if a < b else b


def _max(a: float, b: float) -> float:
    return a if a > b else b


# ===================================================================
# AGT-002: MACD Golden/Death Cross
# ===================================================================

class AGT002MACDCross(BaseStrategy):
    """MACD 金叉/死叉策略 — 当 DIF 上穿 DEA 时买入，下穿时卖出。"""
    name = "AGT-002 MACD Cross"
    category = "趋势"

    def execute(self, symbol: str, price_data: Dict[str, Any]) -> Dict[str, Any]:
        close = price_data.get("close", [])
        if len(close) < 35:
            return {"direction": "HOLD", "confidence": 0.0, "reasoning": f"{symbol}: 数据不足"}

        ema12 = _ema(close, 12)
        ema26 = _ema(close, 26)
        dif = [ema12[i] - ema26[i] if not math.isnan(ema12[i]) and not math.isnan(ema26[i]) else float("nan") for i in range(len(close))]
        dea = _ema([v if not math.isnan(v) else 0.0 for v in dif], 9)
        # hist = DIF - DEA
        hist = [dif[i] - dea[i] if not math.isnan(dif[i]) and not math.isnan(dea[i]) else float("nan") for i in range(len(close))]

        hist_prev = _last_valid(hist[:-1]) if len(hist) > 1 else float("nan")
        hist_cur = _last_valid(hist)

        if math.isnan(hist_prev) or math.isnan(hist_cur):
            return {"direction": "HOLD", "confidence": 0.0, "reasoning": f"{symbol}: 无法计算MACD"}

        dif_cur = _last_valid(dif)
        dea_cur = _last_valid(dea)

        if hist_prev < 0 and hist_cur >= 0:
            conf = min(0.8, abs(hist_cur - hist_prev) / (_max(abs(dea_cur), 0.01)) * 0.1)
            return {"direction": "BUY", "confidence": round(conf, 2),
                    "reasoning": f"{symbol}: MACD金叉(DIF={dif_cur:.4f}上穿DEA={dea_cur:.4f}), 买入信号"}
        elif hist_prev > 0 and hist_cur <= 0:
            conf = min(0.8, abs(hist_cur - hist_prev) / (_max(abs(dea_cur), 0.01)) * 0.1)
            return {"direction": "SELL", "confidence": round(conf, 2),
                    "reasoning": f"{symbol}: MACD死叉(DIF={dif_cur:.4f}下穿DEA={dea_cur:.4f}), 卖出信号"}
        else:
            return {"direction": "HOLD", "confidence": 0.3,
                    "reasoning": f"{symbol}: MACD无交叉, DIF={dif_cur:.4f}, DEA={dea_cur:.4f}, 柱={hist_cur:.4f}"}


# ===================================================================
# AGT-003: Moving Average Trend
# ===================================================================

class AGT003MATrend(BaseStrategy):
    """均线趋势策略 — MA5/10/20 多头排列→BUY，空头排列→SELL。"""
    name = "AGT-003 MA Trend"
    category = "趋势"

    def execute(self, symbol: str, price_data: Dict[str, Any]) -> Dict[str, Any]:
        close = price_data.get("close", [])
        if len(close) < 25:
            return {"direction": "HOLD", "confidence": 0.0, "reasoning": f"{symbol}: 数据不足"}

        ma5 = _sma(close, 5)
        ma10 = _sma(close, 10)
        ma20 = _sma(close, 20)

        c5 = _last_valid(ma5)
        c10 = _last_valid(ma10)
        c20 = _last_valid(ma20)
        cp = _last_valid(close)

        if any(math.isnan(v) for v in [c5, c10, c20, cp]):
            return {"direction": "HOLD", "confidence": 0.0, "reasoning": f"{symbol}: 无法计算均线"}

        # 多头排列: MA5 > MA10 > MA20 and price > MA5
        if c5 > c10 > c20 and cp > c5:
            spread = (c5 - c20) / c20
            conf = min(0.85, 0.5 + spread * 5.0)
            return {"direction": "BUY", "confidence": round(conf, 2),
                    "reasoning": f"{symbol}: 均线多头排列(MA5={c5:.2f}>MA10={c10:.2f}>MA20={c20:.2f}), 趋势向上"}
        # 空头排列: MA5 < MA10 < MA20 and price < MA5
        elif c5 < c10 < c20 and cp < c5:
            spread = (c20 - c5) / c20
            conf = min(0.85, 0.5 + spread * 5.0)
            return {"direction": "SELL", "confidence": round(conf, 2),
                    "reasoning": f"{symbol}: 均线空头排列(MA5={c5:.2f}<MA10={c10:.2f}<MA20={c20:.2f}), 趋势向下"}
        elif cp > c5 and cp > ma10[-1]:
            return {"direction": "BUY", "confidence": 0.35,
                    "reasoning": f"{symbol}: 价格在短期均线上方, 偏多"}
        elif cp < c5 and cp < ma10[-1]:
            return {"direction": "SELL", "confidence": 0.35,
                    "reasoning": f"{symbol}: 价格在短期均线下方, 偏空"}
        else:
            return {"direction": "HOLD", "confidence": 0.3,
                    "reasoning": f"{symbol}: 均线缠绕, 方向不明"}


# ===================================================================
# AGT-004: Bollinger Bands
# ===================================================================

class AGT004BollingerBands(BaseStrategy):
    """布林带策略 — 轨道位置+带宽分析。价格触及下轨反弹→BUY，触及上轨回落→SELL。"""
    name = "AGT-004 Bollinger Bands"
    category = "反转"

    def execute(self, symbol: str, price_data: Dict[str, Any]) -> Dict[str, Any]:
        close = price_data.get("close", [])
        if len(close) < 25:
            return {"direction": "HOLD", "confidence": 0.0, "reasoning": f"{symbol}: 数据不足"}

        period = 20
        mid = _sma(close, period)
        std = _stddev(close, period, mid)
        upper = [mid[i] + 2.0 * std[i] if not math.isnan(mid[i]) and not math.isnan(std[i]) else float("nan") for i in range(len(close))]
        lower = [mid[i] - 2.0 * std[i] if not math.isnan(mid[i]) and not math.isnan(std[i]) else float("nan") for i in range(len(close))]

        cp = _last_valid(close)
        cu = _last_valid(upper)
        cl = _last_valid(lower)
        cm = _last_valid(mid)

        if any(math.isnan(v) for v in [cp, cu, cl, cm]):
            return {"direction": "HOLD", "confidence": 0.0, "reasoning": f"{symbol}: 无法计算布林带"}

        bandwidth = (cu - cl) / cm if cm != 0 else 0

        # %B: where price is within bands
        percent_b = (cp - cl) / (cu - cl) if (cu - cl) != 0 else 0.5

        # 触及下轨且带宽宽 → 超卖反弹可能
        if cp <= cl * 1.01 and bandwidth > 0.05:
            conf = min(0.8, 0.4 + (1.0 - percent_b) * 0.5)
            return {"direction": "BUY", "confidence": round(conf, 2),
                    "reasoning": f"{symbol}: 价格触及布林下轨({cp:.2f}<={cl:.2f}), %B={percent_b:.3f}, 带宽={bandwidth:.4f}, 超卖反弹"}
        # 触及上轨且带宽宽 → 超买回落可能
        elif cp >= cu * 0.99 and bandwidth > 0.05:
            conf = min(0.8, 0.4 + percent_b * 0.5)
            return {"direction": "SELL", "confidence": round(conf, 2),
                    "reasoning": f"{symbol}: 价格触及布林上轨({cp:.2f}>={cu:.2f}), %B={percent_b:.3f}, 带宽={bandwidth:.4f}, 超买回落"}
        # 带宽极窄 → 突破酝酿
        elif bandwidth < 0.03:
            price_trend = cp - _last_valid(close[:len(close)//2]) if len(close) > 2 else 0
            if price_trend > 0:
                return {"direction": "BUY", "confidence": 0.45,
                        "reasoning": f"{symbol}: 布林带宽收窄({bandwidth:.4f}), 向上突破酝酿中"}
            else:
                return {"direction": "SELL", "confidence": 0.45,
                        "reasoning": f"{symbol}: 布林带宽收窄({bandwidth:.4f}), 向下突破酝酿中"}
        else:
            return {"direction": "HOLD", "confidence": 0.3,
                    "reasoning": f"{symbol}: %B={percent_b:.3f}, 带宽={bandwidth:.4f}, 无明显信号"}


# ===================================================================
# AGT-005: Volume / Money Flow
# ===================================================================

class AGT005VolumeFlow(BaseStrategy):
    """成交量/资金流策略 — 放量上涨/下跌方向确认。"""
    name = "AGT-005 Volume Flow"
    category = "动量"

    def execute(self, symbol: str, price_data: Dict[str, Any]) -> Dict[str, Any]:
        close = price_data.get("close", [])
        volume = price_data.get("volume", [])
        if len(close) < 15 or len(volume) < 15:
            return {"direction": "HOLD", "confidence": 0.0, "reasoning": f"{symbol}: 数据不足"}

        # Price ROC
        price_roc = _roc(close, 5)
        pr = _last_valid(price_roc)

        # Volume SMA
        vol_sma = _sma(volume, 10)
        cv = _last_valid(volume)
        cv_avg = _last_valid(vol_sma)

        if any(math.isnan(v) for v in [pr, cv, cv_avg]) or cv_avg == 0:
            return {"direction": "HOLD", "confidence": 0.0, "reasoning": f"{symbol}: 无法计算量价指标"}

        vol_ratio = cv / cv_avg
        cp = _last_valid(close)
        prev_close = close[-2] if len(close) >= 2 else cp

        # 放量上涨
        if vol_ratio > 1.3 and pr > 2.0 and cp > prev_close:
            conf = min(0.85, 0.4 + (vol_ratio - 1.0) * 0.3)
            return {"direction": "BUY", "confidence": round(conf, 2),
                    "reasoning": f"{symbol}: 放量上涨(量比={vol_ratio:.2f}, ROC={pr:.2f}%), 资金流入"}
        # 放量下跌
        elif vol_ratio > 1.3 and pr < -2.0 and cp < prev_close:
            conf = min(0.85, 0.4 + (vol_ratio - 1.0) * 0.3)
            return {"direction": "SELL", "confidence": round(conf, 2),
                    "reasoning": f"{symbol}: 放量下跌(量比={vol_ratio:.2f}, ROC={pr:.2f}%), 资金流出"}
        # 缩量
        elif vol_ratio < 0.7:
            return {"direction": "HOLD", "confidence": 0.2,
                    "reasoning": f"{symbol}: 缩量(量比={vol_ratio:.2f}), 交投清淡"}
        else:
            return {"direction": "HOLD", "confidence": 0.3,
                    "reasoning": f"{symbol}: 量比={vol_ratio:.2f}, ROC={pr:.2f}%, 无明显资金流向"}


# ===================================================================
# AGT-006: Turtle / Trend Following
# ===================================================================

class AGT006TurtleTrend(BaseStrategy):
    """海龟/趋势跟踪策略 — 20日突破入场。价格突破20日高点→BUY, 跌破20日低点→SELL。"""
    name = "AGT-006 Turtle Trend"
    category = "趋势"

    def execute(self, symbol: str, price_data: Dict[str, Any]) -> Dict[str, Any]:
        close = price_data.get("close", [])
        high = price_data.get("high", [])
        low = price_data.get("low", [])
        if len(close) < 25 or len(high) < 25 or len(low) < 25:
            return {"direction": "HOLD", "confidence": 0.0, "reasoning": f"{symbol}: 数据不足"}

        period = 20
        # 20日最高/最低
        rolling_high = [float("nan")] * len(high)
        rolling_low = [float("nan")] * len(low)
        for i in range(period - 1, len(high)):
            rh = -float("inf")
            rl = float("inf")
            for j in range(i - period + 1, i + 1):
                if high[j] > rh:
                    rh = high[j]
                if low[j] < rl:
                    rl = low[j]
            rolling_high[i] = rh
            rolling_low[i] = rl

        cp = _last_valid(close)
        rh = _last_valid(rolling_high)
        rl = _last_valid(rolling_low)
        prev_rh = _last_valid(rolling_high[:-1]) if len(rolling_high) > 1 else float("nan")
        prev_rl = _last_valid(rolling_low[:-1]) if len(rolling_low) > 1 else float("nan")
        prev_cp = close[-2] if len(close) >= 2 else cp

        if any(math.isnan(v) for v in [cp, rh, rl]):
            return {"direction": "HOLD", "confidence": 0.0, "reasoning": f"{symbol}: 无法计算突破位"}

        # 计算ATR用于止损位（仅参考）
        atr20 = _atr(high, low, close, 10)
        atr_val = _last_valid(atr20)

        # 突破20日高点
        if cp > rh and prev_cp <= prev_rh:
            conf = min(0.8, 0.5 + (cp - rh) / rh * 20.0)
            return {"direction": "BUY", "confidence": round(conf, 2),
                    "reasoning": f"{symbol}: 价格突破20日高点({cp:.2f}>{rh:.2f}), 海龟买入信号"}
        # 跌破20日低点
        elif cp < rl and prev_cp >= prev_rl:
            conf = min(0.8, 0.5 + (rl - cp) / rl * 20.0)
            return {"direction": "SELL", "confidence": round(conf, 2),
                    "reasoning": f"{symbol}: 价格跌破20日低点({cp:.2f}<{rl:.2f}), 海龟卖出信号"}
        # 趋势确认
        elif cp > rh * 0.98:
            return {"direction": "BUY", "confidence": 0.4,
                    "reasoning": f"{symbol}: 价格接近20日高点({cp:.2f}, 高点={rh:.2f}), 偏多"}
        elif cp < rl * 1.02:
            return {"direction": "SELL", "confidence": 0.4,
                    "reasoning": f"{symbol}: 价格接近20日低点({cp:.2f}, 低点={rl:.2f}), 偏空"}
        else:
            return {"direction": "HOLD", "confidence": 0.3,
                    "reasoning": f"{symbol}: 价格在{period}日通道内({rl:.2f}-{rh:.2f}), 无突破信号"}


# ===================================================================
# AGT-007: Technical Synthesis / Correction
# ===================================================================

class AGT007TechSynthesis(BaseStrategy):
    """技术面综合/修正策略 — 整合多个指标的加权综合信号。"""
    name = "AGT-007 Tech Synthesis"
    category = "量化"

    def execute(self, symbol: str, price_data: Dict[str, Any]) -> Dict[str, Any]:
        close = price_data.get("close", [])
        high = price_data.get("high", [])
        low = price_data.get("low", [])
        volume = price_data.get("volume", [])
        if len(close) < 30:
            return {"direction": "HOLD", "confidence": 0.0, "reasoning": f"{symbol}: 数据不足"}

        score = 0.0  # positive = bullish, negative = bearish
        signals = []

        # 1. MA trend (权重 0.25)
        ma5 = _last_valid(_sma(close, 5))
        ma10 = _last_valid(_sma(close, 10))
        ma20 = _last_valid(_sma(close, 20))
        cp = _last_valid(close)
        if not any(math.isnan(v) for v in [ma5, ma10, ma20, cp]):
            if ma5 > ma10 > ma20 and cp > ma5:
                score += 0.25
                signals.append("均线多头")
            elif ma5 < ma10 < ma20 and cp < ma5:
                score -= 0.25
                signals.append("均线空头")
            elif cp > ma5:
                score += 0.1
                signals.append("价格>MA5")
            elif cp < ma5:
                score -= 0.1
                signals.append("价格<MA5")

        # 2. RSI (权重 0.20)
        rsi = _rsi(close, 14)
        rsi_v = _last_valid(rsi)
        if not math.isnan(rsi_v):
            if rsi_v < 30:
                score += 0.2
                signals.append(f"RSI超卖({rsi_v:.1f})")
            elif rsi_v > 70:
                score -= 0.2
                signals.append(f"RSI超买({rsi_v:.1f})")
            elif rsi_v < 45:
                score += 0.05
                signals.append(f"RSI偏弱({rsi_v:.1f})")
            elif rsi_v > 55:
                score -= 0.05
                signals.append(f"RSI偏强({rsi_v:.1f})")

        # 3. MACD 柱状图方向 (权重 0.15)
        ema12 = _ema(close, 12)
        ema26 = _ema(close, 26)
        dif = [ema12[i] - ema26[i] if not math.isnan(ema12[i]) and not math.isnan(ema26[i]) else float("nan") for i in range(len(close))]
        dea = _ema([v if not math.isnan(v) else 0.0 for v in dif], 9)
        hist = [dif[i] - dea[i] if not math.isnan(dif[i]) and not math.isnan(dea[i]) else float("nan") for i in range(len(close))]
        hist_cur = _last_valid(hist)
        hist_prev = _last_valid(hist[:-1]) if len(hist) > 1 else float("nan")
        if not math.isnan(hist_cur) and not math.isnan(hist_prev):
            if hist_cur > 0 and hist_cur > hist_prev:
                score += 0.15
                signals.append("MACD柱扩大")
            elif hist_cur < 0 and hist_cur < hist_prev:
                score -= 0.15
                signals.append("MACD柱走阔(负)")
            elif hist_cur > 0:
                score += 0.05
                signals.append("MACD柱为正")
            elif hist_cur < 0:
                score -= 0.05
                signals.append("MACD柱为负")

        # 4. Volume (权重 0.15)
        if len(volume) >= 10:
            vol_sma = _sma(volume, 10)
            cv = _last_valid(volume)
            cv_avg = _last_valid(vol_sma)
            if cv_avg > 0:
                vol_ratio = cv / cv_avg
                roc5 = _last_valid(_roc(close, 5))
                if vol_ratio > 1.3 and not math.isnan(roc5) and roc5 > 0:
                    score += 0.15
                    signals.append("放量上涨")
                elif vol_ratio > 1.3 and not math.isnan(roc5) and roc5 < 0:
                    score -= 0.15
                    signals.append("放量下跌")

        # 4. Bollinger %B (权重 0.15)
        mid = _sma(close, 20)
        std = _stddev(close, 20, mid)
        upper = _last_valid([mid[i] + 2.0 * std[i] if not math.isnan(mid[i]) and not math.isnan(std[i]) else float("nan") for i in range(len(close))])
        lower = _last_valid([mid[i] - 2.0 * std[i] if not math.isnan(mid[i]) and not math.isnan(std[i]) else float("nan") for i in range(len(close))])
        cm = _last_valid(mid)
        if not any(math.isnan(v) for v in [upper, lower, cm, cp]) and (upper - lower) > 0:
            percent_b = (cp - lower) / (upper - lower)
            if percent_b < 0.1:
                score += 0.15
                signals.append("触及下轨")
            elif percent_b > 0.9:
                score -= 0.15
                signals.append("触及上轨")

        # 5. ATR volatility (权重 0.10)
        atr14 = _atr(high, low, close, 14)
        atr_v = _last_valid(atr14)
        if not math.isnan(atr_v) and cp > 0:
            atr_pct = atr_v / cp * 100
            if atr_pct > 3.0:
                signals.append(f"高波动({atr_pct:.1f}%)")
            elif atr_pct < 0.8:
                signals.append(f"低波动({atr_pct:.1f}%)")

        direction = "HOLD"
        confidence = 0.5
        reason = "; ".join(signals) if signals else "无明显信号"

        if score >= 0.45:
            direction = "BUY"
            confidence = min(0.9, 0.5 + score * 0.5)
        elif score <= -0.45:
            direction = "SELL"
            confidence = min(0.9, 0.5 + abs(score) * 0.5)
        elif score >= 0.15:
            direction = "BUY"
            confidence = 0.4 + score * 0.5
        elif score <= -0.15:
            direction = "SELL"
            confidence = 0.4 + abs(score) * 0.5

        return {"direction": direction, "confidence": round(confidence, 2),
                "reasoning": f"{symbol}: 综合得分={score:.2f}, 信号=[{reason}]"}


# ===================================================================
# AGT-008: Smart Money + Fundamental Analysis
# ===================================================================

class AGT008SmartMoney(BaseStrategy):
    """主力行为+基本面分析策略 — 基于量价关系识别主力资金动向。"""
    name = "AGT-008 Smart Money"
    category = "基本面"

    def execute(self, symbol: str, price_data: Dict[str, Any]) -> Dict[str, Any]:
        close = price_data.get("close", [])
        high = price_data.get("high", [])
        low = price_data.get("low", [])
        volume = price_data.get("volume", [])
        if len(close) < 25:
            return {"direction": "HOLD", "confidence": 0.0, "reasoning": f"{symbol}: 数据不足"}

        cp = _last_valid(close)
        cv = _last_valid(volume)

        # 成交量异常放大
        vol_sma = _sma(volume, 20)
        cv_avg = _last_valid(vol_sma)
        if math.isnan(cv_avg) or cv_avg == 0:
            return {"direction": "HOLD", "confidence": 0.0, "reasoning": f"{symbol}: 无法计算量能"}

        vol_ratio = cv / cv_avg

        # 大单资金流估算: 价格区间 * 成交量
        price_range = (max(high[-20:]) - min(low[-20:])) if len(high) >= 20 and len(low) >= 20 else cp * 0.05
        if price_range == 0:
            price_range = cp * 0.01

        # 涨跌比检测
        up_days = 0
        dn_days = 0
        for i in range(max(1, len(close) - 10), len(close)):
            if close[i] > close[i - 1]:
                up_days += 1
            else:
                dn_days += 1

        # 主力建仓: 放量不跌 + 低位 + 阳线增多
        rsi14 = _rsi(close, 14)
        rsi_v = _last_valid(rsi14)

        if vol_ratio > 1.8 and cv > cv_avg and cp > _last_valid(_sma(close, 10)):
            # 放量上涨 → 主力拉升
            if up_days > dn_days * 1.5:
                conf = min(0.8, 0.4 + (vol_ratio - 1.0) * 0.2)
                return {"direction": "BUY", "confidence": round(conf, 2),
                        "reasoning": f"{symbol}: 成交量异常放大(量比={vol_ratio:.2f}), 上涨日>{dn_days}天, 主力拉升迹象"}
            # 放量滞涨 → 出货
            else:
                conf = min(0.7, 0.4 + (vol_ratio - 1.0) * 0.15)
                return {"direction": "SELL", "confidence": round(conf, 2),
                        "reasoning": f"{symbol}: 成交量放大但上涨乏力(量比={vol_ratio:.2f}), 主力出货迹象"}

        # 缩量回调后放量企稳 → 回调到位
        if vol_ratio < 0.5 and len(close) >= 5:
            recent_roc = (cp - close[-5]) / close[-5] * 100
            if recent_roc < -3 and not math.isnan(rsi_v) and rsi_v < 40:
                return {"direction": "BUY", "confidence": 0.55,
                        "reasoning": f"{symbol}: 缩量回调({recent_roc:.1f}%)后企稳(RSI={rsi_v:.1f}), 主力洗盘可能"}

        if not math.isnan(rsi_v) and rsi_v < 30 and vol_ratio > 1.2:
            conf = min(0.7, 0.4 + (30 - rsi_v) / 30 * 0.3)
            return {"direction": "BUY", "confidence": round(conf, 2),
                    "reasoning": f"{symbol}: 低位放量(RSI={rsi_v:.1f}, 量比={vol_ratio:.2f}), 主力抄底迹象"}

        if not math.isnan(rsi_v) and rsi_v > 70 and vol_ratio > 1.3:
            return {"direction": "SELL", "confidence": 0.6,
                    "reasoning": f"{symbol}: 高位放量(RSI={rsi_v:.1f}, 量比={vol_ratio:.2f}), 主力派发迹象"}

        # 筹码集中度观察（换手率代替，用volume/avg_volume近似）
        if vol_ratio > 1.5:
            return {"direction": "BUY", "confidence": 0.35,
                    "reasoning": f"{symbol}: 量能活跃(量比={vol_ratio:.2f}), 线上信息待查"}
        elif vol_ratio < 0.4:
            return {"direction": "HOLD", "confidence": 0.2,
                    "reasoning": f"{symbol}: 量能枯竭(量比={vol_ratio:.2f}), 流动性不足"}

        return {"direction": "HOLD", "confidence": 0.3,
                "reasoning": f"{symbol}: 主力行为无明显异常, 量比={vol_ratio:.2f}, 涨跌比={up_days}/{dn_days}"}


# 核心策略注册表
CORE_STRATEGIES = {
    "AGT-002": AGT002MACDCross,
    "AGT-003": AGT003MATrend,
    "AGT-004": AGT004BollingerBands,
    "AGT-005": AGT005VolumeFlow,
    "AGT-006": AGT006TurtleTrend,
    "AGT-007": AGT007TechSynthesis,
    "AGT-008": AGT008SmartMoney,
}
