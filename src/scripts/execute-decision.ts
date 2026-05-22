/**
 * 执行决策 — PURE ORDER TOOL
 *
 * 职责（仅此一项）：
 *   给定 --round-id --symbol --action --quantity，提交订单并记录到 trades 表
 *
 * 所有业务决策交给 Agent 自然语言：
 *   - Agent（执行）向 data-agent 问价格，向 auditor 确认风险，
 *     然后决定“我认为买 50 股合适”
 *   - 再以 --round-id X --symbol Y --action BUY --quantity 50 运行此脚本
 *
 * 用法：
 *   npx tsx src/scripts/execute-decision.ts \
 *     --round-id ELEC-20260521-1430 \
 *     --symbol NVDA.US \
 *     --action BUY \
 *     --quantity 50
 */

import { submitBuyOrder, submitSellOrder } from '../trading/order.js';
import { getDb } from '../core/db.js';

interface Args {
  roundId: string;
  symbol: string;
  action: string;
  quantity: number;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const get = (key: string) => {
    const idx = args.indexOf(`--${key}`);
    return idx >= 0 ? args[idx + 1] : '';
  };
  return {
    roundId:  get('round-id'),
    symbol:   get('symbol'),
    action:   (get('action') || 'HOLD').toUpperCase(),
    quantity: parseInt(get('quantity') || '0', 10),
  };
}

async function main() {
  const { roundId, symbol, action, quantity } = parseArgs();

  if (!roundId || !symbol) {
    console.error('Usage: execute-decision.ts --round-id <ID> --symbol <SYM> --action BUY|SELL --quantity <N>');
    process.exit(1);
  }

  if (!['BUY', 'SELL'].includes(action)) {
    console.log(JSON.stringify({ status: 'skipped', reason: `Action ${action} — no order submitted` }));
    process.exit(0);
  }

  if (quantity <= 0) {
    console.log(JSON.stringify({ status: 'skipped', reason: 'Quantity <= 0 — no order submitted' }));
    process.exit(0);
  }

  // Submit the order
  let orderResult: any;
  if (action === 'BUY') {
    orderResult = await submitBuyOrder(symbol, quantity);
  } else {
    orderResult = await submitSellOrder(symbol, quantity);
  }

  if ('error' in orderResult) {
    console.log(JSON.stringify({ error: `Order failed: ${orderResult.error}` }));
    process.exit(1);
  }

  const orderId = orderResult.order_id;
  const tradeId = `TRD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`;

  // Record the trade in DB (price is unknown at submission time — set to 0)
  getDb().prepare(`
    INSERT INTO trades (trade_id, symbol, direction, buy_price, quantity, approved_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(tradeId, symbol, 'LONG', 0, quantity, roundId);

  // Update election round
  getDb().prepare(`
    UPDATE election_rounds SET resulted_trade_id = ?, executed_at = datetime('now') WHERE round_id = ?
  `).run(tradeId, roundId);

  console.log(JSON.stringify({
    status: 'executed',
    trade_id: tradeId,
    order_id: orderId,
    symbol,
    action,
    quantity,
  }));
}

main().catch(console.error);
