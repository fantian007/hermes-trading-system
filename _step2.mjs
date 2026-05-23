import { DatabaseSync } from 'node:sqlite';
import { execSync } from 'node:child_process';

const db = new DatabaseSync('./data/trading.db');
const rows = db.prepare(`SELECT round_id, symbol FROM election_rounds WHERE resulted_trade_id IS NULL AND created_at > datetime('now', '-30 minutes') ORDER BY created_at`).all();
db.close();

for (const { round_id, symbol } of rows) {
  console.log(`\n=== Processing ${round_id} (${symbol}) ===`);
  
  // Insert placeholder trade
  const db2 = new DatabaseSync('./data/trading.db');
  try {
    db2.prepare('INSERT OR IGNORE INTO trades (trade_id, symbol, direction, buy_price, quantity, approved_by, status) VALUES (?, ?, ?, 0, 1, ?, ?)').run(round_id, symbol, 'LONG', round_id, 'OPEN');
    console.log('Placeholder trade inserted');
  } catch (e) {
    console.log('Placeholder trade insert (may already exist):', e.message);
  }
  db2.close();
}
console.log('\nDone inserting placeholders');
