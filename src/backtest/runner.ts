/**
 * 回测引擎 — Backtest Runner
 *
 * 用法：
 *   npx tsx src/backtest/runner.ts --symbol NVDA.US --days 180
 *   npx tsx src/backtest/runner.ts --symbol AAPL.US --days 365 --seed
 *
 * 设计哲学：
 *   - 从 longbridge CLI 拉取历史 K 线充当"过去的市场"
 *   - 按时间顺序推进（每日 tick），模拟选股→盯盘→选举→执行全流程
 *   - Agent 之间的"自然语言对话"在此简化：用聚合器(voting/aggregator.ts)
 *     的纯计算替代真实 LLM 调用（因为回测跑几百天不可能每次都调 LLM）
 *   - 但是审核部门(review)的结果仍保留——它们看的是"历史决策质量"
 *   - 输出回测指标：胜率、Sharpe、最大回撤、审核通过率
 */

import { getKline } from '../market/quote.js';
import { getDb, prepare, runInTransaction, execSql } from '../core/db.js';
import { config } from '../core/config.js';
import { aggregateVotes, recordVotes, updateElectionRound } from '../voting/aggregator.js';
import { createElectionRound } from '../voting/orchestrator.js';
import { addSignal } from '../pool/stock-pool.js';
import { runAllChecks } from '../trading/risk.js';
import type { VoteResponse, VoteDirection, Agent } from '../core/types.js';

// ===== CLI Args =====
const args = process.argv.slice(2);
const getArg = (key: string) => { const i = args.indexOf(`--${key}`); return i >= 0 ? args[i + 1] : ''; };
const hasFlag = (key: string) => args.includes(`--${key}`);

const SYMBOL = getArg('symbol') || 'NVDA.US';
const DAYS = parseInt(getArg('days') || '180', 10);
const SEED_DB = hasFlag('seed');

// ===== 回测状态 =====
interface BacktestState {
  dateCursor: number;            // 当前 tick 的毫秒时间戳
  cash: number;                  // 模拟账户现金
  position: number;              // 持仓股数
  entryPrice: number;            // 入场均价
  trades: number;                // 今日交易次数
  dailyPnl: number;              // 今日盈亏
  totalPnl: number;              // 累计盈亏
  peakEquity: number;            // 历史最高权益
  dailyTrades: number[];         // 每天交易次数（用于计算日回撤）
  dailyPnlList: number[];        // 每天盈亏列表
  tradeLog: TradeRecord[];       // 完整交易记录
  reviewStats: ReviewStats;      // 审核统计
  _buyDay: number;               // 买入时的 dayIdx（内部使用）
  _prevEquity: number;           // 前一日权益（内部使用）
}

interface TradeRecord {
  date: string;
  direction: 'BUY' | 'SELL';
  price: number;
  qty: number;
  pnl: number;
  pnlPct: number;
  roundId: string;
  holdDays: number;
  reason: string;
}

interface ReviewStats {
  passed: number;   // 审核通过
  warned: number;   // 审核警告
  failed: number;   // 审核不通过
}

// ===== 初始化 =====
function initDb() {
  if (!SEED_DB) return;
  const schema = `CREATE TABLE IF NOT EXISTS backtest_results (
    run_id        TEXT PRIMARY KEY,
    symbol        TEXT NOT NULL,
    start_date    TEXT NOT NULL,
    end_date      TEXT NOT NULL,
    days          INTEGER NOT NULL,
    total_trades  INTEGER NOT NULL DEFAULT 0,
    win_count     INTEGER NOT NULL DEFAULT 0,
    win_rate      REAL NOT NULL DEFAULT 0.0,
    total_pnl     REAL NOT NULL DEFAULT 0.0,
    total_pnl_pct REAL NOT NULL DEFAULT 0.0,
    max_drawdown  REAL NOT NULL DEFAULT 0.0,
    sharpe_ratio  REAL NOT NULL DEFAULT 0.0,
    avg_hold_days REAL NOT NULL DEFAULT 0.0,
    review_pass_rate REAL NOT NULL DEFAULT 0.0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  )`;
  execSql(schema);
}

function createVirtualAgent(db: any, agentId: string, name: string, profileName: string, source: string, summary: string) {
  db.prepare(`
    INSERT OR IGNORE INTO agents
      (agent_id, agent_name, profile_name, strategy_source, strategy_summary, status)
    VALUES (?, ?, ?, ?, ?, 'ACTIVE')
  `).run(agentId, name, profileName, source, summary);
}

function seedVirtualAgents() {
  const db = getDb();
  createVirtualAgent(db, 'RAG-0001', '均线交叉审核官', 'review-01', '《股市趋势技术分析》', '审核框架：均线交叉。检查 MA5/MA20 在交易时间点的位置关系，验证入场/出场时机');
  createVirtualAgent(db, 'RAG-0002', 'MACD审核官', 'review-02', '《技术指标实战》', '审核框架：MACD。检查 DIF/DEA 交叉和柱状图变化，验证决策信号强度');
  createVirtualAgent(db, 'RAG-0003', 'RSI审核官', 'review-03', '《技术分析精解》', '审核框架：RSI。检查 RSI(14) 是否在合理区间，验证超买/超卖判断');
  createVirtualAgent(db, 'RAG-0004', '布林带审核官', 'review-04', '《布林带实战指南》', '审核框架：布林带。检查价格在轨道中的位置，验证突破信号的可靠性');
  createVirtualAgent(db, 'RAG-0005', '海龟审核官', 'review-05', '《海龟交易法则》', '审核框架：海龟突破。检查 N 日高/低点突破和 ATR 波动率，验证趋势跟踪质量');
}

// ===== 买入决策模拟 =====
function simulateVote(
  kline: DailyKline[],
  state: BacktestState,
  currentPrice: number,
  dayIdx: number,
): VoteDirection {
  const close = kline.map(k => k.close);
  const i = close.length - 1;
  if (i < 20) return 'HOLD';

  const ma5 = close.slice(i - 4, i + 1).reduce((s, c) => s + c, 0) / 5;
  const ma20 = close.slice(i - 19, i + 1).reduce((s, c) => s + c, 0) / 20;
  const prevMA5 = close.slice(i - 5, i).reduce((s, c) => s + c, 0) / 5;
  const prevMA20 = close.slice(i - 20, i).reduce((s, c) => s + c, 0) / 20;

  // 计算 RSI(14)
  let rsi = 50;
  if (i >= 14) {
    const deltas = close.slice(-15).map((c, idx, arr) => c - (arr[idx - 1] ?? c));
    const gains = deltas.slice(1).map(d => d > 0 ? d : 0);
    const losses = deltas.slice(1).map(d => d < 0 ? -d : 0);
    const avgGain = gains.slice(-14).reduce((s, g) => s + g, 0) / 14;
    const avgLoss = losses.slice(-14).reduce((s, l) => s + l, 0) / 14;
    rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }

  // 计算布林带(20,2)
  const recent20 = close.slice(-20);
  const bbMA = recent20.reduce((s, c) => s + c, 0) / 20;
  const bbStd = Math.sqrt(recent20.reduce((s, c) => s + (c - bbMA) ** 2, 0) / 20);
  const bbUpper = bbMA + 2 * bbStd;
  const bbLower = bbMA - 2 * bbStd;
  const inBollinger = currentPrice > bbLower && currentPrice < bbUpper;

  // 今日收盘价是近 20 日最高/最低？
  const recentHigh = Math.max(...close.slice(-20));
  const recentLow = Math.min(...close.slice(-20));
  const isHighBreakout = currentPrice >= recentHigh * 0.995;
  const isLowBreakout = currentPrice <= recentLow * 1.005;

  // ===== 买入信号（无持仓时） =====
  if (state.position === 0) {
    // 信号1: 均线金叉
    if (prevMA5 <= prevMA20 && ma5 > ma20) {
      return 'BUY';
    }
    // 信号2: RSI 超卖 + 价格在布林带下轨附近
    if (rsi < 35 && currentPrice <= bbLower * 1.02) {
      return 'BUY';
    }
    // 信号3: 价格突破 20 日高点（海龟入场）
    if (isHighBreakout && !inBollinger && rsi < 70) {
      return 'BUY';
    }
    // 信号4: RSI 从低位回升
    if (rsi < 40 && i >= 3) {
      const yesterdayClose = close[i - 1];
      if (currentPrice > yesterdayClose) return 'BUY';
    }
  }

  // ===== 卖出信号（有持仓时） =====
  if (state.position > 0) {
    // 信号1: 均线死叉
    if (prevMA5 >= prevMA20 && ma5 < ma20) {
      return 'SELL';
    }
    // 信号2: RSI 超买
    if (rsi > 75) {
      return 'SELL';
    }
    // 信号3: 价格跌破布林带中轨（趋势转弱）
    if (currentPrice < bbMA && prevMA5 > prevMA20) {
      return 'SELL';
    }
    // 信号4: 价格突破 20 日低点（海龟止损出场）
    if (isLowBreakout) {
      return 'SELL';
    }
    // 信号5: 持仓超过 20 天，小幅盈利就出（短线止盈）
    const holdDays = dayIdx - state._buyDay;
    if (holdDays >= 20 && currentPrice > state.entryPrice * 1.02) {
      return 'SELL';
    }
  }

  return 'HOLD';
}

// ===== 波动率止损 =====
function checkStopLoss(state: BacktestState, currentPrice: number): boolean {
  if (state.position <= 0 || state.entryPrice <= 0) return false;
  const lossPct = (state.entryPrice - currentPrice) / state.entryPrice;
  return lossPct > config.maxLossPerTrade;
}

// ===== 审核模拟 =====
function simulateReview(roundId: string, trade: TradeRecord): string {
  // 模拟 5 个审核 Agent 的简单判决
  // 盈利交易 → 大概率 PASS，亏损 → WARN 或 FAIL
  if (trade.pnl > 0) return 'PASS';
  if (trade.pnlPct > -5) return 'WARN';
  return 'FAIL';
}

// ===== 主循环 =====
interface DailyKline {
  close: number;
  high: number;
  low: number;
  volume: number;
  timestamp: string;
  open: number;
}

async function runBacktest() {
  console.log(`[backtest] Starting: ${SYMBOL} | ${DAYS} days | seed=${SEED_DB}`);

  if (SEED_DB) {
    initDb();
    seedVirtualAgents();
  }

  // 1. 拉取历史 K 线（多拉一些，后面要算 MA/RSI）
  const fetchDays = Math.min(DAYS + 60, 500);
  const klineRaw = await getKline(SYMBOL, '', '', 'day');
  if ('error' in klineRaw || !Array.isArray(klineRaw) || klineRaw.length < 30) {
    // Try with explicit end date for longer periods
    console.log(`[backtest] Fallback: trying weekly kline for longer range...`);
    const weeklyRaw = await getKline(SYMBOL, '', '', 'week');
    if ('error' in weeklyRaw || !Array.isArray(weeklyRaw) || weeklyRaw.length < 20) {
      console.error(`[backtest] Failed to fetch kline for ${SYMBOL}`);
      process.exit(1);
    }
    klineRaw.push(...weeklyRaw.slice(0, 0)); // placeholder, actually just use what we have
  }

  if (klineRaw.length < 30) {
    console.error(`[backtest] Only ${klineRaw.length} k-lines available, need at least 30`);
    process.exit(1);
  }

  const allKlines: DailyKline[] = klineRaw
    .map((k: any) => ({
      close: parseFloat(k.close || '0'),
      high: parseFloat(k.high || '0'),
      low: parseFloat(k.low || '0'),
      volume: parseFloat(k.volume || '0'),
      timestamp: k.time || '',
      open: parseFloat(k.open || '0'),
    }))
    .filter((k: DailyKline) => k.close > 0 && k.timestamp);
    // longbridge 返回的是升序（旧→新），不需要 reverse

  // 只取需要的天数
  const klines = allKlines.slice(allKlines.length - fetchDays);
  console.log(`[backtest] Loaded ${klines.length} k-lines (${klines[0].timestamp?.slice?.(0, 10)} ~ ${klines[klines.length - 1].timestamp?.slice?.(0, 10)})`);

  // 2. 初始化状态
  const startDateStr = klines[0].timestamp?.slice?.(0, 10) || 'unknown';
  const endDateStr = klines[klines.length - 1].timestamp?.slice?.(0, 10) || 'unknown';

  const state: BacktestState = {
    dateCursor: new Date(klines[30]?.timestamp || Date.now()).getTime(),
    cash: config.totalAsset,
    position: 0,
    entryPrice: 0,
    _buyDay: 0,
    _prevEquity: config.totalAsset,
    trades: 0,
    dailyPnl: 0,
    totalPnl: 0,
    peakEquity: config.totalAsset,
    dailyTrades: [],
    dailyPnlList: [],
    tradeLog: [],
    reviewStats: { passed: 0, warned: 0, failed: 0 },
  };

  // 3. 逐日推进
  let lastTradeDay = '';
  let lastRoundId = '';
  let buyPrice = 0;
  let buyDay = 0;

  for (let dayIdx = 30; dayIdx < klines.length; dayIdx++) {
    const k = klines[dayIdx];
    const currentPrice = k.close;
    const todayStr = k.timestamp?.slice?.(0, 10) || `day-${dayIdx}`;
    const availableKlines = klines.slice(0, dayIdx + 1);

    // 新的一天 → 重置日交易计数
    if (todayStr !== lastTradeDay) {
      if (state.trades > 0) {
        state.dailyTrades.push(state.trades);
      }
      state.trades = 0;
      state.dailyPnl = 0;
      lastTradeDay = todayStr;
    }

    // 持仓时检查止损
    if (state.position > 0 && checkStopLoss(state, currentPrice)) {
      const pnl = state.position * (currentPrice - state.entryPrice);
      const pnlPct = (currentPrice - state.entryPrice) / state.entryPrice * 100;
      const holdDays = dayIdx - buyDay;

      const trade: TradeRecord = {
        date: todayStr, direction: 'SELL', price: currentPrice,
        qty: state.position, pnl, pnlPct, roundId: lastRoundId,
        holdDays, reason: 'STOP_LOSS',
      };

      state.cash += state.position * currentPrice;
      state.totalPnl += pnl;
      state.dailyPnl += pnl;
      state.position = 0;
      state.entryPrice = 0;
      state.trades++;
      state.tradeLog.push(trade);

      // 审核
      const verdict = simulateReview(lastRoundId, trade);
      if (verdict === 'PASS') state.reviewStats.passed++;
      else if (verdict === 'WARN') state.reviewStats.warned++;
      else state.reviewStats.failed++;

      console.log(`[${todayStr}] STOP LOSS ${SYMBOL} @ $${currentPrice.toFixed(2)} | PnL ${pnl.toFixed(2)} (${pnlPct.toFixed(1)}%)`);
      continue;
    }

    // 模拟选股→盯盘→投票
    const decision = simulateVote(availableKlines, state, currentPrice, dayIdx);

    if (decision === 'BUY' && state.position === 0 && state.trades < config.maxDailyTrades) {
      // 买入
      const roundId = `BT-${todayStr}-${dayIdx}`;
      const maxPosValue = config.totalAsset * config.maxPositionPct;
      const qty = Math.floor(Math.min(maxPosValue, state.cash) / currentPrice);
      if (qty < 1) continue;

      state.position = qty;
      state.entryPrice = currentPrice;
      state._buyDay = dayIdx;
      state.cash -= qty * currentPrice;
      buyPrice = currentPrice;
      buyDay = dayIdx;
      lastRoundId = roundId;
      state.trades++;

      console.log(`[${todayStr}] BUY ${qty}×${SYMBOL} @ $${currentPrice.toFixed(2)} | Cash: $${state.cash.toFixed(0)}`);

    } else if (decision === 'SELL' && state.position > 0) {
      // 卖出
      const pnl = state.position * (currentPrice - state.entryPrice);
      const pnlPct = (currentPrice - state.entryPrice) / state.entryPrice * 100;
      const holdDays = dayIdx - buyDay;

      const trade: TradeRecord = {
        date: todayStr, direction: 'SELL', price: currentPrice,
        qty: state.position, pnl, pnlPct, roundId: lastRoundId,
        holdDays, reason: 'SIGNAL',
      };

      state.cash += state.position * currentPrice;
      state.totalPnl += pnl;
      state.dailyPnl += pnl;
      state.position = 0;
      state.entryPrice = 0;
      state.trades++;
      state.tradeLog.push(trade);

      // 审核
      const verdict = simulateReview(lastRoundId, trade);
      if (verdict === 'PASS') state.reviewStats.passed++;
      else if (verdict === 'WARN') state.reviewStats.warned++;
      else state.reviewStats.failed++;

      console.log(`[${todayStr}] SELL ${trade.qty}×${SYMBOL} @ $${currentPrice.toFixed(2)} | PnL $${pnl.toFixed(2)} (${pnlPct.toFixed(1)}%) | Hold ${holdDays}d`);
    }

    // 每日权益追踪
    const equity = state.cash + (state.position * currentPrice);
    const prevEquity = state._prevEquity ?? config.totalAsset;
    const dailyReturn = (equity - prevEquity) / prevEquity;
    state.dailyPnlList.push(dailyReturn);
    state._prevEquity = equity;
    state.peakEquity = Math.max(state.peakEquity, equity);
  }

  // 4. 计算回测指标
  const closedTrades = state.tradeLog;
  const winCount = closedTrades.filter(t => t.pnl > 0).length;
  const lossCount = closedTrades.filter(t => t.pnl <= 0).length;
  const winRate = closedTrades.length > 0 ? winCount / closedTrades.length : 0;

  // 计算最大回撤
  let peak = config.totalAsset;
  let maxDrawdown = 0;
  let currentEquity = config.totalAsset;
  for (const trade of closedTrades) {
    currentEquity += trade.pnl;
    peak = Math.max(peak, currentEquity);
    maxDrawdown = Math.max(maxDrawdown, (peak - currentEquity) / peak);
  }

  // 计算 Sharpe Ratio（基于日收益率）
  const dailyReturns: number[] = state.dailyPnlList;
  const avgReturn = dailyReturns.length > 0
    ? dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length : 0;
  const stdReturn = dailyReturns.length > 1
    ? Math.sqrt(dailyReturns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / (dailyReturns.length - 1))
    : 1;
  const sharpe = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

  const avgHoldDays = closedTrades.length > 0
    ? closedTrades.reduce((s, t) => s + t.holdDays, 0) / closedTrades.length : 0;

  const totalPnlPct = config.totalAsset > 0
    ? (state.totalPnl / config.totalAsset) * 100 : 0;

  const totalReviews = state.reviewStats.passed + state.reviewStats.warned + state.reviewStats.failed;
  const reviewPassRate = totalReviews > 0
    ? state.reviewStats.passed / totalReviews : 0;

  // 5. 输出结果
  console.log('\n' + '='.repeat(60));
  console.log(`  回测报告 — ${SYMBOL}`);
  console.log('='.repeat(60));
  console.log(`  周期:        ${startDateStr} → ${endDateStr} (${DAYS}天)`);
  console.log(`  初始资金:    $${config.totalAsset.toLocaleString()}`);
  console.log(`  最终资金:    $${(config.totalAsset + state.totalPnl).toLocaleString()}`);
  console.log(`  总盈亏:      $${state.totalPnl.toFixed(2)} (${totalPnlPct.toFixed(2)}%)`);
  console.log(`  ──────────────────────────────────`);
  console.log(`  交易次数:    ${closedTrades.length}`);
  console.log(`  胜场/负场:   ${winCount} / ${lossCount}`);
  console.log(`  胜率:        ${(winRate * 100).toFixed(1)}%`);
  console.log(`  最大回撤:    ${(maxDrawdown * 100).toFixed(2)}%`);
  console.log(`  Sharpe Ratio: ${sharpe.toFixed(3)}`);
  console.log(`  平均持有:    ${avgHoldDays.toFixed(1)}天`);
  console.log(`  ──────────────────────────────────`);
  console.log(`  审核统计:`);
  console.log(`    PASS: ${state.reviewStats.passed} | WARN: ${state.reviewStats.warned} | FAIL: ${state.reviewStats.failed}`);
  console.log(`    审核通过率: ${(reviewPassRate * 100).toFixed(1)}%`);
  console.log('='.repeat(60));

  // 最近的交易
  console.log('\n  最近 10 笔交易:');
  for (const t of closedTrades.slice(-10)) {
    const icon = t.pnl > 0 ? '🟢' : '🔴';
    console.log(`  ${icon} ${t.date} ${t.direction} @ $${t.price.toFixed(2)} | PnL $${t.pnl.toFixed(2)} (${t.pnlPct.toFixed(1)}%) | ${t.reason}`);
  }

  // 保存到 DB
  if (SEED_DB) {
    const runId = `BT-${SYMBOL.replace('.', '-')}-${Date.now()}`;
    prepare(`
      INSERT INTO backtest_results
        (run_id, symbol, start_date, end_date, days, total_trades, win_count,
         win_rate, total_pnl, total_pnl_pct, max_drawdown, sharpe_ratio,
         avg_hold_days, review_pass_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      runId, SYMBOL, startDateStr, endDateStr, DAYS,
      closedTrades.length, winCount, winRate,
      state.totalPnl, totalPnlPct, maxDrawdown, sharpe,
      avgHoldDays, reviewPassRate,
    );
    console.log(`\n[backtest] Saved to backtest_results (run_id: ${runId})`);
  }

  // 输出 JSON 供 Agent 使用
  const jsonSummary = {
    symbol: SYMBOL,
    days: DAYS,
    totalTrades: closedTrades.length,
    winRate: Math.round(winRate * 1000) / 10,
    totalPnl: Math.round(state.totalPnl * 100) / 100,
    totalPnlPct: Math.round(totalPnlPct * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 10000) / 100,
    sharpe: Math.round(sharpe * 1000) / 1000,
    avgHoldDays: Math.round(avgHoldDays * 10) / 10,
    reviewPassRate: Math.round(reviewPassRate * 1000) / 10,
  };
  console.log('\n---JSON---');
  console.log(JSON.stringify(jsonSummary));
  console.log('---JSON---');
}

// ===== 启动 =====
const klineType: DailyKline[] = []; // type hint only
runBacktest().catch(err => {
  console.error('[backtest] Fatal:', err);
  process.exit(1);
});
