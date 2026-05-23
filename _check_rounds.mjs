import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('./data/trading.db');
const rows = db.prepare("SELECT round_id, symbol, final_decision, decision_confidence, resulted_trade_id FROM election_rounds WHERE resulted_trade_id IS NULL AND created_at > datetime('now', '-30 minutes')").all();
console.log("Pending rounds:", JSON.stringify(rows, null, 2));
db.close();
