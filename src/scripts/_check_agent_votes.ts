/**
 * 查看 agent_votes 表结构 — temp script
 */
import { getDb } from '../core/db.js';

const db = getDb();

// agent_votes schema
const cols = db.prepare("PRAGMA table_info(agent_votes)").all();
console.log('=== agent_votes schema ===');
console.log(JSON.stringify(cols, null, 2));

// Recent votes
const votes = db.prepare("SELECT * FROM agent_votes ORDER BY id DESC LIMIT 5").all();
console.log('\n=== Recent votes ===');
console.log(JSON.stringify(votes, null, 2));
