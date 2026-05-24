import { getDb } from '../src/core/db.js';
const db = getDb();

const dead = db.prepare("SELECT round_id, symbol, decision, status, confidence, resulted_trade_id FROM election_rounds WHERE (decision='BUY' OR decision='SELL') AND resulted_trade_id IS NULL").all();
console.log('=== 死单检查 ===');
console.log(JSON.stringify(dead, null, 2));

const open = db.prepare("SELECT trade_id, symbol, quantity, buy_price, status, order_id, side FROM trades WHERE status='OPEN' OR status='PENDING'").all();
console.log('\n=== 当前持仓 ===');
console.log(JSON.stringify(open, null, 2));

const recent = db.prepare("SELECT round_id, symbol, decision, resulted_trade_id, confidence, created_at FROM election_rounds ORDER BY created_at DESC LIMIT 10").all();
console.log('\n=== 最近10轮选举 ===');
console.log(JSON.stringify(recent, null, 2));
