import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('/Users/zys/workspace/hermes-trading-system/data/trading.db');

// 死单: resulted_trade_id IS NULL 且 final_decision 不是 HOLD
const dead = db.prepare("SELECT round_id, symbol, final_decision, decision_confidence, buy_votes, sell_votes, created_at FROM election_rounds WHERE resulted_trade_id IS NULL AND final_decision != 'HOLD' ORDER BY created_at DESC").all();
console.log('=== 死单 (final_decision=BUY/SELL 但无 resulted_trade_id) ===');
console.log(JSON.stringify(dead, null, 2));

// OPEN 交易
const open = db.prepare("SELECT trade_id, symbol, direction, quantity, buy_price, sell_price, status, buy_time FROM trades WHERE status='OPEN' AND buy_price > 0 ORDER BY buy_time DESC").all();
console.log('\n=== 已成交持仓 (OPEN, buy_price>0) ===');
console.log(JSON.stringify(open, null, 2));

// PENDING 交易
const pending = db.prepare("SELECT trade_id, symbol, direction, quantity, buy_price, status, buy_time FROM trades WHERE status IN ('OPEN','PENDING') AND (buy_price IS NULL OR buy_price = 0) ORDER BY buy_time DESC").all();
console.log('\n=== 待成交 (buy_price=0/null) ===');
console.log(JSON.stringify(pending, null, 2));

// SMCI 相关轮次 + trade
const smciRounds = db.prepare("SELECT r.round_id, r.symbol, r.final_decision, r.decision_confidence, r.resulted_trade_id, r.created_at, t.status as trade_status, t.quantity, t.buy_price FROM election_rounds r LEFT JOIN trades t ON r.resulted_trade_id = t.trade_id WHERE r.symbol='SMCI.US' ORDER BY r.created_at DESC").all();
console.log('\n=== SMCI.US 完整信息 ===');
console.log(JSON.stringify(smciRounds, null, 2));

// 所有无 resulted_trade_id 的轮次（含 HOLD）
const allNoTrade = db.prepare("SELECT round_id, symbol, final_decision, decision_confidence, created_at FROM election_rounds WHERE resulted_trade_id IS NULL ORDER BY created_at DESC").all();
console.log('\n=== 所有无 resulted_trade_id 的轮次 ===');
console.log(JSON.stringify(allNoTrade, null, 2));

db.close();
