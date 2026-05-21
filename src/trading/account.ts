/**
 * 账户查询模块
 *
 * 通过 longbridge SDK 的 TradeContext 查询账户余额、持仓和当日订单。
 * 所有函数均包含错误处理，内部共享 TradeContext 单例。
 */

import { Config, TradeContext } from 'longbridge';

// ---------------------------------------------------------------------------
// 延迟初始化的 TradeContext 单例
// ---------------------------------------------------------------------------

/** TradeContext 缓存，避免重复创建连接 */
let _tradeCtx: TradeContext | null = null;

/**
 * 获取或创建 TradeContext 实例
 *
 * 使用 Config.fromApikeyEnv() 从环境变量读取长桥 API 密钥，
 * 与 QuoteContext 共享同一套凭证。
 *
 * @returns TradeContext 实例
 */
async function getTradeCtx(): Promise<TradeContext> {
  if (!_tradeCtx) {
    const cfg = Config.fromApikeyEnv();
    _tradeCtx = await TradeContext.new(cfg);
  }
  return _tradeCtx;
}

// ---------------------------------------------------------------------------
// 公共 API
// ---------------------------------------------------------------------------

/**
 * 查询账户余额
 *
 * 获取当前账户的现金余额、购买力、总资产等资金信息。
 *
 * @returns Promise — 正常时返回账户余额对象，异常时返回 { error: string }
 *
 * @example
 *   const balance = await getAccountBalance();
 *   console.log(balance.cash, balance.totalAssets);
 */
export async function getAccountBalance(): Promise<any> {
  try {
    const ctx = await getTradeCtx();
    const resp = await ctx.accountBalance();
    return resp;
  } catch (err: any) {
    return { error: `getAccountBalance failed: ${err.message ?? String(err)}` };
  }
}

/**
 * 查询当前持仓列表
 *
 * 获取账户中所有未平仓的股票持仓，包含标的代码、数量、成本价、
 * 当前市值、浮动盈亏等信息。
 *
 * @returns Promise — 正常时返回持仓列表，异常时返回 { error: string }
 *
 * @example
 *   const positions = await getPositions();
 *   for (const pos of positions) {
 *     console.log(pos.symbol, pos.quantity, pos.marketValue);
 *   }
 */
export async function getPositions(): Promise<any> {
  try {
    const ctx = await getTradeCtx();
    const resp = await ctx.stockPositions();
    return resp;
  } catch (err: any) {
    return { error: `getPositions failed: ${err.message ?? String(err)}` };
  }
}

/**
 * 查询今日所有订单
 *
 * 获取当前交易日已提交的所有订单（含已成交、部分成交、已撤销等），
 * 用于日内交易监控和防重复提交。
 *
 * @returns Promise — 正常时返回订单列表，异常时返回 { error: string }
 *
 * @example
 *   const orders = await getTodayOrders();
 *   for (const o of orders) {
 *     console.log(o.orderId, o.status, o.symbol);
 *   }
 */
export async function getTodayOrders(): Promise<any> {
  try {
    const ctx = await getTradeCtx();
    const resp = await ctx.todayOrders();
    return resp;
  } catch (err: any) {
    return { error: `getTodayOrders failed: ${err.message ?? String(err)}` };
  }
}
