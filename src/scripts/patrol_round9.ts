import { getDb } from '../core/db.js';
const db = getDb();

// 1. PASSED 但无trade的投票
const dead = db.prepare("SELECT round_id, symbol, status, created_at FROM election_rounds WHERE status='PASSED' AND resulted_trade_id IS NULL ORDER BY created_at DESC").all();
console.log('=== 死单 (PASSED+无trade) ===');
console.log(JSON.stringify(dead, null, 2));

// 2. PENDING 订单
const pending = db.prepare("SELECT id, symbol, direction, quantity, price, status, created_at, external_id FROM trades WHERE status='PENDING' ORDER BY created_at DESC").all();
console.log('\n=== PENDING 订单 ===');
console.log(JSON.stringify(pending, null, 2));

// 3. 有效 OPEN 持仓
const openActive = db.prepare("SELECT id, symbol, direction, quantity, price, sell_price, status, created_at FROM trades WHERE status='OPEN' AND closed_at IS NULL ORDER BY created_at ASC").all();
console.log('\n=== 有效 OPEN 持仓 ===');
console.log(JSON.stringify(openActive, null, 2));

// 4. 今日交易次数
const today = new Date().toISOString().slice(0,10);
const cnt = db.prepare("SELECT COUNT(*) as cnt FROM trades WHERE date(created_at) = ? AND status IN ('OPEN','CLOSED','PENDING')").get(today);
console.log('\n=== 今日交易次数 ===');
console.log(JSON.stringify(cnt));

// 5. 最新的 election_rounds
const recent = db.prepare("SELECT round_id, symbol, status, final_decision, resulted_trade_id, created_at FROM election_rounds ORDER BY created_at DESC LIMIT 10").all();
console.log('\n=== 最近10轮选举 ===');
for (const r of recent) console.log(JSON.stringify(r));
