/**
 * Manually record a trade that was already submitted via longbridge CLI.
 * Usage: node src/scripts/record-trade.mjs --round-id ELEC-... --order-id 123 --symbol ORCL.US --action BUY --quantity 1
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const args = {};
process.argv.slice(2).forEach((a, i, arr) => {
  if (a.startsWith('--')) args[a.slice(2)] = arr[i + 1];
});

const { 'round-id': roundId, 'order-id': orderId, symbol, action, quantity } = args;
if (!roundId || !orderId || !symbol || !action || !quantity) {
  console.error('Usage: node record-trade.mjs --round-id <ID> --order-id <OID> --symbol <SYM> --action BUY --quantity <N>');
  process.exit(1);
}

const dbPath = require('path').join(import.meta.dirname, '..', '..', 'data', 'trading.db');
const db = new Database(dbPath);

const tradeId = `TRD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`;

// Insert trade
db.prepare(`INSERT INTO trades (trade_id, symbol, direction, buy_price, quantity, approved_by)
  VALUES (?, ?, ?, ?, ?, ?)`)
  .run(tradeId, symbol, action === 'BUY' ? 'LONG' : 'SHORT', 0, parseInt(quantity), roundId);

// Update election round
db.prepare(`UPDATE election_rounds SET resulted_trade_id = ?, executed_at = datetime('now') WHERE round_id = ?`)
  .run(tradeId, roundId);

// Insert order record
const stmt = db.prepare(`INSERT INTO orders (order_id, symbol, side, quantity, price, status, round_id, trade_id, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`);
stmt.run(orderId, symbol, action, parseInt(quantity), 0, 'SUBMITTED', roundId, tradeId);

console.log(JSON.stringify({ status: 'recorded', trade_id: tradeId, order_id: orderId, symbol, action, quantity }));
db.close();
