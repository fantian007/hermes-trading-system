import { DatabaseSync } from 'node:sqlite';
import { execSync } from 'node:child_process';

const db = new DatabaseSync('./data/trading.db');

// Update final_decision for both rounds
db.prepare("UPDATE election_rounds SET final_decision = 'BUY', decision_confidence = 0.81 WHERE round_id = 'ELEC-20260523-1249' AND resulted_trade_id IS NULL").run();
db.prepare("UPDATE election_rounds SET final_decision = 'BUY', decision_confidence = 0.81 WHERE round_id = 'ELEC-20260523-2048' AND resulted_trade_id IS NULL").run();
console.log('Decisions updated');

// Verify
const rows = db.prepare("SELECT round_id, symbol, final_decision, decision_confidence FROM election_rounds WHERE resulted_trade_id IS NULL AND created_at > datetime('now', '-30 minutes')").all();
console.log('Ready to execute:', JSON.stringify(rows));

db.close();

// Execute each
for (const r of rows) {
  if (r.final_decision === 'HOLD') {
    console.log(`\n${r.round_id} (${r.symbol}): HOLD — skipping execution`);
    continue;
  }
  console.log(`\nExecuting ${r.round_id} (${r.symbol}): ${r.final_decision}`);
  try {
    const result = execSync(`npx tsx src/scripts/execute-decision.ts --round-id ${r.round_id} --symbol ${r.symbol} --action ${r.final_decision} --quantity 10`, {
      cwd: '/Users/zys/workspace/hermes-trading-system',
      timeout: 45000,
      encoding: 'utf-8'
    });
    console.log(`  Result: ${result.trim()}`);
  } catch (e) {
    console.log(`  Error: ${e.stderr || e.message}`);
  }
}
console.log('\nAll done');
