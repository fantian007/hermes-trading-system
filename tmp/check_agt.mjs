import { getDb, closeDb } from './src/core/db.js';

const db = getDb();
const cur = db.prepare('SELECT * FROM agents WHERE agent_id = ?').get('AGT-005');
console.log('AGT-005 exists:', !!cur);

const cur8 = db.prepare('SELECT * FROM agents WHERE agent_id = ?').get('AGT-008');
console.log('AGT-008 exists:', !!cur8);

// Delete AGT-008 if it exists (wrong auto-assigned ID)
if (cur8) {
  db.prepare('DELETE FROM agents WHERE agent_id = ?').run('AGT-008');
  console.log('Deleted AGT-008');
}

// Check strategy-01 and strategy-05 profiles
const s01 = db.prepare('SELECT * FROM agents WHERE agent_id = ?').get('strategy-01');
console.log('strategy-01:', JSON.stringify(s01));

closeDb();
