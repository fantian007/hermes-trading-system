/**
 * 订单提交模块
 *
 * 封装买入、卖出、撤单、状态查询等委托操作。
 * 基于 longbridge SDK 的 TradeContext，支持市价/限价单类型。
 */

import {
  Config,
  TradeContext,
  OrderSide,
  OrderType,
  TimeInForceType,
} from 'longbridge';

// ---------------------------------------------------------------------------
// 延迟初始化的 TradeContext 单例
// ---------------------------------------------------------------------------

let _tradeCtx: TradeContext | null = null;

/**
 * 获取或创建 TradeContext 实例
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
 * 提交买入订单
 *
 * 向长桥交易网关提交买入委托，默认使用市价单、当日有效。
 *
 * @param symbol    - 标的代码，如 "NVDA.US"
 * @param quantity  - 买入数量（股）
 * @param orderType - 订单类型，默认 OrderType.Market
 * @returns Promise — 正常时返回 { order_id: string }，
 *                    异常时返回 { error: string }
 *
 * @example
 *   const result = await submitBuyOrder("NVDA.US", 10);
 *   console.log(result.order_id);  // "ORD-20260522-001"
 */
export async function submitBuyOrder(
  symbol: string,
  quantity: number,
  orderType: OrderType = OrderType.Market,
): Promise<{ order_id: string }> {
  try {
    const ctx = await getTradeCtx();
    const resp = await ctx.submitOrder({
      symbol,
      side: OrderSide.Buy,
      orderType,
      submittedQuantity: quantity,
      timeInForce: TimeInForceType.Day,
    });
    return { order_id: resp.orderId ?? String(resp) };
  } catch (err: any) {
    return { order_id: '', ...{ error: `submitBuyOrder failed: ${err.message ?? String(err)}` } } as any;
  }
}

/**
 * 提交卖出订单
 *
 * 向长桥交易网关提交卖出委托，默认使用市价单、当日有效。
 *
 * @param symbol    - 标的代码，如 "NVDA.US"
 * @param quantity  - 卖出数量（股）
 * @param orderType - 订单类型，默认 OrderType.Market
 * @returns Promise — 正常时返回 { order_id: string }，
 *                    异常时返回 { error: string }
 *
 * @example
 *   const result = await submitSellOrder("NVDA.US", 5);
 *   console.log(result.order_id);  // "ORD-20260522-002"
 */
export async function submitSellOrder(
  symbol: string,
  quantity: number,
  orderType: OrderType = OrderType.Market,
): Promise<{ order_id: string }> {
  try {
    const ctx = await getTradeCtx();
    const resp = await ctx.submitOrder({
      symbol,
      side: OrderSide.Sell,
      orderType,
      submittedQuantity: quantity,
      timeInForce: TimeInForceType.Day,
    });
    return { order_id: resp.orderId ?? String(resp) };
  } catch (err: any) {
    return { order_id: '', ...{ error: `submitSellOrder failed: ${err.message ?? String(err)}` } } as any;
  }
}

/**
 * 撤销订单
 *
 * 根据订单 ID 撤销尚未成交的委托单。
 *
 * @param orderId - 待撤销的订单 ID
 * @returns Promise — 成功时 void，异常时返回 { error: string }
 *
 * @example
 *   await cancelOrder("ORD-20260522-001");
 */
export async function cancelOrder(orderId: string): Promise<void> {
  try {
    const ctx = await getTradeCtx();
    await ctx.cancelOrder(orderId);
  } catch (err: any) {
    throw new Error(`cancelOrder failed [${orderId}]: ${err.message ?? String(err)}`);
  }
}

/**
 * 查询订单状态
 *
 * 根据订单 ID 获取委托单的最新状态（是否成交、成交价格、成交量等）。
 *
 * @param orderId - 订单 ID
 * @returns Promise — 正常时返回订单详情对象，异常时返回 { error: string }
 *
 * @example
 *   const status = await getOrderStatus("ORD-20260522-001");
 *   if (status.status === 'FILLED') { ... }
 */
export async function getOrderStatus(orderId: string): Promise<any> {
  try {
    const ctx = await getTradeCtx();
    const resp = await ctx.orderDetail(orderId);
    return resp;
  } catch (err: any) {
    return { error: `getOrderStatus failed [${orderId}]: ${err.message ?? String(err)}` };
  }
}
