import Database from 'better-sqlite3';
const db = new Database('./trading.db');
const dead1 = db.prepare("SELECT round_id, symbol, action, quantity, created_at FROM election_rounds WHERE status='PASSED' AND resulted_trade_id IS NULL").all();
console.log('DEAD:', JSON.stringify(dead1));
const open = db.prepare("SELECT trade_id, symbol, action, quantity, price, status, order_id FROM trades WHERE status='OPEN'").all();
console.log('OPEN:', JSON.stringify(open));
const recent = db.prepare("SELECT round_id, symbol, action, status, resulted_trade_id FROM election_rounds ORDER BY rowid DESC LIMIT 8").all();
console.log('RECENT:', JSON.stringify(recent));
db.close();
