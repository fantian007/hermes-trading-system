import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('./data/trading.db');

const trades = [
  { trade_id: 'TRD-20260523-001', symbol: 'AMD.US', order_id: '1242822600539770880', round_id: 'ELEC-20260523-1249' },
  { trade_id: 'TRD-20260523-002', symbol: 'TSM.US', order_id: '1242822624065622016', round_id: 'ELEC-20260523-2048' },
];

for (const t of trades) {
  // Insert trade record
  db.prepare('INSERT INTO trades (trade_id, symbol, direction, buy_price, quantity, approved_by, status) VALUES (?, ?, ?, 0, 10, ?, ?)').run(t.trade_id, t.symbol, 'LONG', t.round_id, 'OPEN');
  
  // Update election round
  db.prepare("UPDATE election_rounds SET resulted_trade_id = ?, executed_at = datetime('now') WHERE round_id = ?").run(t.trade_id, t.round_id);
  
  console.log(`${t.round_id} → trade ${t.trade_id} (order ${t.order_id}) finalized`);
}

db.close();
console.log('\nDone');
