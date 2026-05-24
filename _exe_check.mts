import { getDb } from './src/core/db.js';
const db = getDb();

console.log('=== 死单检查 (final_decision=BUY/SELL 且无 resulted_trade_id) ===');
const dead = db.prepare("SELECT round_id, symbol, final_decision, decision_confidence, resulted_trade_id, created_at FROM election_rounds WHERE final_decision IN ('BUY','SELL') AND resulted_trade_id IS NULL").all();
if (dead.length === 0) console.log('无死单 ✓');
else console.log(JSON.stringify(dead, null, 2));

console.log('\n=== OPEN trades ===');
const trades = db.prepare("SELECT * FROM trades WHERE status='OPEN'").all();
for (const t of trades) console.log(JSON.stringify(t));

console.log('\n=== 挂单 trades (PENDING) ===');
const pending = db.prepare("SELECT * FROM trades WHERE status='PENDING'").all();
for (const t of pending) console.log(JSON.stringify(t));
