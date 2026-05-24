import { getDb } from '../src/core/db.js';

const db = getDb();

// 1. 死单检查：PASSED 但没有对应成交
const deadRounds = db.prepare("SELECT round_id, symbol, final_decision, decision_confidence, created_at FROM election_rounds WHERE status='PASSED' AND resulted_trade_id IS NULL").all();
console.log('=== 死单检查（PASSED但未成交） ===');
if (deadRounds.length === 0) {
  console.log('✅ 无死单');
} else {
  console.log(JSON.stringify(deadRounds, null, 2));
}

// 2. 当前持仓
const openTrades = db.prepare("SELECT id, symbol, quantity, buy_price, side, status, created_at FROM trades WHERE status='OPEN'").all();
console.log('\n=== 当前持仓（OPEN） ===');
if (openTrades.length === 0) {
  console.log('📭 无持仓');
} else {
  console.log(JSON.stringify(openTrades, null, 2));
}

// 3. 今日交易次数
const today = new Date().toISOString().slice(0,10);
const todayTrades = db.prepare("SELECT COUNT(*) as cnt FROM trades WHERE date(executed_at) = ? AND status != 'CANCELLED'").get(today);
console.log('\n=== 今日交易次数 ===');
console.log(JSON.stringify(todayTrades));
