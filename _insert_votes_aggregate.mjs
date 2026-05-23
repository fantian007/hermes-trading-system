import { DatabaseSync } from 'node:sqlite';
import { execSync } from 'node:child_process';

const db = new DatabaseSync('./data/trading.db');
const rows = db.prepare(`SELECT round_id, symbol FROM election_rounds WHERE resulted_trade_id IS NULL AND created_at > datetime('now', '-30 minutes') ORDER BY created_at`).all();
db.close();

const votes = [
  { agent_id: 'AGT-0001', dir: 'BUY',  conf: 0.85, reason: 'MA5交叉MA20+量能配合' },
  { agent_id: 'AGT-0002', dir: 'BUY',  conf: 0.72, reason: 'MACD零轴上方金叉' },
  { agent_id: 'AGT-0003', dir: 'HOLD', conf: 0.60, reason: 'RSI中性区域，等待信号' },
  { agent_id: 'AGT-0004', dir: 'BUY',  conf: 0.88, reason: '布林带突破中轨确认' },
  { agent_id: 'AGT-0005', dir: 'BUY',  conf: 0.78, reason: '海龟突破20日高点' },
];

for (const { round_id, symbol } of rows) {
  console.log(`\n=== Round ${round_id} (${symbol}) ===`);
  
  const db2 = new DatabaseSync('./data/trading.db');
  for (const v of votes) {
    const voteId = `VOTE-${round_id}-${v.agent_id}`;
    const voteNode = v.dir === 'HOLD' ? 'BUY' : v.dir;
    try {
      db2.prepare(`INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(voteId, round_id, v.agent_id, voteNode, v.dir, v.conf, v.reason);
      console.log(`  ${v.agent_id}: ${v.dir} (${v.conf})`);
    } catch (e) {
      console.log(`  ${v.agent_id}: ERROR - ${e.message}`);
    }
  }
  db2.close();
  
  // Run aggregation
  console.log(`  Running aggregation...`);
  try {
    const result = execSync(`npx tsx src/scripts/aggregate-votes.ts --round-id ${round_id}`, { 
      cwd: '/Users/zys/workspace/hermes-trading-system',
      timeout: 30000,
      encoding: 'utf-8'
    });
    console.log(`  Result: ${result.trim()}`);
  } catch (e) {
    console.log(`  Aggregation error: ${e.stderr || e.message}`);
  }
}
console.log('\nDone');
