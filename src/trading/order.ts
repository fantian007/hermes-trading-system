/**
 * 订单提交 — 基于 longbridge CLI
 */

import { execSync } from 'node:child_process';

function lb(args: string): any {
  try {
    const out = execSync(`longbridge ${args} --format json`, {
      timeout: 15_000, maxBuffer: 1024 * 1024,
    }).toString().trim();
    if (!out) return {};
    return JSON.parse(out);
  } catch (e: any) {
    return { error: e.stderr?.toString()?.slice(0, 200) ?? e.message };
  }
}

/** 提交买单（市价 MO） */
export async function submitBuyOrder(symbol: string, quantity: number): Promise<{ order_id: string } | { error: string }> {
  const result = lb(`order buy ${symbol} ${quantity} --order-type MO -y`);
  if (result?.error) return result;
  return { order_id: result?.order_id ?? result?.orderId ?? String(Date.now()) };
}

/** 提交卖单（市价 MO） */
export async function submitSellOrder(symbol: string, quantity: number): Promise<{ order_id: string } | { error: string }> {
  const result = lb(`order sell ${symbol} ${quantity} --order-type MO -y`);
  if (result?.error) return result;
  return { order_id: result?.order_id ?? result?.orderId ?? String(Date.now()) };
}

/** 撤单 */
export async function cancelOrder(orderId: string): Promise<void> { lb(`order cancel ${orderId} -y`); }

/** 查询订单状态 */
export async function getOrderStatus(orderId: string): Promise<any> { return lb(`order detail ${orderId}`); }
