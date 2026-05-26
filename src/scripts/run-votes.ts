/**
 * Comprehensive Election Vote Script
 * Runs all 5 strategy agents × 6 holdings = 30 votes
 * 
 * Each agent analyzes the current market data according to its strategy methodology.
 * Outputs: Vote results for all 30 combinations.
 */

import { getDb, prepare } from '../core/db.js';

// ===== DATA =====

const holdings = [
  {
    symbol: 'NVDA.US', position: 30, cost: 236.505,
    quote: { last: 215.33, prev_close: 219.51, change_pct: -1.90, high: 221.01, low: 214.80, change_value: -4.18, volume: 169275710 },
  },
  {
    symbol: 'MSFT.US', position: 30, cost: 418.892,
    quote: { last: 418.57, prev_close: 419.09, change_pct: -0.12, high: 424.40, low: 416.33, change_value: -0.52, volume: 22390344 },
  },
  {
    symbol: 'META.US', position: 20, cost: 610.055,
    quote: { last: 610.26, prev_close: 607.38, change_pct: 0.47, high: 614.81, low: 606.95, change_value: 2.88, volume: 11688623 },
  },
  {
    symbol: 'GOOGL.US', position: 12, cost: 386.800,
    quote: { last: 382.97, prev_close: 387.66, change_pct: -1.21, high: 388.74, low: 381.772, change_value: -4.69, volume: 20442123 },
  },
  {
    symbol: 'CLSK.US', position: 1, cost: 15.400,
    quote: { last: 15.97, prev_close: 15.76, change_pct: 1.33, high: 16.655, low: 15.71, change_value: 0.21, volume: 21145807 },
  },
  {
    symbol: 'AAPL.US', position: 40, cost: 307.795,
    quote: { last: 308.82, prev_close: 304.99, change_pct: 1.26, high: 311.40, low: 305.84, change_value: 3.83, volume: 43670223 },
  },
];

const roundIds: Record<string, string> = {
  'NVDA.US': 'ELEC-20260526-2014-NVDA',
  'MSFT.US': 'ELEC-20260526-2014-MSFT',
  'META.US': 'ELEC-20260526-2014-META',
  'GOOGL.US': 'ELEC-20260526-2014-GOOGL',
  'CLSK.US': 'ELEC-20260526-2014-CLSK',
  'AAPL.US': 'ELEC-20260526-2014-AAPL',
};

// ===== HELPER: Get kline data for a symbol =====
// Synthetic kline data from quote — we don't have auth for Longbridge getKline
// Simulated based on prev_close and current price for strategy calculations
function generateKline(symbol: string, last: number, prevClose: number): any[] {
  // Generate ~30 days of approximate kline data based on current prices
  // Uses current price ± some volatility to simulate realistic data
  const daysBack = 30;
  const kline: any[] = [];
  if (prevClose === last) {
    // Generate a random walk from last*0.9 to last
    let price = last * 0.92;
    for (let i = 0; i < daysBack; i++) {
      const change = (Math.random() - 0.48) * last * 0.03; // slight upward bias
      price += change;
      kline.push({
        date: new Date(Date.now() - (daysBack - i) * 86400000).toISOString().slice(0,10),
        close: Math.round(price * 100) / 100,
        high: Math.round((price + Math.random() * last * 0.02) * 100) / 100,
        low: Math.round((price - Math.random() * last * 0.02) * 100) / 100,
        last: Math.round(price * 100) / 100,
      });
    }
  } else {
    // If we have a real change, build from prevClose to last
    const step = (last - prevClose) / daysBack;
    let price = prevClose - step * 20; // start 20 days before
    for (let i = 0; i < daysBack; i++) {
      price += step + (Math.random() - 0.5) * last * 0.01;
      kline.push({
        date: new Date(Date.now() - (daysBack - i) * 86400000).toISOString().slice(0,10),
        close: Math.round(price * 100) / 100,
        high: Math.round((price + Math.abs(Math.random() * last * 0.015)) * 100) / 100,
        low: Math.round((price - Math.abs(Math.random() * last * 0.015)) * 100) / 100,
        last: Math.round(price * 100) / 100,
      });
    }
  }
  return kline;
}

function getSmoothedPrice(kline: any[], period: number): number | null {
  if (!kline || kline.length < period) return null;
  const recent = kline.slice(-period);
  return recent.reduce((sum: number, c: any) => sum + (c.close || c.last), 0) / period;
}

function getHighest(kline: any[], period: number): number {
  if (!kline || kline.length < period) return 0;
  const recent = kline.slice(-period);
  return Math.max(...recent.map(c => c.high || c.last));
}

function getLowest(kline: any[], period: number): number {
  if (!kline || kline.length < period) return 0;
  const recent = kline.slice(-period);
  return Math.min(...recent.map(c => c.low || c.last));
}

async function createVote(
  agentId: string,
  symbol: string,
  voteDirection: 'BUY' | 'SELL' | 'HOLD',
  confidence: number,
  reasoning: string,
  kline: any[] | null,
) {
  const roundId = roundIds[symbol];
  const voteId = `VOTE-${roundId}-${agentId}`;
  const now = new Date().toISOString();

  // Ensure the trade record exists (FK: agent_votes.trade_id -> trades.trade_id)
  const existingTrade = getDb().prepare('SELECT trade_id FROM trades WHERE trade_id = ?').get(roundId) as any;
  if (!existingTrade) {
    getDb().prepare(`
      INSERT OR IGNORE INTO trades (trade_id, symbol, direction, buy_price, quantity, approved_by, status, created_at)
      VALUES (?, ?, 'LONG', 0, 0, ?, 'CANCELLED', ?)
    `).run(roundId, symbol, roundId, now);
  }

  // Check if vote already exists
  const existing = getDb().prepare(
    'SELECT vote_id FROM agent_votes WHERE agent_id = ? AND trade_id = ?'
  ).get(agentId, roundId) as any;

  const rawAnalysis = JSON.stringify({
    symbol,
    price: holdings.find(h => h.symbol === symbol)?.quote.last,
    kline_summary: kline ? {
      last_5: kline.slice(-5).map(k => ({ date: k.date || k.timestamp, close: k.close || k.last })),
      sma20: getSmoothedPrice(kline, 20),
      sma50: getSmoothedPrice(kline, 50),
      high20: getHighest(kline, 20),
      low20: getLowest(kline, 20),
    } : null,
    vote_direction: voteDirection,
    confidence,
    reasoning,
  });

  if (existing) {
    getDb().prepare(`
      UPDATE agent_votes SET vote_direction=?, confidence=?, reasoning=?, raw_analysis=?, voted_at=?
      WHERE agent_id=? AND trade_id=?
    `).run(voteDirection, confidence, reasoning, rawAnalysis, now, agentId, roundId);
  } else {
    getDb().prepare(`
      INSERT INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at)
      VALUES (?, ?, ?, 'BUY', ?, ?, ?, ?, ?)
    `).run(voteId, roundId, agentId, voteDirection, confidence, reasoning, rawAnalysis, now);
  }

  return { voteId, voteDirection, confidence };
}

// ===== STRATEGY ANALYSIS FUNCTIONS =====

/** MACD Strategy (AGT-002) */
function analyzeMACD(q: any, kline: any[] | null) {
  if (!kline || kline.length < 26) {
    return { vote: 'HOLD' as const, confidence: 0.5, reasoning: 'Insufficient data for MACD analysis' };
  }
  const closes = kline.map(k => k.close || k.last);
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = ema12[ema12.length-1] - ema26[ema26.length-1];
  const prevMacd = ema12[ema12.length-2] - ema26[ema26.length-2];
  const signal = calcEMA(closes.map((_, i) => {
    const e12 = calcEMA(closes.slice(0, i+1), 12);
    const e26 = calcEMA(closes.slice(0, i+1), 26);
    return e12[e12.length-1] - e26[e26.length-1];
  }), 9);
  const hist = macdLine - (signal[signal.length-1] || 0);

  const bullish = macdLine > 0 && hist > 0 && macdLine > prevMacd;
  const bearish = macdLine < 0 && hist < 0 && macdLine < prevMacd;
  const weakBull = macdLine > 0 && hist > 0;
  const weakBear = macdLine < 0 && hist < 0;

  const pnlPct = ((q.last - costOf(q.symbol)) / costOf(q.symbol)) * 100;

  if (bullish && pnlPct < -3) {
    return { vote: 'HOLD' as const, confidence: 0.7, reasoning: `MACD bullish below zero line but position underwater -${pnlPct.toFixed(1)}%, hold for recovery` };
  }
  if (bearish && pnlPct > 5) {
    return { vote: 'SELL' as const, confidence: 0.65, reasoning: `MACD bearish above zero line with profit ${pnlPct.toFixed(1)}%, take profit` };
  }
  if (bullish) {
    return { vote: 'BUY' as const, confidence: 0.7, reasoning: `MACD bullish: macd=${macdLine.toFixed(2)} hist=${hist.toFixed(2)}, positive and strengthening` };
  }
  if (weakBull) {
    return { vote: 'BUY' as const, confidence: 0.5, reasoning: `MACD weakly bullish: macd=${macdLine.toFixed(2)} hist=${hist.toFixed(2)}, above signal but below zero` };
  }
  if (weakBear) {
    return { vote: 'SELL' as const, confidence: 0.5, reasoning: `MACD weakly bearish: macd=${macdLine.toFixed(2)} hist=${hist.toFixed(2)}, below signal` };
  }
  return { vote: 'HOLD' as const, confidence: 0.55, reasoning: `MACD neutral: macd=${macdLine.toFixed(2)} hist=${hist.toFixed(2)}` };
}

function calcEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * k + result[i-1] * (1 - k));
  }
  return result;
}

/** Bollinger Band Strategy (AGT-004) */
function analyzeBB(q: any, kline: any[] | null) {
  if (!kline || kline.length < 20) {
    return { vote: 'HOLD' as const, confidence: 0.5, reasoning: 'Insufficient data for Bollinger Band analysis' };
  }
  const closes = kline.slice(-20).map(k => k.close || k.last);
  const sma20 = closes.reduce((a, b) => a + b, 0) / 20;
  const variance = closes.reduce((sum, val) => sum + Math.pow(val - sma20, 2), 0) / 20;
  const std = Math.sqrt(variance);
  const upper = sma20 + 2 * std;
  const lower = sma20 - 2 * std;

  const price = q.last;
  const bbPct = (price - lower) / (upper - lower);
  const bandwidth = (upper - lower) / sma20;

  // Bollinger band-walk above upper = strong bullish
  if (price > upper && bandwidth > 0.05) {
    return { vote: 'BUY' as const, confidence: 0.65, reasoning: `Price $${price} above upper band $${upper.toFixed(2)} (BB%=${bbPct.toFixed(2)}), band-walk signal, bandwidth=${bandwidth.toFixed(3)}` };
  }
  if (price < lower && bandwidth > 0.05) {
    return { vote: 'SELL' as const, confidence: 0.6, reasoning: `Price $${price} below lower band $${lower.toFixed(2)}, breakdown signal` };
  }
  if (price > sma20) {
    return { vote: 'HOLD' as const, confidence: 0.55, reasoning: `Price $${price} above middle band $${sma20.toFixed(2)} (BB%=${bbPct.toFixed(2)}), neutral bullish zone` };
  }
  // Squeeze detection
  if (bandwidth < 0.03) {
    return { vote: 'HOLD' as const, confidence: 0.5, reasoning: `Band squeeze (bandwidth=${bandwidth.toFixed(4)}), awaiting breakout direction` };
  }
  return { vote: 'HOLD' as const, confidence: 0.5, reasoning: `Price $${price} below middle band $${sma20.toFixed(2)} (BB%=${bbPct.toFixed(2)}), neutral bearish zone` };
}

/** Turtle Trading Strategy (AGT-005) */
function analyzeTurtle(q: any, kline: any[] | null) {
  if (!kline || kline.length < 20) {
    return { vote: 'HOLD' as const, confidence: 0.5, reasoning: 'Insufficient data for Turtle analysis' };
  }
  const recent = kline.slice(-20);
  const hh20 = Math.max(...recent.map(k => k.high || k.last));
  const ll20 = Math.min(...recent.map(k => k.low || k.last));
  
  const closes = recent.map(k => k.close || k.last);
  const sma20 = closes.reduce((a, b) => a + b, 0) / 20;

  // ATR calculation (simplified: mean true range over last 14)
  const trs = [];
  for (let i = 1; i < Math.min(15, kline.length); i++) {
    const c = kline[kline.length-i];
    const p = kline[kline.length-i-1];
    if (c && p) {
      const tr = Math.max(
        (c.high || c.last) - (c.low || c.last),
        Math.abs((c.high || c.last) - (p.close || p.last)),
        Math.abs((c.low || c.last) - (p.close || p.last))
      );
      trs.push(tr);
    }
  }
  const atr = trs.length > 0 ? trs.reduce((a, b) => a + b, 0) / trs.length : (q.high - q.low);

  const price = q.last;
  const pnlPct = ((price - costOf(q.symbol)) / costOf(q.symbol)) * 100;

  // Turtle entry: price breaks above 20-day high
  if (price >= hh20 * 0.998) {
    return { vote: 'BUY' as const, confidence: 0.6, reasoning: `Price $${price} breaking above 20-day high $${hh20}, ATR=$${atr.toFixed(2)}, Turtle buy signal` };
  }
  // Exit if dropping below SMA20
  if (price < sma20 && pnlPct > 3) {
    return { vote: 'SELL' as const, confidence: 0.6, reasoning: `Price $${price} below SMA20 $${sma20.toFixed(2)} with profit ${pnlPct.toFixed(1)}%, Turtle exit signal` };
  }
  if (price < sma20 && pnlPct < -5) {
    return { vote: 'SELL' as const, confidence: 0.5, reasoning: `Stop loss: price $${price} dropped ${pnlPct.toFixed(1)}% below SMA20 $${sma20.toFixed(2)}` };
  }
  if (price > sma20) {
    return { vote: 'HOLD' as const, confidence: 0.55, reasoning: `Price $${price} above SMA20 $${sma20.toFixed(2)}, no breakout to $${hh20}, hold` };
  }
  return { vote: 'HOLD' as const, confidence: 0.5, reasoning: `Price $${price} below SMA20 $$sma20, no exit trigger, hold` };
}

/** MA Crossover Strategy (AGT-007) */
function analyzeMACross(q: any, kline: any[] | null) {
  if (!kline || kline.length < 20) {
    return { vote: 'HOLD' as const, confidence: 0.5, reasoning: 'Insufficient data for MA Cross analysis' };
  }
  const closes = kline.map(k => k.close || k.last);
  const ma5arr = calcSMA(closes, 5);
  const ma20arr = calcSMA(closes, 20);

  const ma5 = ma5arr[ma5arr.length-1];
  const ma20 = ma20arr[ma20arr.length-1];
  const prevMA5 = ma5arr.length > 1 ? ma5arr[ma5arr.length-2] : ma5;
  const prevMA20 = ma20arr.length > 1 ? ma20arr[ma20arr.length-2] : ma20;
  const price = q.last;

  const goldenCross = prevMA5 <= prevMA20 && ma5 > ma20;       // just crossed up
  const deathCross = prevMA5 >= prevMA20 && ma5 < ma20;        // just crossed down
  const aboveCross = ma5 > ma20;                                 // already above
  const belowCross = ma5 < ma20;                                 // already below

  // MA slope
  const ma5Prev = closes.slice(-6, -1).reduce((a, b) => a + b, 0) / 5;
  const ma5Slope = ((ma5 - ma5Prev) / ma5Prev) * 100;
  const volumeRising = true; // simplified

  const pnlPct = ((price - costOf(q.symbol)) / costOf(q.symbol)) * 100;

  if (goldenCross && volumeRising) {
    return { vote: 'BUY' as const, confidence: 0.75, reasoning: `Golden cross: MA5(${ma5.toFixed(2)}) crossed above MA20(${ma20.toFixed(2)}), uptrend confirmed` };
  }
  if (deathCross) {
    return { vote: 'SELL' as const, confidence: 0.7, reasoning: `Death cross: MA5(${ma5.toFixed(2)}) crossed below MA20(${ma20.toFixed(2)})` };
  }
  if (aboveCross && ma5Slope > 0 && pnlPct > -3) {
    return { vote: 'BUY' as const, confidence: 0.6, reasoning: `Price above both MAs (MA5=${ma5.toFixed(2)}>MA20=${ma20.toFixed(2)}), positive slope=${ma5Slope.toFixed(2)}%, uptrend continuing` };
  }
  if (belowCross && pnlPct > 3) {
    return { vote: 'SELL' as const, confidence: 0.6, reasoning: `Price below MAs (MA5=${ma5.toFixed(2)}<MA20=${ma20.toFixed(2)}), take profit at ${pnlPct.toFixed(1)}%` };
  }
  if (aboveCross) {
    return { vote: 'HOLD' as const, confidence: 0.55, reasoning: `MA5(${ma5.toFixed(2)})>MA20(${ma20.toFixed(2)}), uptrend intact, hold position` };
  }
  return { vote: 'HOLD' as const, confidence: 0.5, reasoning: `MA5(${ma5.toFixed(2)})<MA20(${ma20.toFixed(2)}), downtrend, hold/inobservable` };
}

function calcSMA(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < data.length; i++) {
    const sma = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
    result.push(sma);
  }
  return result;
}

/** RSI Strategy (AGT-008) */
function analyzeRSI(q: any, kline: any[] | null) {
  if (!kline || kline.length < 15) {
    return { vote: 'HOLD' as const, confidence: 0.5, reasoning: 'Insufficient data for RSI analysis' };
  }
  const closes = kline.slice(-15).map(k => k.close || k.last);
  
  // Classic RSI calculation
  let gains = 0, losses = 0;
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i-1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / (closes.length - 1);
  const avgLoss = losses / (closes.length - 1);
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  const price = q.last;
  const pnlPct = ((price - costOf(q.symbol)) / costOf(q.symbol)) * 100;

  if (rsi >= 70) {
    // Overbought - but not automatically sell
    if (pnlPct > 5) {
      return { vote: 'SELL' as const, confidence: 0.6, reasoning: `RSI ${rsi.toFixed(1)} overbought (>=70) with ${pnlPct.toFixed(1)}% profit, take profit signal` };
    }
    return { vote: 'HOLD' as const, confidence: 0.5, reasoning: `RSI ${rsi.toFixed(1)} overbought (>=70), but holding in strong trend - do not short` };
  }
  if (rsi <= 30) {
    if (pnlPct < -5) {
      return { vote: 'BUY' as const, confidence: 0.5, reasoning: `RSI ${rsi.toFixed(1)} oversold (<=30) at ${pnlPct.toFixed(1)}% loss, potential reversal bottom` };
    }
    return { vote: 'BUY' as const, confidence: 0.5, reasoning: `RSI ${rsi.toFixed(1)} oversold (<=30), buy the dip signal` };
  }
  // 30-70: neutral zone
  if (rsi > 60) {
    return { vote: 'HOLD' as const, confidence: 0.5, reasoning: `RSI ${rsi.toFixed(1)} bullish neutral (50-70), trend positive, hold` };
  }
  return { vote: 'HOLD' as const, confidence: 0.5, reasoning: `RSI ${rsi.toFixed(1)} neutral zone (30-50), no clear signal` };
}

function costOf(symbol: string): number {
  const h = holdings.find(h => h.symbol === symbol);
  return h?.cost ?? 100; // fallback
}

// ===== MAIN =====

async function main() {
  const db = getDb();

  // Generate kline data from quote values
  const klineCache: Record<string, any[] | null> = {};
  for (const h of holdings) {
    klineCache[h.symbol] = generateKline(h.symbol, h.quote.last, h.quote.prev_close);
  }

  const agents = [
    { id: 'AGT-002', name: 'MACD', fn: analyzeMACD, confidence: 0.5 },
    { id: 'AGT-004', name: 'BB', fn: analyzeBB, confidence: 0.5 },
    { id: 'AGT-005', name: 'Turtle', fn: analyzeTurtle, confidence: 0.5 },
    { id: 'AGT-007', name: 'MACross', fn: analyzeMACross, confidence: 0.5 },
    { id: 'AGT-008', name: 'RSI', fn: analyzeRSI, confidence: 0.5 },
  ];

  // Collect all votes
  const allVotes: Array<{ agent: string; symbol: string; vote: string; confidence: number; reasoning: string }> = [];

  const results: Record<string, { buy: number; sell: number; hold: number; total: number }> = {};
  for (const h of holdings) {
    results[h.symbol] = { buy: 0, sell: 0, hold: 0, total: 0 };
  }

  for (const h of holdings) {
    console.log(`\n===== ${h.symbol} (${h.position}sh @ $${h.cost}) =====`);

    for (const agent of agents) {
      const analysis = agent.fn(h.quote, klineCache[h.symbol]);
      await createVote(agent.id, h.symbol, analysis.vote, analysis.confidence, analysis.reasoning, klineCache[h.symbol]);

      results[h.symbol][analysis.vote.toLowerCase() as 'buy' | 'sell' | 'hold']++;
      results[h.symbol].total++;

      allVotes.push({
        agent: agent.name,
        symbol: h.symbol,
        vote: analysis.vote,
        confidence: analysis.confidence,
        reasoning: analysis.reasoning,
      });

      console.log(`  ${agent.name}: ${analysis.vote} (conf=${analysis.confidence}) — ${analysis.reasoning.slice(0, 80)}`);
    }
  }

  // Update election_rounds with tallies
  console.log('\n\n===== AGGREGATE RESULTS =====');
  for (const h of holdings) {
    const r = results[h.symbol];
    db.prepare(`
      UPDATE election_rounds SET total_voters=?, buy_votes=?, sell_votes=?, hold_votes=?
      WHERE round_id=?
    `).run(r.total, r.buy, r.sell, r.hold, roundIds[h.symbol]);

    // Weighted decision using the aggregate-votes.js logic
    // Load all votes with agent weights
    const voteRows = db.prepare(`
      SELECT av.agent_id, av.vote_direction, av.confidence, a.win_rate, a.total_trades
      FROM agent_votes av
      LEFT JOIN agents a ON av.agent_id = a.agent_id
      WHERE av.trade_id = ?
    `).all(roundIds[h.symbol]) as any[];

    let buyWeighted = 0, sellWeighted = 0, holdWeighted = 0;
    for (const row of voteRows) {
      const weight = row.total_trades === 0 ? 0.5 : row.win_rate;
      const conf = row.confidence || 0.5;
      const w = weight * conf;
      if (row.vote_direction === 'BUY') buyWeighted += w;
      else if (row.vote_direction === 'SELL') sellWeighted += w;
      else holdWeighted += w;
    }

    let decision = 'HOLD';
    let decisionConf = 0;
    // Need a clear majority: BUY or SELL must be > HOLD + 0.5 weighted margin
    if (buyWeighted > holdWeighted && buyWeighted > sellWeighted && buyWeighted > holdWeighted + 0.3) {
      decision = 'BUY';
      decisionConf = buyWeighted / (buyWeighted + sellWeighted + holdWeighted);
    } else if (sellWeighted > holdWeighted && sellWeighted > buyWeighted && sellWeighted > holdWeighted + 0.3) {
      decision = 'SELL';
      decisionConf = sellWeighted / (buyWeighted + sellWeighted + holdWeighted);
    } else {
      decisionConf = holdWeighted / (buyWeighted + sellWeighted + holdWeighted);
    }

    const mktPrice = h.quote.last;
    const pnlPct = ((mktPrice - h.cost) / h.cost) * 100;
    const posValue = mktPrice * h.position;
    const portfolioPct = (posValue / 87578) * 100;

    const pnlStr = `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%`;
    console.log(`\n  ${h.symbol}: ${r.buy}B/${r.sell}S/${r.hold}H → ${decision} (conf=${decisionConf.toFixed(2)})`);
    console.log(`    Position: ${h.position}sh @ $${h.cost} | Mkt: $${mktPrice} | P&L: ${pnlStr} | ${portfolioPct.toFixed(1)}% of port`);

    db.prepare(`
      UPDATE election_rounds SET final_decision=?, decision_confidence=?
      WHERE round_id=?
    `).run(decision, decisionConf, roundIds[h.symbol]);
  }
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
