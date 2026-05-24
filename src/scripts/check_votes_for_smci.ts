import { getDb } from '../core/db.js';
const db = getDb();

const votes = db.prepare("SELECT * FROM agent_votes WHERE trade_id = 'ELEC-20260523-2103'").all();
console.log('=== Votes for ELEC-20260523-2103 ===');
for (const v of votes) console.log(JSON.stringify(v));

const votes2 = db.prepare("SELECT * FROM agent_votes WHERE trade_id = 'ELEC-20260524-0129'").all();
console.log('\n=== Votes for ELEC-20260524-0129 ===');
for (const v of votes2) console.log(JSON.stringify(v));

// Show all active agents
const agents = db.prepare("SELECT * FROM agents WHERE status = 'ACTIVE'").all();
console.log('\n=== Active agents ===');
for (const a of agents) console.log(JSON.stringify(a));
