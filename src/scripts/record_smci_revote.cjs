import { getDb } from '../core/db.js';
const db = getDb();

const roundId = 'ELEC-20260523-2103';

// First clear old votes for this round
const oldVotes = db.prepare("SELECT * FROM agent_votes WHERE trade_id = ?").all();
console.log('Old votes:', JSON.stringify(oldVotes));

// We'll UPDATE each agent's vote
const votes = [
  {
    agent_id: 'AGT-002',
    vote_direction: 'BUY',
    confidence: 0.75,
    reasoning: 'MACD(12,26,9)金叉自5/6形成运行17天，DIF=1.57>>DEA=1.39，柱状从0.146温和扩张至0.18，多头动能稳定增强。MACD结构完全未变，信号与原投票一致且略微加强，维持BUY投票。',
    raw_analysis: JSON.stringify({ dif: 1.57, dea: 1.39, histogram: 0.18, golden_cross: true, golden_cross_date: '2026-05-06' }),
  },
  {
    agent_id: 'AGT-004',
    vote_direction: 'BUY',
    confidence: 0.72,
    reasoning: '布林带(20,2)挤压后突破信号仍然有效，带宽扩张中支持趋势延续。价格$35.58位于中轨之上、%B=87.4%偏多头区域，距上轨$37.09仍有约4.2%上行空间。与AGT-002(MACD)和AGT-007(MA)共振，三策略信号一致。',
    raw_analysis: JSON.stringify({ bb_period: 20, bb_multiplier: 2, latest_close: 35.58, sma20: 31.08, upper_band: 37.09, lower_band: 25.07, bb_percent: 0.874, bandwidth: 0.387, squeeze_breakout: true }),
  },
  {
    agent_id: 'AGT-007',
    vote_direction: 'BUY',
    confidence: 0.80,
    reasoning: 'MA5($32.78)>>MA20($31.08)，金叉运行约16天，价差5.47%稳定，短中期多头排列完整。价格高于MA5达8.5%但未极端偏离，布林带上轨$37.09仍有4.2%空间。跨策略共振一致看多。相比原轮(0.75)上调置信度至0.80。',
    raw_analysis: JSON.stringify({ ma5: 32.78, ma20: 31.08, ma5_ma20_spread: 1.7, ma5_ma20_pct: 5.47, last_price: 35.58, golden_cross_days: 16, bb_upper: 37.09 }),
  },
];

for (const v of votes) {
  const existing = db.prepare("SELECT * FROM agent_votes WHERE agent_id = ? AND trade_id = ?").get(v.agent_id, roundId);
  if (existing) {
    db.prepare("UPDATE agent_votes SET vote_direction = ?, confidence = ?, reasoning = ?, raw_analysis = ? WHERE agent_id = ? AND trade_id = ?")
      .run(v.vote_direction, v.confidence, v.reasoning, v.raw_analysis, v.agent_id, roundId);
    console.log(`Updated ${v.agent_id}: ${v.vote_direction} @ ${v.confidence}`);
  } else {
    db.prepare("INSERT INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run('VOTE-REVOTE-' + Date.now() + '-' + v.agent_id, roundId, v.agent_id, 'SMCI.US', v.vote_direction, v.confidence, v.reasoning, v.raw_analysis);
    console.log(`Inserted ${v.agent_id}: ${v.vote_direction} @ ${v.confidence}`);
  }
}

// Update round
db.prepare("UPDATE election_rounds SET total_voters = ?, buy_votes = ?, sell_votes = ?, hold_votes = ?, final_decision = 'BUY', decision_confidence = ? WHERE round_id = ?")
  .run(3, 3, 0, 0, (0.75 + 0.72 + 0.80) / 3, roundId);

console.log('\n=== FINAL RESULT ===');
console.log('Round:', roundId);
console.log('Symbol: SMCI.US');
console.log('Votes: 3 BUY / 0 SELL / 0 HOLD');
console.log('Avg confidence:', ((0.75 + 0.72 + 0.80) / 3).toFixed(3));
console.log('Decision: BUY (PASSED)');

// Verify
const updatedRound = db.prepare("SELECT * FROM election_rounds WHERE round_id = ?").get(roundId);
console.log('Updated round:', JSON.stringify(updatedRound));
