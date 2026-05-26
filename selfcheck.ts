import { getDb } from './src/core/db.js';
const db = getDb();
console.log('=== ELC 记录 (最近10条) ===');
const rounds = db.prepare("SELECT round_id, symbol, action, status, resulted_trade_id, votes_for, votes_against, quantity, price FROM election_rounds ORDER BY created_at DESC LIMIT 10").all();
console.log(JSON.stringify(rounds, null, 2));
console.log('=== 持仓 ===');
const pos = db.prepare("SELECT * FROM positions").all();
console.log(JSON.stringify(pos, null, 2));
console.log('=== 挂单 ===');
try {
  const orders = db.prepare("SELECT * FROM open_orders").all();
  console.log(JSON.stringify(orders, null, 2));
} catch(e) {
  console.log("open_orders table not found:", e.message);
}
console.log('=== PASSED但未执行 ===');
const dead = db.prepare("SELECT round_id, symbol, action, status, resulted_trade_id FROM election_rounds WHERE status='PASSED' AND (resulted_trade_id IS NULL OR resulted_trade_id = '')").all();
console.log(JSON.stringify(dead, null, 2));
