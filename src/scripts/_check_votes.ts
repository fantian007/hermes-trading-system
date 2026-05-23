/**
 * 检查选举轮次和DB schema — temp script
 */
import { getDb } from '../core/db.js';

const db = getDb();

// DB schema
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('=== Tables ===');
console.log(JSON.stringify(tables, null, 2));

// Check the round we just created
const rounds = db.prepare(`
  SELECT * FROM election_rounds ORDER BY created_at DESC LIMIT 5
`).all();
console.log('\n=== Recent Election Rounds ===');
console.log(JSON.stringify(rounds, null, 2));

// Check active agents
const agents = db.prepare(`SELECT * FROM agents WHERE status = 'ACTIVE'`).all();
console.log('\n=== Active Agents ===');
console.log(JSON.stringify(agents, null, 2));
