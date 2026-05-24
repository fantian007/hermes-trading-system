import { getDb } from '../core/db.js';
const votes = getDb().prepare('SELECT agent_id, vote_direction, confidence, reasoning FROM agent_votes WHERE trade_id = ?').all('ELEC-20260524-0451');
console.log(JSON.stringify(votes, null, 2));
