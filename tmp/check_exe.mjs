import { getDb } from './src/core/db.js';
const db = getDb();

const dead = db.prepare("SELECT round_id, symbol, decision, status FROM election_rounds WHERE status='PASSED' AND resulted_trade_id IS NULL").all();
console.log('=== 死单检查 ===');
console.log(JSON.stringify(dead, null, 2));

const open = db.prepare("SELECT trade_id, symbol, quantity, buy_price, status, order_id FROM trades WHERE status='OPEN' OR status='PENDING'").all();
console.log('\n=== 当前持仓 ===');
console.log(JSON.stringify(open, null, 2));

const smci = db.prepare("SELECT round_id, symbol, decision, status, resulted_trade_id FROM election_rounds WHERE symbol='SMCI.US'").all();
console.log('\n=== SMCI.US 选举轮次 ===');
console.log(JSON.stringify(smci, null, 2));
