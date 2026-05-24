import { getDb } from '../core/db.js';
const db = getDb();

const cols = db.prepare("PRAGMA table_info(election_rounds)").all();
console.log('=== election_rounds cols ===');
for (const c of cols) console.log(JSON.stringify(c));

const rds = db.prepare('SELECT * FROM election_rounds ORDER BY created_at DESC LIMIT 15').all();
console.log('\n=== All rounds ===');
for (const r of rds) console.log(JSON.stringify(r));

const smci = db.prepare("SELECT * FROM election_rounds WHERE symbol LIKE '%SMCI%' ORDER BY created_at DESC LIMIT 5").all();
console.log('\n=== SMCI rounds ===');
for (const r of smci) console.log(JSON.stringify(r));

// Check deadline rounds
const deadRounds = db.prepare("SELECT round_id, symbol, status, resulted_trade_id, buy_votes, sell_votes, hold_votes FROM election_rounds WHERE status='PASSED' AND resulted_trade_id IS NULL").all();
console.log('\n=== Dead orders ===');
for (const r of deadRounds) console.log(JSON.stringify(r));

// Check existing votes for ELEC-20260523-2103
const votes = db.prepare("SELECT * FROM agent_votes WHERE trade_id = 'ELEC-20260523-2103'").all();
console.log('\n=== ELEC-20260523-2103 votes ===');
for (const v of votes) console.log(JSON.stringify(v));
