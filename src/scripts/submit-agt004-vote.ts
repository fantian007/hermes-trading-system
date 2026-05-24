/**
 * AGT-004 Bollinger Band Breakout Strategist Vote Submission
 * Round: ELEC-20260524-0451 | Symbol: ARM.US
 */
import { getDb } from '../core/db.js';

const vote = {
  vote_id: 'VOTE-AGT004-' + Date.now(),
  trade_id: 'ELEC-20260524-0451',
  agent_id: 'AGT-004',
  vote_node: 'BUY',
  vote_direction: 'BUY',
  confidence: 0.65,
  reasoning: "BB(20,2) analysis: price $306.51 massively above upper band ($282.47), BB% = 120.78% - sustained band-walk for 2 consecutive days. Bandwidth 51.48% confirms strong trending (no squeeze). 5-bar acceleration +42.48% and 165% run from $115 lows indicate parabolic extension. Classic BB strategy: band-walk above upper = strong bullish momentum, stay with trend. However, price is 36% above SMA20 ($224.64) - extremely extended. Risk of sharp mean reversion elevated. Voting BUY with moderated confidence.",
  raw_analysis: JSON.stringify({
    bb_period: 20, bb_multiplier: 2, latest_close: 306.51,
    sma20: 224.64, upper_band: 282.47, lower_band: 166.82,
    bb_percent: 1.2078, bandwidth: 0.5148,
    price_above_upper: true, consecutive_above_upper: 2,
    accel_5d_pct: 42.48, volume_vs_avg: 1.38
  })
};

try {
  const existing = getDb().prepare(
    'SELECT * FROM agent_votes WHERE agent_id = ? AND trade_id = ? AND vote_node = ?'
  ).get(vote.agent_id, vote.trade_id, vote.vote_node);
  if (existing) {
    getDb().prepare(
      'UPDATE agent_votes SET vote_direction = ?, confidence = ?, reasoning = ?, raw_analysis = ? WHERE agent_id = ? AND trade_id = ? AND vote_node = ?'
    ).run(vote.vote_direction, vote.confidence, vote.reasoning, vote.raw_analysis, vote.agent_id, vote.trade_id, vote.vote_node);
    console.log('AGT-004: Vote UPDATED');
  } else {
    getDb().prepare(
      'INSERT INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(vote.vote_id, vote.trade_id, vote.agent_id, vote.vote_node, vote.vote_direction, vote.confidence, vote.reasoning, vote.raw_analysis);
    console.log('AGT-004: Vote INSERTED:', vote.vote_id);
  }

  const votes = getDb().prepare('SELECT vote_direction FROM agent_votes WHERE trade_id = ?').all(vote.trade_id);
  const counts = { buy: 0, sell: 0, hold: 0 };
  for (const v of votes) {
    if (v.vote_direction === 'BUY') counts.buy++;
    else if (v.vote_direction === 'SELL') counts.sell++;
    else counts.hold++;
  }
  getDb().prepare(
    'UPDATE election_rounds SET total_voters = ?, buy_votes = ?, sell_votes = ?, hold_votes = ? WHERE round_id = ?'
  ).run(votes.length, counts.buy, counts.sell, counts.hold, vote.trade_id);
  console.log(`Round: total=${votes.length} B=${counts.buy} S=${counts.sell} H=${counts.hold}`);
  console.log(JSON.stringify({vote: vote.vote_direction, confidence: vote.confidence, reasoning: vote.reasoning}));
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
}
