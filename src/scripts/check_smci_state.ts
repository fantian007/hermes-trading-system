import { getDb } from '../core/db.js';
const db = getDb();

// Show the current state of SMCI round ELEC-20260523-2103
const r = db.prepare("SELECT * FROM election_rounds WHERE round_id = 'ELEC-20260523-2103'").get();
console.log('Round:', JSON.stringify(r));

// Check if data-service has recent SMCI price data
const prices = db.prepare("SELECT symbol, price, timestamp FROM price_cache WHERE symbol = 'SMCI.US' ORDER BY timestamp DESC LIMIT 3").all();
console.log('\nPrice cache:', JSON.stringify(prices));

// Show all existing agent_votes for SMCI round
const votes = db.prepare("SELECT * FROM agent_votes WHERE trade_id = 'ELEC-20260523-2103' ORDER BY agent_id").all();
console.log('\nCurrent votes:', JSON.stringify(votes));
