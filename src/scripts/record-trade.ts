/**
 * 记录交易到DB — 供 data-agent 在长桥CLI提交成功后调用
 *
 * 用法:
 *   npx tsx src/scripts/record-trade.ts \
 *     --round-id ELEC-20260523-2103 \
 *     --symbol SMCI.US \
 *     --action BUY \
 *     --quantity 20 \
 *     --order-id 1243015765259476992
 */

import { getDb } from '../core/db.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (key: string) => {
    const idx = args.indexOf(`--${key}`);
    return idx >= 0 ? args[idx + 1] : '';
  };
  return {
    roundId: get('round-id'),
    symbol: get('symbol'),
    action: get('action'),
    quantity: parseInt(get('quantity'), 10),
    orderId: get('order-id'),
  };
}

function pad(n: number): string {
  return String(n).padStart(3, '0');
}

function main() {
  const { roundId, symbol, action, quantity, orderId } = parseArgs();
  if (!roundId || !symbol || !action || !quantity || !orderId) {
    console.error('Missing required args: --round-id --symbol --action --quantity --order-id');
    process.exit(1);
  }

  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const seq = pad(Math.floor(Math.random() * 999));
  const tradeId = `TRD-${datePart}-${seq}`;

  const db = getDb();

  // Insert trade
  db.prepare(
    `INSERT INTO trades (trade_id, symbol, direction, buy_price, quantity, approved_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(tradeId, symbol, 'LONG', 0, quantity, roundId);

  // Update election round
  const updateResult = db.prepare(
    `UPDATE election_rounds SET resulted_trade_id = ?, executed_at = datetime('now') WHERE round_id = ?`
  ).run(tradeId, roundId);

  // Check if there's an agent_orders table
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
  const hasOrdersTable = tables.some((t: any) => t.name === 'agent_orders');
  if (hasOrdersTable) {
    db.prepare(
      `INSERT INTO agent_orders (trade_id, order_id, status, submitted_at) VALUES (?, ?, 'submitted', datetime('now'))`
    ).run(tradeId, orderId);
  }

  const hasTradeOrders = tables.some((t: any) => t.name === 'trade_orders');
  if (hasTradeOrders) {
    db.prepare(
      `INSERT INTO trade_orders (trade_id, order_id, status) VALUES (?, ?, 'submitted')`
    ).run(tradeId, orderId);
  }

  console.log(JSON.stringify({
    status: 'recorded',
    trade_id: tradeId,
    order_id: orderId,
    symbol,
    action,
    quantity,
    round_id: roundId,
    updates: updateResult.changes > 0 ? 'election_round updated' : 'election_round not found',
  }));
}

main();
