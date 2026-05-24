import { getDb } from '../core/db.js';
const db = getDb();

const roundId = 'ELEC-20260523-2103';

// Check schema
const schema = db.prepare("PRAGMA table_info(agent_votes)").all();
console.log('agent_votes schema:', JSON.stringify(schema));
const indexes = db.prepare("SELECT * FROM sqlite_master WHERE type='index' AND tbl_name='agent_votes'").all();
console.log('agent_votes indexes:', JSON.stringify(indexes));

// Check old votes
const oldVotes = db.prepare("SELECT * FROM agent_votes WHERE trade_id = ?").all();
console.log('Old votes:', JSON.stringify(oldVotes));
