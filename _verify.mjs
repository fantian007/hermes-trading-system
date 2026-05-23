import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('./data/trading.db');

// Check election rounds status
const rounds = db.prepare("SELECT round_id, symbol, final_decision, decision_confidence, resulted_trade_id, executed_at FROM election_rounds WHERE round_id IN ('ELEC-20260523-1249', 'ELEC-20260523-2048')").all();
console.log("Election rounds:", JSON.stringify(rounds, null, 2));

// Check trades
const trades = db.prepare("SELECT trade_id, symbol, direction, quantity, status, approved_by FROM trades WHERE trade_id IN ('ELEC-20260523-1249', 'ELEC-20260523-2048') OR approved_by IN ('ELEC-20260523-1249', 'ELEC-20260523-2048')").all();
console.log("\nTrades:", JSON.stringify(trades, null, 2));

// Check votes
const votes = db.prepare("SELECT vote_id, agent_id, vote_direction, confidence FROM agent_votes WHERE trade_id IN ('ELEC-20260523-1249', 'ELEC-20260523-2048')").all();
console.log("\nVotes:", JSON.stringify(votes, null, 2));

db.close();
