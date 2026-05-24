import { getDb } from './src/core/db.js';
const db = getDb();
const deadRounds = db.prepare("SELECT round_id, symbol, action, status FROM election_rounds WHERE status='PASSED' AND resulted_trade_id IS NULL").all();
console.log('=== 死单检查 ===');
console.log(JSON.stringify(deadRounds, null, 2));

const openTrades = db.prepare("SELECT * FROM trades WHERE status='OPEN'").all();
console.log('\n=== 当前持仓 ===');
console.log(JSON.stringify(openTrades, null, 2));

const today = new Date().toISOString().slice(0,10);
const todayTrades = db.prepare("SELECT COUNT(*) as cnt FROM trades WHERE date(executed_at) = ? AND status != 'CANCELLED'").get(today);
console.log('\n=== 今日交易次数 ===');
console.log(JSON.stringify(todayTrades));
