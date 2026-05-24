import { getDb } from '../core/db.js';
const db = getDb();
const rounds = db.prepare(`SELECT round_id, symbol, side, status, resulted_trade_id, created_at FROM election_rounds ORDER BY created_at DESC LIMIT 5`).all();
console.log('=== Recent election rounds ===');
for (const r of rounds) {
  console.log(JSON.stringify(r));
}
const dead = db.prepare(`SELECT round_id, symbol, side FROM election_rounds WHERE status='PASSED' AND resulted_trade_id IS NULL`).all();
console.log('=== Dead orders (PASSED, no trade) ===');
if (dead.length === 0) {
  console.log('(none)');
} else {
  for (const d of dead) {
    console.log(JSON.stringify(d));
  }
}
const trades = db.prepare(`SELECT trade_id, symbol, side, quantity, status, price, created_at FROM trades ORDER BY created_at DESC LIMIT 5`).all();
console.log('=== Recent trades ===');
for (const t of trades) {
  console.log(JSON.stringify(t));
}
