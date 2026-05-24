import { getDb } from '../src/core/db.js';
const db = getDb();

// 1. 死单检查：BUY/SELL 决策但无 resulted_trade_id
const dead = db.prepare(
  "SELECT round_id, symbol, final_decision, decision_confidence, resulted_trade_id, created_at FROM election_rounds WHERE (final_decision='BUY' OR final_decision='SELL') AND resulted_trade_id IS NULL"
).all();
console.log('=== 死单检查 ===');
console.log(JSON.stringify(dead, null, 2));

// 2. 当前持仓
const open = db.prepare(
  "SELECT trade_id, symbol, quantity, buy_price, status, direction, sell_price FROM trades WHERE status='OPEN' OR status='PENDING' ORDER BY symbol, trade_id"
).all();
console.log('\n=== 当前持仓 ===');
console.log(JSON.stringify(open, null, 2));

// 3. 最近选举
const recent = db.prepare(
  "SELECT round_id, symbol, final_decision, resulted_trade_id, decision_confidence, buy_votes, sell_votes, hold_votes, created_at FROM election_rounds ORDER BY created_at DESC LIMIT 10"
).all();
console.log('\n=== 最近10轮选举 ===');
console.log(JSON.stringify(recent, null, 2));
