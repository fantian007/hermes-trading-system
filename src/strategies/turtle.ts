/**
 * Turtle Trading Strategy Analysis
 *
 * Pure analysis functions — no I/O, no side effects.
 * Takes kline data in, produces structured Turtle analysis out.
 *
 * Based on the original Turtle Trading system by Richard Dennis:
 *   - System 1: 20-day breakout entry, 10-day breakout exit
 *   - System 2: 55-day breakout entry, 20-day breakout exit
 *   - ATR(20) for position sizing
 *   - 2% risk rule with pyramid entries (max 4 units)
 *   - 2N hard stop
 *
 * Usage (programmatic):
 *   import { analyzeTurtle } from '../strategies/turtle.js';
 *   const result = analyzeTurtle({ symbol: 'NVDA.US', klines, accountSize: 88000 });
 *
 * Usage (CLI):
 *   npx tsx src/scripts/turtle-analyze.ts --symbol NVDA.US --days 100
 *   npx tsx src/scripts/turtle-analyze.ts --batch NVDA.US,MSFT.US,AAPL.US
 */

// ===== Input/Output Types =====

export interface KlineBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TurtleInput {
  symbol: string;
  klines: KlineBar[];          // sorted oldest→newest, at least 55 bars
  accountSize?: number;         // for position sizing
  currentPrice?: number;        // override (uses last kline close if not provided)
}

export interface ChannelBreakout {
  system: 1 | 2;
  direction: 'UP' | 'DOWN';
  breakoutPrice: number;
  daysAgo: number;
  active: boolean;              // within last 5 days
}

export interface PositionSizing {
  accountSize: number;
  riskPerTrade: number;         // 2% of account = dollar risk
  n: number;                    // ATR(20)
  unitSize: number;             // shares per unit (1% account / N)
  maxUnits: number;
  maxPositionShares: number;    // shares for full 4-unit position
  unitCapital: number;          // capital needed for 1 unit
  maxCapital: number;           // capital needed for full position
  entryAddLevels: number[];     // prices to add units (0.5N increments)
}

export interface TurtleIndicators {
  ma20: number;
  ma55: number;
  atr20: number;
  atr20Pct: number;
  channel20High: number;
  channel20Low: number;
  channel55High: number;
  channel55Low: number;
  channel20Position: number;    // 0-100, where current price sits in 20-day channel
  channel55Position: number;    // 0-100, where current price sits in 55-day channel
  vsMA20Pct: number;            // % above/below MA20
  vsMA55Pct: number;            // % above/below MA55
}

export interface TurtleRecommendation {
  direction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;           // 0.0 - 1.0
  system: 1 | 2 | null;        // which system triggered
  signals: string[];            // human-readable signal descriptions
  reasoning: string;            // full reasoning text
}

export interface TurtleAnalysisResult {
  symbol: string;
  timestamp: string;
  currentPrice: number;
  channel20: { high: number; low: number };
  channel55: { high: number; low: number };
  breakouts: ChannelBreakout[];
  indicators: TurtleIndicators;
  positionSizing: PositionSizing | null;
  stopLoss: number;
  stopLossPct: number;
  exitSignal1: number;          // 10-day low (System 1 exit)
  exitSignal2: number;          // 20-day low (System 2 exit)
  trailingStop: number;         // current 10-day low (for active positions)
  recommendation: TurtleRecommendation;
}

// ===== Math helpers =====

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return sum(arr) / arr.length;
}

function max(arr: number[]): number {
  return Math.max(...arr);
}

function min(arr: number[]): number {
  return Math.min(...arr);
}

// ===== Normalize kline data =====

function normalizeBar(k: any): KlineBar {
  return {
    date: k.date || k.time || k.timestamp || 'unknown',
    open: parseFloat(k.open ?? '0'),
    high: parseFloat(k.high ?? '0'),
    low: parseFloat(k.low ?? '0'),
    close: parseFloat(k.close ?? '0'),
    volume: parseFloat(k.volume ?? '0'),
  };
}

/**
 * Normalize kline input (handles both raw Longbridge output and data-service output).
 */
export function normalizeKlines(raw: any[]): KlineBar[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  // Check if it's the data-service wrapper format { symbol, days, summary, klines }
  if (raw.length === 1 && raw[0]?.klines && Array.isArray(raw[0].klines)) {
    return raw[0].klines.map(normalizeBar);
  }

  // Direct kline array
  return raw.map(normalizeBar);
}

// ===== Indicator Calculations =====

/**
 * Simple Moving Average.
 */
export function sma(data: number[], period: number): number {
  if (data.length < period) return 0;
  return mean(data.slice(-period));
}

/**
 * True Range for a single bar.
 */
function trueRange(current: KlineBar, prev: KlineBar): number {
  const h = current.high;
  const l = current.low;
  const pc = prev.close;
  return Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
}

/**
 * Average True Range (Wilder's smoothing).
 */
export function atr(klines: KlineBar[], period: number = 20): number {
  if (klines.length < period + 1) return 0;

  const trValues: number[] = [];
  for (let i = 1; i < klines.length; i++) {
    trValues.push(trueRange(klines[i], klines[i - 1]));
  }

  // Initial ATR is simple average of first `period` TR values
  let atrVal = mean(trValues.slice(0, period));

  // Wilder's smoothing for remaining
  for (let i = period; i < trValues.length; i++) {
    atrVal = (atrVal * (period - 1) + trValues[i]) / period;
  }

  return atrVal;
}

/**
 * Donchian channel highs (n-period).
 */
export function donchianHigh(klines: KlineBar[], period: number): number {
  if (klines.length < period) return 0;
  return max(klines.slice(-period).map(k => k.high));
}

/**
 * Donchian channel lows (n-period).
 */
export function donchianLow(klines: KlineBar[], period: number): number {
  if (klines.length < period) return 0;
  return min(klines.slice(-period).map(k => k.low));
}

/**
 * Detect recent channel breakouts.
 */
export function detectBreakouts(klines: KlineBar[]): ChannelBreakout[] {
  const breakouts: ChannelBreakout[] = [];
  if (klines.length < 56) return breakouts;

  const closes = klines.map(k => k.close);

  // Check last 5 bars for System 1 breakout (20-day)
  for (let offset = 0; offset <= 4; offset++) {
    const ci = klines.length - 1 - offset;
    if (ci < 20) break;

    const slice = klines.slice(0, ci + 1);
    const ch20 = donchianHigh(slice.slice(0, -1), 20); // exclude current bar
    const cl20 = donchianLow(slice.slice(0, -1), 20);

    if (closes[ci] > ch20) {
      breakouts.push({
        system: 1,
        direction: 'UP',
        breakoutPrice: closes[ci],
        daysAgo: offset,
        active: offset <= 3,
      });
      break; // only report most recent
    }
    if (closes[ci] < cl20) {
      breakouts.push({
        system: 1,
        direction: 'DOWN',
        breakoutPrice: closes[ci],
        daysAgo: offset,
        active: offset <= 3,
      });
      break;
    }
  }

  // Check last 5 bars for System 2 breakout (55-day)
  for (let offset = 0; offset <= 4; offset++) {
    const ci = klines.length - 1 - offset;
    if (ci < 55) break;

    const slice = klines.slice(0, ci + 1);
    const ch55 = donchianHigh(slice.slice(0, -1), 55);
    const cl55 = donchianLow(slice.slice(0, -1), 55);

    if (closes[ci] > ch55) {
      breakouts.push({
        system: 2,
        direction: 'UP',
        breakoutPrice: closes[ci],
        daysAgo: offset,
        active: offset <= 3,
      });
      break;
    }
    if (closes[ci] < cl55) {
      breakouts.push({
        system: 2,
        direction: 'DOWN',
        breakoutPrice: closes[ci],
        daysAgo: offset,
        active: offset <= 3,
      });
      break;
    }
  }

  return breakouts;
}

/**
 * Calculate position sizing per Turtle rules.
 * Unit = 1% of account / N (ATR)
 * Max 4 units. Each additional unit added at +0.5N from entry.
 */
export function calculatePosition(
  accountSize: number,
  n: number,
  entryPrice: number
): PositionSizing {
  const riskPerTrade = accountSize * 0.02;               // 2% total risk
  const unitRisk = accountSize * 0.01;                    // 1% per unit
  const unitSize = Math.floor(unitRisk / (n || 1));       // shares per unit
  const maxUnits = 4;
  const maxPositionShares = unitSize * maxUnits;
  const unitCapital = unitSize * entryPrice;
  const maxCapital = maxPositionShares * entryPrice;

  const entryAddLevels: number[] = [];
  for (let i = 1; i < maxUnits; i++) {
    entryAddLevels.push(parseFloat((entryPrice + n * 0.5 * i).toFixed(2)));
  }

  return {
    accountSize,
    riskPerTrade: parseFloat(riskPerTrade.toFixed(2)),
    n: parseFloat(n.toFixed(4)),
    unitSize,
    maxUnits,
    maxPositionShares,
    unitCapital: parseFloat(unitCapital.toFixed(2)),
    maxCapital: parseFloat(maxCapital.toFixed(2)),
    entryAddLevels,
  };
}

/**
 * Generate recommendation based on Turtle signals.
 */
function generateRecommendation(
  breakouts: ChannelBreakout[],
  currentPrice: number,
  indicators: TurtleIndicators,
  exitSignal1: number,
  exitSignal2: number
): TurtleRecommendation {
  const signals: string[] = [];
  let confidence = 0;
  let direction: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let system: 1 | 2 | null = null;

  const activeBreakouts = breakouts.filter(b => b.active);

  if (activeBreakouts.length === 0) {
    // No active breakout — check trend for HOLD guidance
    if (currentPrice > indicators.ma20 && currentPrice > indicators.ma55) {
      signals.push('价格在 MA20 和 MA55 之上，趋势偏多但无突破信号');
      direction = 'HOLD';
      confidence = 0.2;
    } else if (currentPrice < indicators.ma20 && currentPrice < indicators.ma55) {
      signals.push('价格在 MA20 和 MA55 之下，趋势偏空但无突破信号');
      direction = 'HOLD';
      confidence = 0.2;
    } else {
      signals.push('无活跃突破信号，价格处于震荡区间');
      direction = 'HOLD';
      confidence = 0.1;
    }
    return {
      direction,
      confidence,
      system: null,
      signals,
      reasoning: signals.join('；'),
    };
  }

  // Find best breakout signal
  const upBreakouts = activeBreakouts.filter(b => b.direction === 'UP');
  const downBreakouts = activeBreakouts.filter(b => b.direction === 'DOWN');

  if (upBreakouts.length > 0) {
    // Prioritize: System 2 (more reliable) > System 1
    const s2 = upBreakouts.find(b => b.system === 2);
    const s1 = upBreakouts.find(b => b.system === 1);

    if (s2) {
      signals.push(`System 2 (55日) 向上突破: 突破价 $${s2.breakoutPrice}`);
      system = 2;
      confidence = 0.75;
      // Confirm with trend
      if (currentPrice > indicators.ma55) {
        confidence += 0.1;
        signals.push('价格在 MA55 之上，趋势确认');
      }
      if (currentPrice > indicators.ma20) {
        confidence += 0.05;
      }
    } else if (s1) {
      signals.push(`System 1 (20日) 向上突破: 突破价 $${s1.breakoutPrice}`);
      system = 1;
      confidence = 0.6;
      if (currentPrice > indicators.ma20) {
        confidence += 0.1;
        signals.push('价格在 MA20 之上，短期趋势确认');
      }
      if (currentPrice > indicators.ma55) {
        confidence += 0.1;
        signals.push('价格在 MA55 之上，长期趋势向好');
      }
    }

    // Check if price already pulled back significantly from breakout
    if (system && currentPrice < indicators.channel20High * 0.97) {
      confidence -= 0.2;
      signals.push('警告: 价格已从突破高点回落超过 3%');
    }

    direction = 'BUY';
  } else if (downBreakouts.length > 0) {
    const s2 = downBreakouts.find(b => b.system === 2);
    const s1 = downBreakouts.find(b => b.system === 1);

    if (s2) {
      signals.push(`System 2 (55日) 向下突破: 突破价 $${s2.breakoutPrice}`);
      system = 2;
      confidence = 0.7;
      if (currentPrice < indicators.ma55) {
        confidence += 0.1;
        signals.push('价格在 MA55 之下，趋势确认');
      }
    } else if (s1) {
      signals.push(`System 1 (20日) 向下突破: 突破价 $${s1.breakoutPrice}`);
      system = 1;
      confidence = 0.55;
      if (currentPrice < indicators.ma20) {
        confidence += 0.1;
      }
    }

    direction = 'SELL';
  } else {
    direction = 'HOLD';
    confidence = 0.15;
    signals.push('方向冲突，保持观望');
  }

  // Clamp confidence
  confidence = Math.min(0.95, Math.max(0.05, parseFloat(confidence.toFixed(2))));

  return {
    direction,
    confidence,
    system,
    signals,
    reasoning: signals.join('；'),
  };
}

// ===== Main Analysis =====

/**
 * Main Turtle Trading analysis function.
 *
 * Requires at least 55 bars of kline data for System 2 signals.
 * Falls back gracefully if fewer bars are available.
 */
export function analyzeTurtle(input: TurtleInput): TurtleAnalysisResult {
  const { symbol, accountSize } = input;
  const klines = input.klines;
  const currentPrice = input.currentPrice ?? (klines.length > 0 ? klines[klines.length - 1].close : 0);
  const timestamp = new Date().toISOString();

  if (klines.length < 20) {
    return {
      symbol,
      timestamp,
      currentPrice,
      channel20: { high: 0, low: 0 },
      channel55: { high: 0, low: 0 },
      breakouts: [],
      indicators: {
        ma20: 0, ma55: 0, atr20: 0, atr20Pct: 0,
        channel20High: 0, channel20Low: 0,
        channel55High: 0, channel55Low: 0,
        channel20Position: 0, channel55Position: 0,
        vsMA20Pct: 0, vsMA55Pct: 0,
      },
      positionSizing: null,
      stopLoss: 0,
      stopLossPct: 0,
      exitSignal1: 0,
      exitSignal2: 0,
      trailingStop: 0,
      recommendation: {
        direction: 'HOLD',
        confidence: 0,
        system: null,
        signals: ['数据不足: 至少需要 20 根 K 线'],
        reasoning: `仅有 ${klines.length} 根 K 线，至少需要 20 根用于 System 1，55 根用于 System 2`,
      },
    };
  }

  const closes = klines.map(k => k.close);

  // Donchian Channels
  const ch20H = donchianHigh(klines, 20);
  const ch20L = donchianLow(klines, 20);
  const ch55H = klines.length >= 55 ? donchianHigh(klines, 55) : 0;
  const ch55L = klines.length >= 55 ? donchianLow(klines, 55) : 0;

  // ATR
  const atr20 = atr(klines, 20);
  const atr20Pct = currentPrice > 0 ? (atr20 / currentPrice) * 100 : 0;

  // MAs
  const ma20 = sma(closes, 20);
  const ma55 = klines.length >= 55 ? sma(closes, 55) : 0;
  const vsMA20Pct = ma20 > 0 ? ((currentPrice - ma20) / ma20) * 100 : 0;
  const vsMA55Pct = ma55 > 0 ? ((currentPrice - ma55) / ma55) * 100 : 0;

  // Channel position (0 = at low, 100 = at high)
  const ch20Range = ch20H - ch20L;
  const ch55Range = ch55H - ch55L;
  const ch20Pos = ch20Range > 0 ? ((currentPrice - ch20L) / ch20Range) * 100 : 50;
  const ch55Pos = ch55Range > 0 ? ((currentPrice - ch55L) / ch55Range) * 100 : 50;

  // Breakouts
  const breakouts = detectBreakouts(klines);

  // Exit signals
  const exitSignal1 = donchianLow(klines, 10);   // System 1 exit: 10-day low
  const exitSignal2 = donchianLow(klines, 20);   // System 2 exit: 20-day low
  const trailingStop = exitSignal1;               // trailing stop = 10-day low

  // Stop loss: 2 ATR below current price
  const stopLoss = currentPrice - 2 * atr20;
  const stopLossPct = currentPrice > 0 ? ((currentPrice - stopLoss) / currentPrice) * 100 : 0;

  // Indicators
  const indicators: TurtleIndicators = {
    ma20: parseFloat(ma20.toFixed(2)),
    ma55: parseFloat(ma55.toFixed(2)),
    atr20: parseFloat(atr20.toFixed(4)),
    atr20Pct: parseFloat(atr20Pct.toFixed(2)),
    channel20High: parseFloat(ch20H.toFixed(2)),
    channel20Low: parseFloat(ch20L.toFixed(2)),
    channel55High: parseFloat(ch55H.toFixed(2)),
    channel55Low: parseFloat(ch55L.toFixed(2)),
    channel20Position: parseFloat(ch20Pos.toFixed(1)),
    channel55Position: parseFloat(ch55Pos.toFixed(1)),
    vsMA20Pct: parseFloat(vsMA20Pct.toFixed(2)),
    vsMA55Pct: parseFloat(vsMA55Pct.toFixed(2)),
  };

  // Position sizing
  const positionSizing = accountSize && accountSize > 0
    ? calculatePosition(accountSize, atr20, currentPrice)
    : null;

  // Recommendation
  const recommendation = generateRecommendation(
    breakouts, currentPrice, indicators, exitSignal1, exitSignal2
  );

  return {
    symbol,
    timestamp,
    currentPrice: parseFloat(currentPrice.toFixed(2)),
    channel20: { high: ch20H, low: ch20L },
    channel55: { high: ch55H, low: ch55L },
    breakouts,
    indicators,
    positionSizing,
    stopLoss: parseFloat(stopLoss.toFixed(2)),
    stopLossPct: parseFloat(stopLossPct.toFixed(2)),
    exitSignal1: parseFloat(exitSignal1.toFixed(2)),
    exitSignal2: parseFloat(exitSignal2.toFixed(2)),
    trailingStop: parseFloat(trailingStop.toFixed(2)),
    recommendation,
  };
}

/**
 * Batch analysis — analyze multiple symbols at once.
 */
export function analyzeTurtleBatch(
  inputs: TurtleInput[]
): TurtleAnalysisResult[] {
  return inputs.map(analyzeTurtle);
}
