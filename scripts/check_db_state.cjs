import { getDb } from '../core/db.js';
const db = getDb();

// Check schema
const cols = db.prepare("PRAGMA table_info(election_rounds)").all();
console.log('=== election_rounds columns ===');
for (const c of cols) console.log(JSON.stringify(c));

const cols2 = db.prepare("PRAGMA table_info(agent_votes)").all();
console.log('=== agent_votes columns ===');
for (const c of cols2) console.log(JSON.stringify(c));

// Check rounds
const rounds = db.prepare('SELECT * FROM election_rounds ORDER BY created_at DESC LIMIT 10').all();
console.log('\n=== Recent rounds ===');
for (const r of rounds) console.log(JSON.stringify(r));

// Check SMCI rounds specifically
const smci = db.prepare("SELECT * FROM election_rounds WHERE symbol LIKE '%SMCI%' ORDER BY created_at DESC LIMIT 5").all();
console.log('\n=== SMCI rounds ===');
for (const r of smci) console.log(JSON.stringify(r));
