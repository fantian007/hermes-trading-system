#!/usr/bin/env node
/**
 * AGT-007 Live MA Crossover Strategy Analysis - BATCH MODE
 * Fetches all symbols via Yahoo Finance, then produces a report
 */
import { DatabaseSync } from 'node:sqlite';
import { execSync } from 'node:child_process';

const DB_PATH = '/Users/zys/workspace/hermes-trading-system/data/trading.db';
const TRADES_DB_PATH = '/Users/zys/workspace/hermes-trading-system/trading.db';
const db = new DatabaseSync(DB_PATH);

// Check both DBs for open trades
let tradeDb;
try { tradeDb = new DatabaseSync(TRADES_DB_PATH); } catch(e) { tradeDb = null; }

const poolRows = db.prepare("SELECT * FROM stock_pool WHERE status='ACTIVE' ORDER BY strength DESC, symbol ASC").all();
const symbols = poolRows.map(r => r.symbol);

if (symbols.length === 0) {
  console.log('当前活跃股池为空，无需分析。');
  process.exit(0);
}

const now = new Date();
const utcStr = now.toISOString();
const beijingTime = new Date(now.getTime() + 8 * 3600000).toISOString().replace('T', ' ').slice(0, 19);
const day = now.getUTCDay();
const hour = now.getUTCHours();
const min = now.getUTCMinutes();
const timeSince930 = (hour - 13.5) * 60 + min;
const isMarketOpen = day >= 1 && day <= 5 && timeSince930 >= 0 && timeSince930 < 390;
const marketNote = isMarketOpen ? '【盘中】' : '【盘后/盘前—上轮收盘数据】';

console.log(`╔══════════════════════════════════════════════════════════╗`);
console.log(`║  AGT-007 均线交叉策略分析 (守护进程自动巡检)            ║`);
console.log(`║  ${marketNote.padEnd(51)}║`);
console.log(`║  北京时间: ${beijingTime}                                 ║`);
console.log(`║  分析标的: ${symbols.length}只                            ║`);
console.log(`╚══════════════════════════════════════════════════════════╝`);
console.log(`\n┌─ 当前活跃股池 (${symbols.length}只) ─────────────────────────────────┐`);
for (const r of poolRows) {
  console.log(`│ ${r.symbol.padEnd(10)} ${r.signal_type} ${r.strength} │ ${(r.reason || '').slice(0, 50)}`);
}
console.log(`└──────────────────────────────────────────────────────────┘`);

// Fetch prices in batch via a single curl + parallel approach
// Use Yahoo Finance v7 API for each symbol
const results = {};
const BATCH_SIZE = 5;

for (let batchStart = 0; batchStart < symbols.length; batchStart += BATCH_SIZE) {
  const batch = symbols.slice(batchStart, batchStart + BATCH_SIZE);
  console.log(`\n📡 获取批量 ${batchStart/BATCH_SIZE + 1}... (${batch.join(', ')})`);
  
  const fetchPromises = batch.map(sym => {
    try {
      const curl = execSync(
        `curl -s --max-time 10 "https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=2mo&interval=1d" 2>/dev/null`,
        { timeout: 12000, encoding: 'utf-8' }
      );
      const data = JSON.parse(curl);
      const result = data?.chart?.result?.[0];
      const quotes = result?.indicators?.quote?.[0];
      const adjClose = result?.indicators?.adjclose?.[0]?.adjclose;
      const timestamps = result?.timestamp;
      
      if (quotes?.close && timestamps?.length >= 20) {
        const closes = [];
        for (let i = 0; i < quotes.close.length; i++) {
          const c = adjClose?.[i] ?? quotes.close[i];
          if (c !== null) closes.push(c);
        }
        if (closes.length >= 20) {
          const price = closes[closes.length - 1];
          const ma5 = closes.slice(-5).reduce((a,b) => a+b, 0) / 5;
          const ma10 = closes.slice(-10).reduce((a,b) => a+b, 0) / 10;
          const ma20 = closes.slice(-20).reduce((a,b) => a+b, 0) / 20;
          return { sym, price, ma5, ma10, ma20, ok: true };
        }
      }
      return { sym, ok: false };
    } catch(e) {
      return { sym, ok: false };
    }
  });
  
  for (const r of fetchPromises) {
    if (r.ok) {
      results[r.sym] = r;
      console.log(`  ✓ ${r.sym}: $${r.price.toFixed(2)}`);
    } else {
      console.log(`  ✗ ${r.sym}: failed`);
    }
  }
}

// Also try alt endpoint for failed ones
const failed = symbols.filter(s => !results[s] || !results[s].ok);
if (failed.length > 0) {
  console.log(`\n📡 重试失败标的 (query2)...`);
  for (const sym of failed) {
    try {
      const curl = execSync(
        `curl -s --max-time 10 "https://query2.finance.yahoo.com/v8/finance/chart/${sym}?range=1mo&interval=1d" 2>/dev/null`,
        { timeout: 12000, encoding: 'utf-8' }
      );
      const data = JSON.parse(curl);
      const quotes = data?.chart?.result?.[0]?.indicators?.quote?.[0];
      const timestamps = data?.chart?.result?.[0]?.timestamp;
      if (quotes?.close && timestamps?.length >= 20) {
        const closes = quotes.close.filter(c => c !== null);
        if (closes.length >= 20) {
          const price = closes[closes.length - 1];
          const ma5 = closes.slice(-5).reduce((a,b) => a+b, 0) / 5;
          const ma10 = closes.slice(-10).reduce((a,b) => a+b, 0) / 10;
          const ma20 = closes.slice(-20).reduce((a,b) => a+b, 0) / 20;
          results[sym] = { sym, price, ma5, ma10, ma20, ok: true };
          console.log(`  ✓ ${sym}: $${price.toFixed(2)} (query2)`);
          continue;
        }
      }
      console.log(`  ✗ ${sym}: still failed`);
    } catch(e) {
      console.log(`  ✗ ${sym}: error`);
    }
  }
}

// Now produce the full analysis report
console.log(`\n\n========== 技术分析报告 ==========\n`);

const dataSymbols = Object.keys(results).filter(s => results[s].ok);
const dataAvailable = dataSymbols.length;
const dataFailed = symbols.length - dataAvailable;

if (dataAvailable === 0) {
  console.log('⚠️ 无法获取任何标的实时数据。Yahoo Finance API 可能限流。');
  console.log('   建议稍后重试或切换数据源。');
  process.exit(0);
}

console.log(`成功获取: ${dataAvailable}/${symbols.length} 只\n`);

// Get open trades
const getTrade = (sym) => {
  try {
    const t = db.prepare("SELECT * FROM trades WHERE symbol = ? AND status = 'OPEN' ORDER BY created_at DESC LIMIT 1").get(sym);
    if (t) return t;
    if (tradeDb) return tradeDb.prepare("SELECT * FROM trades WHERE symbol = ? AND status = 'OPEN' ORDER BY created_at DESC LIMIT 1").get(sym);
  } catch(e) {}
  return null;
};

// Analysis for each symbol
const analysisResults = {};

for (const sym of dataSymbols) {
  const { price, ma5, ma10, ma20 } = results[sym];
  const trade = getTrade(sym);
  
  console.log(`┌──────────────────────────────────────────┐`);
  console.log(`│ ${sym.padEnd(43)}│`);
  console.log(`└──────────────────────────────────────────┘`);
  
  const poolInfo = poolRows.find(r => r.symbol === sym);
  if (poolInfo) {
    console.log(`  股池: ${poolInfo.signal_type} 强度${poolInfo.strength} | ${(poolInfo.reason || '').slice(0, 60)}`);
  }
  if (trade) {
    const pnl = ((price - trade.buy_price) / trade.buy_price * 100);
    console.log(`  持仓: OPEN $${trade.buy_price} (盈亏: ${pnl > 0 ? '+' : ''}${pnl.toFixed(2)}%)`);
  } else {
    console.log(`  持仓: 无`);
  }
  
  const arrow5 = ma5 > ma10 ? '↑' : (ma5 < ma10 ? '↓' : '→');
  const arrow10 = ma10 > ma20 ? '↑' : (ma10 < ma20 ? '↓' : '→');
  
  console.log(`  ┌──────┬─────────┬──────────┬──────────┐`);
  console.log(`  │      │  MA5    │  MA10    │  MA20    │`);
  console.log(`  ├──────┼─────────┼──────────┼──────────┤`);
  console.log(`  │ 价位 │ $${ma5.toFixed(2).padStart(7)} │ $${ma10.toFixed(2).padStart(7)} │ $${ma20.toFixed(2).padStart(7)} │`);
  console.log(`  │ 趋势 │   ${arrow5.padEnd(5)} │   ${arrow10.padEnd(6)} │   →     │`);
  console.log(`  └──────┴─────────┴──────────┴──────────┘`);
  console.log(`  当前价 $${price.toFixed(2)} ${price > ma5 ? '>' : '<'} MA5  |  $${price.toFixed(2)} ${price > ma20 ? '>' : '<'} MA20`);
  
  // Signal determination - match v1 logic
  const allBull = ma5 > ma10 && ma10 > ma20 && price > ma5;
  const partialBull = ma5 > ma10 && ma10 < ma20 && price > ma20;
  const allBear = ma5 < ma10 && ma10 < ma20 && price < ma5;
  const goldenCross = ma5 > ma20;
  const deathCross = ma5 < ma20;
  
  let signal, confidence, reasoning;
  
  console.log(`\n  均线排列分析:`);
  const ma5gt10 = ma5 > ma10;
  const ma10gt20 = ma10 > ma20;
  const priceGtMa20 = price > ma20;
  const goldenCrossValid = ma5 > ma20 && price > ma20;
  const deathCrossValid = ma5 < ma20 && price < ma20;
  
  console.log(`  ${ma5gt10 ? '✓' : '✗'} MA5($${ma5.toFixed(2)}) ${ma5gt10 ? '>' : '<'} MA10($${ma10.toFixed(2)}) — 短期${ma5gt10 ? '看多' : '偏空'}`);
  console.log(`  ${ma10gt20 ? '✓' : '✗'} MA10($${ma10.toFixed(2)}) ${ma10gt20 ? '>' : '<'} MA20($${ma20.toFixed(2)}) — 中期${ma10gt20 ? '看多' : '偏空'}`);
  console.log(`  ${priceGtMa20 ? '✓' : '✗'} 价格 > MA20 — ${priceGtMa20 ? '站稳中期均线上方' : '中期均线承压'}`);
  console.log(`  ${goldenCrossValid ? '✓' : '✗'} 金叉信号: MA5上穿MA20 — ${goldenCrossValid ? '有效' : '未形成'}`);
  
  if (allBull) {
    signal = 'BUY';
    confidence = 0.75;
    reasoning = '完全多头排列: MA5>MA10>MA20，价格站在所有均线上方。多头强势形态。';
  } else if (allBear) {
    signal = 'SELL';
    confidence = 0.70;
    reasoning = '完全空头排列: MA5<MA10<MA20，价格在所有均线下方。死叉确认。';
  } else if (goldenCrossValid && !allBull) {
    if (price > ma5) {
      signal = 'BUY';
      confidence = 0.60;
      reasoning = `金叉形态: MA5($${ma5.toFixed(2)})上穿MA20($${ma20.toFixed(2)})，价格$${price.toFixed(2)}站上MA20，多头排列正在形成中。`;
    } else {
      signal = 'HOLD';
      confidence = 0.50;
      reasoning = `金叉信号但价格$${price.toFixed(2)}在MA5($${ma5.toFixed(2)})下方，短期承压。中长期偏多但短期需等待。`;
    }
  } else if (deathCrossValid && !allBear) {
    if (price < ma5) {
      signal = 'SELL';
      confidence = 0.60;
      reasoning = `死叉形态: MA5($${ma5.toFixed(2)})跌破MA20($${ma20.toFixed(2)})，价格$${price.toFixed(2)}在MA20下方，空头排列正在形成。`;
    } else {
      signal = 'HOLD';
      confidence = 0.50;
      reasoning = `死叉信号但价格$${price.toFixed(2)}在MA5($${ma5.toFixed(2)})上方，短期反弹中。需观察是否能站回MA20。`;
    }
  } else if (ma5 > ma10 && ma10 < ma20) {
    signal = 'HOLD';
    confidence = 0.45;
    reasoning = `均线缠绕: MA5($${ma5.toFixed(2)})>MA10($${ma10.toFixed(2)})但MA10<MA20($${ma20.toFixed(2)})，短期走强但中期仍有压力。`;
  } else if (ma5 < ma10 && ma10 > ma20) {
    signal = 'HOLD';
    confidence = 0.45;
    reasoning = `均线缠绕: MA5($${ma5.toFixed(2)})<MA10($${ma10.toFixed(2)})但MA10>MA20($${ma20.toFixed(2)})，短期走弱但中期尚可。`;
  } else {
    signal = 'HOLD';
    confidence = 0.40;
    reasoning = `均线无明显方向。MA5=$${ma5.toFixed(2)} MA10=$${ma10.toFixed(2)} MA20=$${ma20.toFixed(2)}，价格$${price.toFixed(2)}。`;
  }
  
  console.log(`\n  结论: ${reasoning}`);
  console.log(`  信号: ${signal} (置信度 ${confidence.toFixed(2)})`);
  
  analysisResults[sym] = { price, ma5, ma10, ma20, signal, confidence, reasoning, trade: trade ? { price: trade.buy_price, pnl: ((price - trade.buy_price) / trade.buy_price * 100) } : null };
}

// Summary table
console.log(`\n\n══════════════════════════════════════════════════════════`);
console.log(`  综合排名 (按技术面强度)`);
console.log(`══════════════════════════════════════════════════════════`);

const ranked = Object.entries(analysisResults).sort((a, b) => {
  const order = { BUY: 0, HOLD: 1, SELL: 2 };
  const oa = order[a[1].signal] ?? 1;
  const ob = order[b[1].signal] ?? 1;
  if (oa !== ob) return oa - ob;
  return (b[1].confidence || 0) - (a[1].confidence || 0);
});

let rank = 1;
for (const [sym, res] of ranked) {
  if (res.signal === 'BUY') {
    console.log(`  ${rank++}st: ${sym} — 🟢 BUY (${(res.confidence * 100).toFixed(0)}%) ★★★ $${res.price.toFixed(2)}`);
  } else if (res.signal === 'SELL') {
    console.log(`  ${rank++}st: ${sym} — 🔴 SELL (${(res.confidence * 100).toFixed(0)}%) ★ $${res.price.toFixed(2)}`);
  } else {
    console.log(`  ${rank++}st: ${sym} — 🟡 HOLD (${(res.confidence * 100).toFixed(0)}%) ★★ $${res.price.toFixed(2)}`);
  }
}

// Overall assessment
const buys = Object.entries(analysisResults).filter(([,r]) => r.signal === 'BUY');
const sells = Object.entries(analysisResults).filter(([,r]) => r.signal === 'SELL');
const holds = Object.entries(analysisResults).filter(([,r]) => r.signal === 'HOLD');

console.log(`\n整体评估:`);
console.log(`  - BUY: ${buys.length}只 — ${buys.map(([s]) => s).join(', ') || '无'}`);
console.log(`  - HOLD: ${holds.length}只 — ${holds.map(([s]) => s).join(', ') || '无'}`);
console.log(`  - SELL: ${sells.length}只 — ${sells.map(([s]) => s).join(', ') || '无'}`);
console.log(`  - 数据获取失败: ${dataFailed}只`);
console.log(`  - 当前池中${symbols.length}只均为BULLISH票，AI/AI基础设施主线贯穿`);

// Machine JSON
console.log(`\n---MACHINE_JSON---`);
console.log(JSON.stringify({
  agent: 'AGT-007',
  analyzed_at: utcStr,
  market_open: isMarketOpen,
  symbols_total: symbols.length,
  symbols_analyzed: dataAvailable,
  summary: {
    buy: buys.map(([s]) => s),
    hold: holds.map(([s]) => s),
    sell: sells.map(([s]) => s),
  },
  results: Object.fromEntries(Object.entries(analysisResults).map(([sym, r]) => [sym, {
    price: r.price,
    ma5: r.ma5, ma10: r.ma10, ma20: r.ma20,
    signal: r.signal,
    confidence: r.confidence,
    reasoning: r.reasoning
  }]))
}, null, 2));

db.close();
if (tradeDb) tradeDb.close();
console.log(`\n=== AGT-007 自巡检完成 ===`);
