import { getDb } from './src/core/db.js';

const db = getDb();

// Dead orders: rounds where final_decision != 'HOLD' but no trade was recorded
console.log("=== DEAD/BUY or SELL with no resulted_trade_id ===");
const dead = db.prepare("SELECT round_id, symbol, final_decision, buy_votes, sell_votes, hold_votes, decision_confidence, created_at FROM election_rounds WHERE final_decision IN ('BUY','SELL') AND resulted_trade_id IS NULL").all();
console.log(JSON.stringify(dead, null, 2));

console.log("\n=== ALL election_rounds (last 20) ===");
const allRounds = db.prepare("SELECT round_id, symbol, final_decision, buy_votes, sell_votes, hold_votes, resulted_trade_id, created_at FROM election_rounds ORDER BY created_at DESC LIMIT 20").all();
console.log(JSON.stringify(allRounds, null, 2));

console.log("\n=== OPEN TRADES ===");
const trades = db.prepare("SELECT trade_id, symbol, direction, quantity, price, status, created_at, round_id FROM trades WHERE status='OPEN' ORDER BY created_at DESC").all();
console.log(JSON.stringify(trades, null, 2));

console.log("\n=== PENDING TRADES ===");
const pending = db.prepare("SELECT * FROM trades WHERE status NOT IN ('OPEN','CLOSED','CANCELLED') ORDER BY created_at DESC").all();
console.log(JSON.stringify(pending, null, 2));
