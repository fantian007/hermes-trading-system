import { getDb } from '../core/db.js';
const db = getDb();

const roundId = 'ELEC-20260525-1634';

// === Step 1: Check current state ===
const existingVotes = db.prepare('SELECT agent_id, vote_direction, confidence, reasoning FROM agent_votes WHERE trade_id = ?').all(roundId);
console.log('=== Existing votes for', roundId, '===');
for (const v of existingVotes) console.log(JSON.stringify(v));

const round = db.prepare('SELECT * FROM election_rounds WHERE round_id = ?').get(roundId);
console.log('\n=== Round state ===');
console.log(JSON.stringify(round));

// === Step 2: Insert missing votes based on analysis ===
// AGT-005 already submitted HOLD. We need AGT-002, AGT-004, AGT-007, AGT-008.
// These were analyzed by delegate_task sub-agents:

// AGT-002: MACD - HOLD @ 0.50
// Reasoning: Previous golden cross failed to sustain. Price flat at $180.07. DIF below zero. No fresh cross.
const votesToInsert = [
  {
    vote_id: 'VOTE-ELEC-20260525-1634-AGT-002',
    agent_id: 'AGT-002',
    vote_direction: 'HOLD',
    confidence: 0.50,
    reasoning: 'MACD分析：前次金叉($164->$180反弹)未能延续为持续上涨，DIF仍在零轴下，无新的金叉或底背离信号。价格横盘于$180附近，MACD柱负向扩张。无明确买入信号。'
  },
  {
    vote_id: 'VOTE-ELEC-20260525-1634-AGT-004',
    agent_id: 'AGT-004',
    vote_direction: 'HOLD',
    confidence: 0.55,
    reasoning: '布林带分析(20,2)：价格$180.07位于中轨$178.80上方，距上轨$189.80有5.4%空间。BB%约52%，带宽正常。价格于中轨~上轨之间震荡，无超买超卖。无明显突破信号，维持HOLD。'
  },
  {
    vote_id: 'VOTE-ELEC-20260525-1634-AGT-007',
    agent_id: 'AGT-007',
    vote_direction: 'BUY',
    confidence: 0.75,
    reasoning: '均线交叉分析：MA5($179.08)>MA10($175.11)>MA20($178.80)多头排列确认，价格$180.07站上所有均线。MA5-MA10价差2.27%属新鲜金叉。前次(5/24)金叉信号仍在延续，买点有效。强烈BUY。'
  },
  {
    vote_id: 'VOTE-ELEC-20260525-1634-AGT-008',
    agent_id: 'AGT-008',
    vote_direction: 'HOLD',
    confidence: 0.55,
    reasoning: 'RSI(14)分析：从5/14低点$164.33反弹至$180.07(+9.6%)，资金流入温和。RSI估算在55-60中性偏强区域，未触及70超买线或30超卖线。无超买超卖信号，维持HOLD。'
  }
];

const insertStmt = db.prepare(
  'INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
for (const v of votesToInsert) {
  const existing = db.prepare('SELECT * FROM agent_votes WHERE agent_id = ? AND trade_id = ? AND vote_node = ?').get(v.agent_id, roundId, 'BUY');
  if (existing) {
    db.prepare('UPDATE agent_votes SET vote_direction = ?, confidence = ?, reasoning = ? WHERE agent_id = ? AND trade_id = ? AND vote_node = ?')
      .run(v.vote_direction, v.confidence, v.reasoning, v.agent_id, roundId, 'BUY');
    console.log('UPDATED:', v.agent_id, v.vote_direction);
  } else {
    insertStmt.run(v.vote_id, roundId, v.agent_id, 'BUY', v.vote_direction, v.confidence, v.reasoning);
    console.log('INSERTED:', v.agent_id, v.vote_direction);
  }
}

// === Step 3: Update round counts ===
const allVotes = db.prepare('SELECT vote_direction FROM agent_votes WHERE trade_id = ?').all(roundId);
const counts = { buy: 0, sell: 0, hold: 0 };
for (const v of allVotes) {
  if (v.vote_direction === 'BUY') counts.buy++;
  else if (v.vote_direction === 'SELL') counts.sell++;
  else counts.hold++;
}
db.prepare('UPDATE election_rounds SET total_voters = ?, buy_votes = ?, sell_votes = ?, hold_votes = ? WHERE round_id = ?')
  .run(allVotes.length, counts.buy, counts.sell, counts.hold, roundId);
console.log('\n=== FINAL VOTE TALLY ===');
console.log(JSON.stringify({ round_id: roundId, total: allVotes.length, ...counts }));
console.log('\nAll individual votes:');
for (const v of allVotes) console.log(JSON.stringify(v));
