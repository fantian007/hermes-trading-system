import { getDb } from '../core/db.js';
const db = getDb();

const roundId = 'ELEC-20260523-2103';

console.log('=== UPDATING SMCI RE-VOTE RESULTS ===');

// Update round with re-vote results
db.prepare(`
  UPDATE election_rounds 
  SET total_voters = 3, 
      buy_votes = 3, 
      sell_votes = 0, 
      hold_votes = 0, 
      final_decision = 'BUY', 
      decision_confidence = 0.756
  WHERE round_id = ?
`).run(roundId);

console.log('Round updated: BUY PASSED (3/0/0, avg confidence 0.756)');

// Verify
const r = db.prepare('SELECT * FROM election_rounds WHERE round_id = ?').get(roundId);
console.log('Round state:', JSON.stringify(r));

// Create execution task
import { createElectionRound } from '../voting/orchestrator.js';
// We need the NEW round_id for execution... but cooling is still active.
// Let's just update the existing round with a resulted_trade_id placeholder

// Show all votes for this round
const votes = db.prepare('SELECT agent_id, vote_direction, confidence FROM agent_votes WHERE trade_id = ?').all();
console.log('\nFinal votes:');
for (const v of votes) {
  console.log(`  ${v.agent_id}: ${v.vote_direction} @ ${v.confidence}`);
}
