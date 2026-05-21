/**
 * 风控检查模块
 *
 * 纯函数集合，无 SDK 调用。通过查询 SQLite 数据库的 daily_ledger
 * 和 trades 表获取日内状态，结合 config 中的阈值参数完成合规校验。
 *
 * 所有检查函数均返回统一结构：{ passed: boolean, ...附加字段 }，
 * 由 runAllChecks() 汇总所有不通过的检查项。
 */

import { config } from '../core/config.js';
import { prepare } from '../core/db.js';

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

/** 获取今日日期字符串，格式 "YYYY-MM-DD" */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 读取今日的 daily_ledger 记录
 *
 * 若当日尚无记录，返回 undefined（表示交易尚未开始）。
 */
function getTodayLedger(): { date: string; trade_count: number; total_pnl: number; peak_equity: number; trough_equity: number; max_drawdown: number; melted: number } | undefined {
  try {
    const stmt = prepare('SELECT * FROM daily_ledger WHERE date = ?');
    return stmt.get(todayStr()) as any;
  } catch {
    return undefined;
  }
}

/**
 * 计算所有未平仓持仓的总市值
 *
 * 从 trades 表读取所有 status='OPEN' 的记录，
 * 累加 (quantity * buy_price)。
 */
function getOpenPositionValue(): number {
  try {
    const stmt = prepare(
      "SELECT COALESCE(SUM(quantity * buy_price), 0) AS total FROM trades WHERE status = 'OPEN'",
    );
    const row = stmt.get() as any;
    return row?.total ?? 0;
  } catch {
    return 0;
  }
}

/**
 * 累加当日已平仓亏损的交易数量（用于止损监控）
 */
function getTodayClosedLossCount(): number {
  try {
    const stmt = prepare(
      "SELECT COUNT(*) AS cnt FROM trades WHERE status = 'CLOSED' AND date(closed_at) = ? AND pnl < 0",
    );
    const row = stmt.get(todayStr()) as any;
    return row?.cnt ?? 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// 公共 API
// ---------------------------------------------------------------------------

/**
 * 仓位上限检查
 *
 * 验证指定标的的持仓数量是否超过系统允许的最大仓位。
 * 最大仓位 = (总资产 × maxPositionPct) / 当前价格。
 *
 * @param symbol       - 标的代码（保留供将来同标的汇总）
 * @param currentPrice - 当前市价
 * @param existingQty  - 当前已持有数量
 * @returns passed — 是否通过；maxQty — 该标的最大允许持仓数量
 *
 * @example
 *   const result = checkPositionLimit("NVDA.US", 150, 50);
 *   // => { passed: true, maxQty: 117 }
 */
export function checkPositionLimit(
  symbol: string,
  currentPrice: number,
  existingQty: number,
): { passed: boolean; maxQty: number } {
  const maxPositionValue = config.totalAsset * config.maxPositionPct;
  const maxQty = Math.floor(maxPositionValue / currentPrice);
  const passed = existingQty <= maxQty;
  return { passed, maxQty };
}

/**
 * 日内交易次数检查
 *
 * 从 daily_ledger 读取今日已成交笔数，确保不超过单日限值。
 *
 * @returns passed — 是否还能继续交易；todayCount — 今日已成交笔数
 *
 * @example
 *   const limit = checkDailyTradeLimit();
 *   // => { passed: true, todayCount: 7 }
 */
export function checkDailyTradeLimit(): { passed: boolean; todayCount: number } {
  const ledger = getTodayLedger();
  const todayCount = ledger?.trade_count ?? 0;
  const passed = todayCount < config.maxDailyTrades;
  return { passed, todayCount };
}

/**
 * 现金储备检查
 *
 * 确保账户保留最低比例的现金，防止满仓运行。
 * 可用现金 = 总资产 - 已占用持仓市值（从 trades 表 OPEN 记录推算）。
 * 最低现金 = 总资产 × minCashReserve。
 *
 * @returns passed — 现金是否充足；availableCash — 当前估算可用现金
 *
 * @example
 *   const cash = checkCashReserve();
 *   // => { passed: true, availableCash: 52000 }
 */
export function checkCashReserve(): { passed: boolean; availableCash: number } {
  const openValue = getOpenPositionValue();
  const availableCash = config.totalAsset - openValue;
  const minCash = config.totalAsset * config.minCashReserve;
  const passed = availableCash >= minCash;
  return { passed, availableCash };
}

/**
 * 单笔最大亏损检查
 *
 * 计算当前持仓的浮动亏损比例，判断是否触发止损线。
 * 亏损比例 = (入场价 - 当前价) / 入场价。
 *
 * @param currentPrice - 当前市价
 * @param entryPrice   - 入场均价
 * @returns boolean — 亏损是否在可接受范围内
 *
 * @example
 *   const ok = checkMaxLoss(95, 100);
 *   // => true  (5% 亏损 < 5% 阈值)
 *
 *   const exceeded = checkMaxLoss(90, 100);
 *   // => false (10% 亏损 > 5% 阈值)
 */
export function checkMaxLoss(currentPrice: number, entryPrice: number): boolean {
  if (entryPrice <= 0 || currentPrice <= 0) return false;
  // 仅在浮亏时计算（当前价 < 入场价）
  if (currentPrice >= entryPrice) return true;
  const lossPct = (entryPrice - currentPrice) / entryPrice;
  return lossPct <= config.maxLossPerTrade;
}

/**
 * 日内回撤检查
 *
 * 从 daily_ledger 读取今日最大回撤 (max_drawdown)，
 * 与配置的 maxDrawdownDaily 阈值比较。
 *
 * @returns passed — 是否未触发熔断；currentDrawdown — 当前日内最大回撤比例
 *
 * @example
 *   const dd = checkDailyDrawdown();
 *   // => { passed: true, currentDrawdown: 0.034 }
 */
export function checkDailyDrawdown(): { passed: boolean; currentDrawdown: number } {
  const ledger = getTodayLedger();
  const currentDrawdown = ledger?.max_drawdown ?? 0;
  const passed = currentDrawdown <= config.maxDrawdownDaily;
  return { passed, currentDrawdown };
}

/**
 * 综合风控检查（一键执行全部检查）
 *
 * 依次执行所有风控检查项，汇总不通过的项名称。
 * 任意一项未通过则整体视为不通过。
 *
 * @param symbol       - 标的代码
 * @param currentPrice - 当前市价
 * @param existingQty  - 当前已持有数量（0 表示尚未建仓）
 * @param entryPrice   - 入场均价（0 表示无持仓）
 * @returns passed   — 全部检查是否通过
 *          failures — 不通过的检查项名称列表，如 ["positionLimit", "maxLoss"]
 *
 * @example
 *   const checks = runAllChecks("NVDA.US", 150, 50, 145);
 *   if (!checks.passed) {
 *     console.log("风控拦截:", checks.failures.join(", "));
 *   }
 */
export function runAllChecks(
  symbol: string,
  currentPrice: number,
  existingQty: number,
  entryPrice: number,
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];

  // 1. 仓位上限
  const posCheck = checkPositionLimit(symbol, currentPrice, existingQty);
  if (!posCheck.passed) {
    failures.push('positionLimit');
  }

  // 2. 日内交易次数
  const dailyCheck = checkDailyTradeLimit();
  if (!dailyCheck.passed) {
    failures.push('dailyTradeLimit');
  }

  // 3. 现金储备
  const cashCheck = checkCashReserve();
  if (!cashCheck.passed) {
    failures.push('cashReserve');
  }

  // 4. 单笔最大亏损（仅当已有持仓且入场价 > 0 时检查）
  if (existingQty > 0 && entryPrice > 0) {
    if (!checkMaxLoss(currentPrice, entryPrice)) {
      failures.push('maxLoss');
    }
  }

  // 5. 日内回撤
  const drawdownCheck = checkDailyDrawdown();
  if (!drawdownCheck.passed) {
    failures.push('dailyDrawdown');
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}
