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

// ===== 新增接口 =====

/** 滑点与佣金模型 */
interface CostModel {
  /** 滑点比例（双向，如 0.001 = 0.1%） */
  slippagePct: number;
  /** 每笔固定佣金（如 1.0 = $1/笔） */
  commissionPerTrade: number;
  /** 每股佣金（如 0.005 = $0.005/股） */
  commissionPerShare: number;
}

/** 滚动窗口配置 */
interface WalkForwardConfig {
  /** 训练窗口（天），如 252 = 一年 */
  trainDays: number;
  /** 测试窗口（天），如 63 = 一季 */
  testDays: number;
  /** 步长（天），如 63 */
  stepSize: number;
}

/** 网格搜索参数范围 */
interface GridSearchConfig {
  /** 参数 → 候选值数组 */
  paramRanges: Record<string, number[]>;
  /** 滚动窗口配置 */
  walkForward: WalkForwardConfig;
  /** 成本模型 */
  costModel: CostModel;
}

/** 完整回测结果 */
interface BacktestResult {
  sharpe: number;
  sortino: number;
  calmar: number;
  maxDrawdown: number;
  profitFactor: number;
  totalReturn: number;
  cagr: number;
  trades: number;
  winRate: number;
  equityCurve: number[];
}

// ===== CLI Args =====
const args = process.argv.slice(2);
const getArg = (key: string) => { const i = args.indexOf(`--${key}`); return i >= 0 ? args[i + 1] : ''; };
const hasFlag = (key: string) => args.includes(`--${key}`);

const SYMBOL = getArg('symbol') || 'NVDA.US';
const DAYS = parseInt(getArg('days') || '180', 10);
const SEED_DB = hasFlag('seed');
const GRID_SEARCH = hasFlag('grid-search');
const FROM_FILE = getArg('from-file') || '';

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
  createVirtualAgent(db, 'RAG-0001', '综合技术面审核官', 'review-auditor', '《技术分析合集》', '综合审核：涵盖均线交叉、MACD、RSI、布林带、海龟突破等多维度技术分析框架，检查入场/出场时机、信号强度、超买/超卖区间、轨道位置及趋势跟踪质量');
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

// ===== 新增指标函数 =====

/**
 * Diebold-Mariano 统计量（跨 Walk-Forward 窗口）
 * 原论文: Diebold & Mariano (1995), JBES
 * HLN 小样本修正: Harvey, Leybourne & Newbold (1997), IJF
 */
function dieboldMariano(
  strategyReturns: number[][],
  benchmarkReturns: number[][],
): { dmStat: number; pValue: number; hlnAdjStat: number } {
  if (strategyReturns.length < 2 || strategyReturns.some(r => r.length < 5)) {
    return { dmStat: 0, pValue: 1, hlnAdjStat: 0 };
  }
  // 每个窗口计算 loss differential (MSE: negative return = worse)
  const allD: number[] = [];
  for (let w = 0; w < strategyReturns.length; w++) {
    const minLen = Math.min(strategyReturns[w].length, benchmarkReturns[w].length);
    for (let i = 0; i < minLen; i++) {
      const d = (strategyReturns[w][i] - 0.02 / 252) ** 2 - (benchmarkReturns[w][i] - 0.02 / 252) ** 2;
      allD.push(d);
    }
  }
  if (allD.length < 10) return { dmStat: 0, pValue: 1, hlnAdjStat: 0 };
  const meanD = allD.reduce((s, v) => s + v, 0) / allD.length;
  const T = allD.length;
  // Newey-West HAC variance (lag = floor(T^(1/4)))
  const h = Math.max(1, Math.floor(Math.pow(T, 0.25)));
  let varEst = 0;
  for (let i = 0; i < T; i++) {
    const ddm = allD[i] - meanD;
    varEst += ddm * ddm;
    for (let j = 1; j <= h && i + j < T; j++) {
      const wgt = 1 - j / (h + 1);
      varEst += 2 * wgt * ddm * (allD[i + j] - meanD);
    }
  }
  varEst /= T;
  if (varEst <= 0) return { dmStat: 0, pValue: 1, hlnAdjStat: 0 };
  const dmStat = meanD / Math.sqrt(varEst / T);
  // HLN 小样本修正
  const hlnAdj = dmStat * Math.sqrt((T + 1 - 2 * h + h * (h - 1) / T) / T);
  // 近似 p 值（用 norm 近似 t(T-1)）
  const pVal = (() => {
    const z = Math.abs(hlnAdj);
    // 近似标准正态 CDF (Abramowitz & Stegun 26.2.17)
    const b0 = 0.2316419, b1 = 0.319381530, b2 = -0.356563782, b3 = 1.781477937, b4 = -1.821255978, b5 = 1.330274429;
    const t = 1 / (1 + b0 * z);
    const phi = Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
    const cdf = 1 - phi * (b1 * t + b2 * t * t + b3 * t * t * t + b4 * t * t * t * t + b5 * t * t * t * t * t);
    return Math.max(0, Math.min(1, (1 - cdf) * 2));
  })();
  return { dmStat, pValue: pVal, hlnAdjStat };
}

/**
 * 滚动 Sharpe 衰减标记
 * 计算最近 N 天的 Sharpe，和峰值对比
 */
function decayFlag(
  dailyReturns: number[],
  recentDays: number = 60,
): { recentSharpe: number; peakSharpe: number; ratio: number; flag: 'OK' | 'DECAYING' | 'DEGRADED' } {
  if (dailyReturns.length < recentDays + 20) return { recentSharpe: 0, peakSharpe: 0, ratio: 1, flag: 'OK' };
  const recent = dailyReturns.slice(-recentDays);
  const older = dailyReturns.slice(0, dailyReturns.length - recentDays);
  const calcSharpe = (arr: number[]) => {
    if (arr.length < 5) return 0;
    const mu = arr.reduce((s, v) => s + v, 0) / arr.length;
    const std = Math.sqrt(arr.reduce((s, v) => s + (v - mu) ** 2, 0) / (arr.length - 1));
    return std > 0 ? (mu / std) * Math.sqrt(252) : 0;
  };
  const recentSh = calcSharpe(recent);
  // 对 older 分段取峰值的 80% 分位
  const chunkSize = recentDays;
  const chunks: number[] = [];
  for (let i = 0; i < older.length; i += chunkSize) {
    const chunk = older.slice(i, i + chunkSize);
    if (chunk.length > 20) chunks.push(calcSharpe(chunk));
  }
  const peakSh = chunks.length > 0 ? chunks.sort((a, b) => b - a)[Math.floor(chunks.length * 0.2)] : calcSharpe(older);
  const ratio = peakSh !== 0 ? recentSh / peakSh : (recentSh !== 0 ? 0 : 1);
  const flag = recentSh < 0 ? 'DEGRADED' : ratio < 0.3 ? 'DEGRADED' : ratio < 0.5 ? 'DECAYING' : 'OK';
  return { recentSharpe: recentSh, peakSharpe: peakSh, ratio, flag };
}

/** 计算日收益率序列 */
function calcDailyReturns(equityCurve: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    if (equityCurve[i - 1] > 0) {
      returns.push((equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1]);
    }
  }
  return returns;
}

/** Sortino Ratio — 只惩罚下行波动 */
function sortinoRatio(returns: number[], rf: number = 0, target: number = 0): number {
  if (returns.length < 2) return 0;
  const excessReturns = returns.map(r => r - rf);
  const downside = returns.filter(r => r < target).map(r => (r - target) ** 2);
  if (downside.length === 0) return 0;
  const downsideDev = Math.sqrt(downside.reduce((a, b) => a + b, 0) / returns.length);
  if (downsideDev === 0) return 0;
  const meanExcess = excessReturns.reduce((a, b) => a + b, 0) / returns.length;
  // 年化：假设日收益率，* sqrt(252)
  return (meanExcess / downsideDev) * Math.sqrt(252);
}

/** Calmar Ratio — CAGR / |MaxDrawdown| */
function calmarRatio(equityCurve: number[]): number {
  if (equityCurve.length < 2) return 0;
  const startVal = equityCurve[0];
  const endVal = equityCurve[equityCurve.length - 1];
  const totalReturn = endVal / startVal - 1;
  const days = equityCurve.length;
  const years = days / 252;
  const cagr = years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0;
  let peak = equityCurve[0];
  let maxDD = 0;
  for (const v of equityCurve) {
    if (v > peak) peak = v;
    const dd = (peak - v) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD === 0 ? 0 : cagr / maxDD;
}

/** 最大回撤 */
function calcMaxDrawdown(equityCurve: number[]): number {
  let peak = equityCurve[0];
  let maxDD = 0;
  for (const v of equityCurve) {
    if (v > peak) peak = v;
    const dd = (peak - v) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

/** 总收益率 + CAGR */
function calcReturnAndCAGR(equityCurve: number[]): { totalReturn: number; cagr: number } {
  if (equityCurve.length < 2) return { totalReturn: 0, cagr: 0 };
  const totalReturn = equityCurve[equityCurve.length - 1] / equityCurve[0] - 1;
  const years = equityCurve.length / 252;
  const cagr = years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0;
  return { totalReturn, cagr };
}

/** Profit Factor = 总盈利 / 总亏损 */
function profitFactor(trades: TradeRecord[]): number {
  const grossProfit = trades.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
  const grossLoss = trades.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0);
  if (grossLoss === 0) return grossProfit > 0 ? Infinity : 1;
  return grossProfit / Math.abs(grossLoss);
}

/** 滑点修正价格 */
function applySlippage(price: number, direction: 'BUY' | 'SELL', cost: CostModel): number {
  if (direction === 'BUY') {
    return price * (1 + cost.slippagePct) + cost.commissionPerShare;
  } else {
    return price * (1 - cost.slippagePct) - cost.commissionPerShare;
  }
}

/** 计算所有回测指标 → BacktestResult */
function computeMetrics(
  state: BacktestState,
  trades: TradeRecord[],
  equityCurve: number[],
  costModel?: CostModel,
): BacktestResult {
  const dailyReturns = calcDailyReturns(equityCurve);
  const winCount = trades.filter(t => t.pnl > 0).length;
  const winRate = trades.length > 0 ? winCount / trades.length : 0;
  const { totalReturn, cagr } = calcReturnAndCAGR(equityCurve);
  const maxDD = calcMaxDrawdown(equityCurve);

  // Sharpe（年化）
  const avgReturn = dailyReturns.length > 0
    ? dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length : 0;
  const stdReturn = dailyReturns.length > 1
    ? Math.sqrt(dailyReturns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / (dailyReturns.length - 1))
    : 1;
  const sharpe = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

  return {
    sharpe: Math.round(sharpe * 1000) / 1000,
    sortino: Math.round(sortinoRatio(dailyReturns) * 1000) / 1000,
    calmar: Math.round(calmarRatio(equityCurve) * 1000) / 1000,
    maxDrawdown: Math.round(maxDD * 10000) / 100,
    profitFactor: Math.round(profitFactor(trades) * 100) / 100,
    totalReturn: Math.round(totalReturn * 10000) / 100,
    cagr: Math.round(cagr * 10000) / 100,
    trades: trades.length,
    winRate: Math.round(winRate * 1000) / 10,
    equityCurve,
  };
}

/** 网格搜索：遍历参数组合，返回按 Sharpe 排序的结果 */
function gridSearch(
  klines: DailyKline[],
  config: GridSearchConfig,
): { params: Record<string, number>; metrics: BacktestResult }[] {
  const keys = Object.keys(config.paramRanges);
  if (keys.length === 0) return [];

  // 生成所有参数组合的笛卡尔积（避免 Generator 以免需要 downlevelIteration）
  const values = keys.map(k => config.paramRanges[k]);
  function buildCombinations(arrs: number[][]): number[][] {
    if (arrs.length === 0) return [[]];
    const [first, ...rest] = arrs;
    const subCombos = buildCombinations(rest);
    const result: number[][] = [];
    for (const v of first) {
      for (const combo of subCombos) {
        result.push([v, ...combo]);
      }
    }
    return result;
  }
  const results: { params: Record<string, number>; metrics: BacktestResult }[] = [];
  let comboIdx = 0;

  const allCombos = buildCombinations(values);
  for (const combo of allCombos) {
    const paramObj: Record<string, number> = {};
    keys.forEach((k, i) => { paramObj[k] = combo[i]; });
    comboIdx++;

    // 目前只支持 slippage 参数的网格搜索，
    // 未来可以通过注入来扩展其他参数
    const localCost: CostModel = {
      slippagePct: paramObj['slippage'] ?? config.costModel.slippagePct,
      commissionPerTrade: paramObj['commission'] ?? config.costModel.commissionPerTrade,
      commissionPerShare: paramObj['commissionPerShare'] ?? config.costModel.commissionPerShare,
    };

    // Walk-Forward 跑参数组合
    const wfResults: BacktestResult[] = [];
    const { trainDays, testDays, stepSize } = config.walkForward;
    const nWin = Math.max(1, Math.floor((klines.length - trainDays - testDays) / stepSize) + 1);

    for (let w = 0; w < nWin; w++) {
      const testStart = 30 + trainDays + w * stepSize;
      const testEnd = Math.min(testStart + testDays, klines.length);
      if (testEnd >= klines.length) break;

      const gsState: BacktestState = {
        dateCursor: 0, cash: 10000,
        position: 0, entryPrice: 0, _buyDay: 0, _prevEquity: 10000,
        trades: 0, dailyPnl: 0, totalPnl: 0, peakEquity: 10000,
        dailyTrades: [], dailyPnlList: [], tradeLog: [],
        reviewStats: { passed: 0, warned: 0, failed: 0 },
      };
      const gsEquity: number[] = [10000];
      for (let di = testStart; di < testEnd; di++) {
        const gk = klines[di];
        const gp = gk.close;
        const gklines = klines.slice(0, di + 1);
        const gd = simulateVote(gklines, gsState, gp, di);
        if (gd === 'BUY' && gsState.position === 0 && gsState.trades < 2) {
          const fill = applySlippage(gp, 'BUY', localCost);
          const c = localCost.commissionPerTrade;
          const q = Math.floor((10000 * 0.25) / fill);
          if (q >= 1) { gsState.position = q; gsState.entryPrice = fill + c / q; gsState.cash -= q * fill + c; gsState.trades++; }
        } else if (gd === 'SELL' && gsState.position > 0) {
          const fill = applySlippage(gp, 'SELL', localCost);
          const c = localCost.commissionPerTrade;
          const pnl = gsState.position * (fill - gsState.entryPrice) - c;
          gsState.cash += gsState.position * fill - c;
          gsState.totalPnl += pnl;
          gsState.position = 0; gsState.entryPrice = 0; gsState.trades++;
        }
        gsEquity.push(gsState.cash + gsState.position * gp);
      }
      wfResults.push(computeMetrics(gsState, gsState.tradeLog, gsEquity));
    }

    const avgMetrics: BacktestResult = {
      sharpe: wfResults.reduce((s, m) => s + m.sharpe, 0) / wfResults.length,
      sortino: wfResults.reduce((s, m) => s + m.sortino, 0) / wfResults.length,
      calmar: wfResults.reduce((s, m) => s + m.calmar, 0) / wfResults.length,
      maxDrawdown: wfResults.reduce((s, m) => s + m.maxDrawdown, 0) / wfResults.length,
      profitFactor: wfResults.reduce((s, m) => s + m.profitFactor, 0) / wfResults.length,
      totalReturn: wfResults.reduce((s, m) => s + m.totalReturn, 0) / wfResults.length,
      cagr: wfResults.reduce((s, m) => s + m.cagr, 0) / wfResults.length,
      trades: Math.round(wfResults.reduce((s, m) => s + m.trades, 0) / wfResults.length),
      winRate: wfResults.reduce((s, m) => s + m.winRate, 0) / wfResults.length,
      equityCurve: [],
    };

    results.push({ params: paramObj, metrics: avgMetrics });
    console.log(`  [GS ${comboIdx}] ${JSON.stringify(paramObj)} → SR=${avgMetrics.sharpe.toFixed(3)} SoR=${avgMetrics.sortino.toFixed(3)} CR=${avgMetrics.calmar.toFixed(3)} Ret=${avgMetrics.totalReturn.toFixed(1)}%`);
  }

  // 按 Sharpe 降序排序
  results.sort((a, b) => b.metrics.sharpe - a.metrics.sharpe);
  return results;
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

  // 拉取历史 K 线（多拉一些，后面要算 MA/RSI）
  const fetchDays = Math.min(DAYS + 60, 500);
  let allKlinesRaw: any[] | { error: string };

  if (FROM_FILE) {
    // 从 JSON 文件读取，跳过 longbridge CLI
    const fs = await import('node:fs');
    const fileContent = fs.readFileSync(FROM_FILE, 'utf-8');
    allKlinesRaw = JSON.parse(fileContent);
    console.log(`[backtest] Loaded ${allKlinesRaw.length} k-lines from ${FROM_FILE}`);
  } else {
    const klineRaw = await getKline(SYMBOL, '', '', 'day');
    if ('error' in klineRaw || !Array.isArray(klineRaw) || klineRaw.length < 30) {
      // Try with explicit end date for longer periods
      console.log(`[backtest] Fallback: trying weekly kline for longer range...`);
      const weeklyRaw = await getKline(SYMBOL, '', '', 'week');
      if ('error' in weeklyRaw || !Array.isArray(weeklyRaw) || weeklyRaw.length < 20) {
        console.error(`[backtest] Failed to fetch kline for ${SYMBOL}`);
        process.exit(1);
      }
      klineRaw.push(...weeklyRaw.slice(0, 0));
    }

    if (klineRaw.length < 30) {
      console.error(`[backtest] Only ${klineRaw.length} k-lines available, need at least 30`);
      process.exit(1);
    }
    allKlinesRaw = klineRaw;
  }

  const allKlines: DailyKline[] = allKlinesRaw
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

  // 默认成本模型（可通过 --slippage 等覆盖）
  const costModel: CostModel = {
    slippagePct: parseFloat(getArg('slippage') || '0.001'),
    commissionPerTrade: parseFloat(getArg('commission-per-trade') || '0.5'),
    commissionPerShare: parseFloat(getArg('commission-per-share') || '0.0'),
  };

  // 是否启用 Walk-Forward
  const wfDays = parseInt(getArg('walk-forward-days') || '0', 10);
  const walkForwardEnabled = wfDays > 0;
  const walkForward: WalkForwardConfig = {
    trainDays: parseInt(getArg('wf-train') || '252', 10),
    testDays: parseInt(getArg('wf-test') || '63', 10),
    stepSize: parseInt(getArg('wf-step') || '63', 10),
  };

  // 权益曲线（逐日记录）
  const equityCurve: number[] = [config.totalAsset];

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
      const fillPrice = applySlippage(currentPrice, 'SELL', costModel);
      const pnl = state.position * (fillPrice - state.entryPrice);
      const pnlPct = (fillPrice - state.entryPrice) / state.entryPrice * 100;
      const holdDays = dayIdx - buyDay;
      const commission = costModel.commissionPerTrade;

      const trade: TradeRecord = {
        date: todayStr, direction: 'SELL', price: fillPrice,
        qty: state.position, pnl: pnl - commission, pnlPct, roundId: lastRoundId,
        holdDays, reason: 'STOP_LOSS',
      };

      state.cash += state.position * fillPrice - commission;
      state.totalPnl += pnl - commission;
      state.dailyPnl += pnl - commission;
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
      const fillPrice = applySlippage(currentPrice, 'BUY', costModel);
      const commission = costModel.commissionPerTrade;
      const roundId = `BT-${todayStr}-${dayIdx}`;
      const maxPosValue = config.totalAsset * config.maxPositionPct;
      const qty = Math.floor(Math.min(maxPosValue, state.cash) / fillPrice);
      if (qty < 1) continue;

      state.position = qty;
      state.entryPrice = fillPrice + commission / qty; // 分摊佣金到持仓成本
      state._buyDay = dayIdx;
      state.cash -= qty * fillPrice + commission;
      buyPrice = fillPrice;
      buyDay = dayIdx;
      lastRoundId = roundId;
      state.trades++;

      console.log(`[${todayStr}] BUY ${qty}×${SYMBOL} @ $${fillPrice.toFixed(2)} (signal: $${currentPrice.toFixed(2)}) | Cash: $${state.cash.toFixed(0)}`);

    } else if (decision === 'SELL' && state.position > 0) {
      // 卖出
      const fillPrice = applySlippage(currentPrice, 'SELL', costModel);
      const pnl = state.position * (fillPrice - state.entryPrice);
      const pnlPct = (fillPrice - state.entryPrice) / state.entryPrice * 100;
      const holdDays = dayIdx - buyDay;
      const commission = costModel.commissionPerTrade;

      const trade: TradeRecord = {
        date: todayStr, direction: 'SELL', price: fillPrice,
        qty: state.position, pnl: pnl - commission, pnlPct, roundId: lastRoundId,
        holdDays, reason: 'SIGNAL',
      };

      state.cash += state.position * fillPrice - commission;
      state.totalPnl += pnl - commission;
      state.dailyPnl += pnl - commission;
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
    equityCurve.push(equity);
  }

  // 4a. Walk-Forward Validation（当 --walk-forward-days > 0 时启用）
  let walkForwardMetrics: BacktestResult[] = [];
  if (walkForwardEnabled) {
    console.log(`\n[backtest] Walk-Forward Validation: train=${walkForward.trainDays}d test=${walkForward.testDays}d step=${walkForward.stepSize}d`);
    const nWindows = Math.max(1, Math.floor((klines.length - walkForward.trainDays - walkForward.testDays) / walkForward.stepSize) + 1);
    for (let w = 0; w < nWindows; w++) {
      const trainStart = 30; // warmup
      const trainEnd = trainStart + walkForward.trainDays + w * walkForward.stepSize;
      const testStart = trainEnd;
      const testEnd = Math.min(testStart + walkForward.testDays, klines.length);
      if (testEnd >= klines.length) break;

      // 在测试窗口运行回测
      const wfState: BacktestState = {
        dateCursor: 0,
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
      const wfEquity: number[] = [config.totalAsset];

      for (let di = testStart; di < testEnd; di++) {
        const wk = klines[di];
        const wfPrice = wk.close;
        const wfKlines = klines.slice(0, di + 1);
        const wfDecision = simulateVote(wfKlines, wfState, wfPrice, di);

        if (wfDecision === 'BUY' && wfState.position === 0 && wfState.trades < config.maxDailyTrades) {
          const fill = applySlippage(wfPrice, 'BUY', costModel);
          const comm = costModel.commissionPerTrade;
          const maxPos = config.totalAsset * config.maxPositionPct;
          const qty = Math.floor(Math.min(maxPos, wfState.cash) / fill);
          if (qty >= 1) {
            wfState.position = qty;
            wfState.entryPrice = fill + comm / qty;
            wfState.cash -= qty * fill + comm;
            wfState.trades++;
          }
        } else if (wfDecision === 'SELL' && wfState.position > 0) {
          const fill = applySlippage(wfPrice, 'SELL', costModel);
          const comm = costModel.commissionPerTrade;
          const pnl = wfState.position * (fill - wfState.entryPrice) - comm;
          wfState.cash += wfState.position * fill - comm;
          wfState.totalPnl += pnl;
          wfState.position = 0;
          wfState.entryPrice = 0;
          wfState.trades++;
        }

        const wfEqVal = wfState.cash + wfState.position * wfPrice;
        wfEquity.push(wfEqVal);
      }

      const wfMetrics = computeMetrics(wfState, wfState.tradeLog, wfEquity);
      walkForwardMetrics.push(wfMetrics);
      console.log(`  [WF window ${w + 1}/${nWindows}] ${klines[testStart].timestamp?.slice?.(0, 10)}~${klines[testEnd - 1].timestamp?.slice?.(0, 10)} | SR=${wfMetrics.sharpe.toFixed(2)} SoR=${wfMetrics.sortino.toFixed(2)} CR=${wfMetrics.calmar.toFixed(2)} Ret=${wfMetrics.totalReturn.toFixed(1)}% DD=${wfMetrics.maxDrawdown.toFixed(1)}%`);
    }

    // 汇总 Walk-Forward 指标
    const avgSharpe = walkForwardMetrics.reduce((s, m) => s + m.sharpe, 0) / walkForwardMetrics.length;
    const avgSortino = walkForwardMetrics.reduce((s, m) => s + m.sortino, 0) / walkForwardMetrics.length;
    const avgCalmar = walkForwardMetrics.reduce((s, m) => s + m.calmar, 0) / walkForwardMetrics.length;
    const avgReturn = walkForwardMetrics.reduce((s, m) => s + m.totalReturn, 0) / walkForwardMetrics.length;
    const avgDD = walkForwardMetrics.reduce((s, m) => s + m.maxDrawdown, 0) / walkForwardMetrics.length;
    console.log(`  ──────────────────────────────────`);
    console.log(`  WF Avg: Sharpe=${avgSharpe.toFixed(3)} Sortino=${avgSortino.toFixed(3)} Calmar=${avgCalmar.toFixed(3)} Ret=${avgReturn.toFixed(2)}% DD=${avgDD.toFixed(2)}%`);

    // Diebold-Mariano 检验：收集每个 WF 窗口的日收益率
    const wfDailyReturns = walkForwardMetrics.map(m => m.equityCurve.length > 0 ? calcDailyReturns(m.equityCurve) : []);
    // 基准（等权买入持有 daily return ≈ targetReturn/252）
    const benchmarkReturns = wfDailyReturns.map(r => r.map(() => 0.02 / 252)); // 2% annual benchmark
    const dm = dieboldMariano(wfDailyReturns, benchmarkReturns);
    console.log(`  DM Stat=${dm.dmStat.toFixed(3)} HLN-adj=${dm.hlnAdjStat.toFixed(3)} p-value=${dm.pValue.toFixed(4)}`);
    console.log(`  DM ${dm.pValue < 0.05 ? '✅' : '⚠️'} ${dm.pValue < 0.05 ? '策略显著优于基准' : '策略与基准无显著差异'}`);
  }

  // 滚动 Sharpe 衰减检测
  const dailyRet = calcDailyReturns(equityCurve);
  const decayInfo = decayFlag(dailyRet);
  if (dailyRet.length >= 80) {
    console.log(`  Rolling Sharpe (60d): ${decayInfo.recentSharpe.toFixed(3)} | Peak: ${decayInfo.peakSharpe.toFixed(3)} | Ratio: ${decayInfo.ratio.toFixed(3)}`);
    const flagIcon = decayInfo.flag === 'OK' ? '✅' : decayInfo.flag === 'DECAYING' ? '⚠️' : '🚨';
    console.log(`  Decay: ${flagIcon} ${decayInfo.flag === 'OK' ? '正常' : decayInfo.flag === 'DECAYING' ? '策略可能衰减' : '策略严重退化'}`);
  }

  // 4b. Grid Search（--grid-search 启用）
  let gridResults: { params: Record<string, number>; metrics: BacktestResult }[] = [];
  if (GRID_SEARCH) {
    const gsConfig: GridSearchConfig = {
      paramRanges: {
        slippage: [0, 0.001, 0.003, 0.005],
        commission: [0, 0.5, 1.0, 2.0],
      },
      walkForward: walkForwardEnabled ? walkForward : { trainDays: 252, testDays: 63, stepSize: 63 },
      costModel,
    };
    console.log(`\n[backtest] Grid Search: ${Object.keys(gsConfig.paramRanges).map(k => `${k}=${JSON.stringify(gsConfig.paramRanges[k])}`).join(', ')}`);
    gridResults = gridSearch(klines, gsConfig);
    console.log(`\n  Grid Search Top 3:`);
    for (let i = 0; i < Math.min(3, gridResults.length); i++) {
      const g = gridResults[i];
      console.log(`  #${i + 1}: ${JSON.stringify(g.params)} → SR=${g.metrics.sharpe.toFixed(3)} SoR=${g.metrics.sortino.toFixed(3)} CR=${g.metrics.calmar.toFixed(3)} Ret=${g.metrics.totalReturn.toFixed(1)}%`);
    }
  }

  // 4. 计算回测指标（使用新增的 computeMetrics）
  const closedTrades = state.tradeLog;
  const metrics = computeMetrics(state, closedTrades, equityCurve, costModel);

  const avgHoldDays = closedTrades.length > 0
    ? closedTrades.reduce((s, t) => s + t.holdDays, 0) / closedTrades.length : 0;

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
  console.log(`  总盈亏:      $${state.totalPnl.toFixed(2)} (${metrics.totalReturn.toFixed(2)}%)`);
  console.log(`  年化收益:    ${metrics.cagr.toFixed(2)}%`);
  console.log(`  ──────────────────────────────────`);
  console.log(`  交易次数:    ${closedTrades.length}`);
  console.log(`  胜率:        ${metrics.winRate.toFixed(1)}%`);
  console.log(`  Profit Factor: ${metrics.profitFactor.toFixed(2)}`);
  console.log(`  最大回撤:    ${metrics.maxDrawdown.toFixed(2)}%`);
  console.log(`  Sharpe Ratio: ${metrics.sharpe.toFixed(3)}`);
  console.log(`  Sortino Ratio: ${metrics.sortino.toFixed(3)}`);
  console.log(`  Calmar Ratio: ${metrics.calmar.toFixed(3)}`);
  console.log(`  平均持有:    ${avgHoldDays.toFixed(1)}天`);
  console.log(`  成本模型:    slip=${(costModel.slippagePct * 100).toFixed(2)}% | comm=$${costModel.commissionPerTrade.toFixed(1)}/trade`);
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
    // 扩展 schema 以包含新字段，通过 ALTER TABLE 确保向后兼容
    try { execSql(`ALTER TABLE backtest_results ADD COLUMN sortino_ratio REAL NOT NULL DEFAULT 0.0`); } catch {}
    try { execSql(`ALTER TABLE backtest_results ADD COLUMN calmar_ratio REAL NOT NULL DEFAULT 0.0`); } catch {}
    try { execSql(`ALTER TABLE backtest_results ADD COLUMN profit_factor REAL NOT NULL DEFAULT 0.0`); } catch {}
    try { execSql(`ALTER TABLE backtest_results ADD COLUMN cagr REAL NOT NULL DEFAULT 0.0`); } catch {}
    try { execSql(`ALTER TABLE backtest_results ADD COLUMN slippage_pct REAL NOT NULL DEFAULT 0.0`); } catch {}
    prepare(`
      INSERT INTO backtest_results
        (run_id, symbol, start_date, end_date, days, total_trades, win_count,
         win_rate, total_pnl, total_pnl_pct, max_drawdown, sharpe_ratio,
         sortino_ratio, calmar_ratio, profit_factor, cagr, slippage_pct,
         avg_hold_days, review_pass_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      runId, SYMBOL, startDateStr, endDateStr, DAYS,
      closedTrades.length, closedTrades.filter(t => t.pnl > 0).length, metrics.winRate / 100,
      state.totalPnl, metrics.totalReturn, metrics.maxDrawdown / 100, metrics.sharpe,
      metrics.sortino, metrics.calmar, metrics.profitFactor, metrics.cagr / 100, costModel.slippagePct,
      avgHoldDays, reviewPassRate,
    );
    console.log(`\n[backtest] Saved to backtest_results (run_id: ${runId})`);
  }

  // 输出 JSON 供 Agent 使用
  const jsonSummary = {
    symbol: SYMBOL,
    days: DAYS,
    totalTrades: closedTrades.length,
    winRate: metrics.winRate,
    totalPnl: Math.round(state.totalPnl * 100) / 100,
    totalReturn: metrics.totalReturn,
    maxDrawdown: metrics.maxDrawdown,
    sharpe: metrics.sharpe,
    sortino: metrics.sortino,
    calmar: metrics.calmar,
    profitFactor: metrics.profitFactor,
    cagr: metrics.cagr,
    slippagePct: costModel.slippagePct,
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

