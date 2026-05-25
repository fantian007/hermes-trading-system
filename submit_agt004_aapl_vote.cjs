/**
 * AGT-004 Bollinger Band Breakout Strategist Vote Submission
 * Round: ELEC-20260525-1648 | Symbol: AAPL.US
 * $308.82 close, SMA20=$289.35, Upper=$314.19, Lower=$264.50
 * %B=89.19%, Bandwidth=17.17%
 * 
 * BB(20,2) analysis: Price $308.82 is between SMA($289.35) and Upper Band($314.19), 
 * %B = 89.19% — strong upper-half position but NOT above upper band (no overextension).
 * Bandwidth 17.17% widening from 16.58% (prior period) — trending condition, no squeeze.
 * Price has been in a steady uptrend for 5+ sessions, closing higher day-over-day.
 * Current position 17.70% is the highest allocation in the portfolio — overweight.
 * P&L only +0.17% — barely profitable.
 * 
 * BB strategy: HOLD. Price trending well within bands, uptrend intact, no mean-reversion 
 * trigger. However, the 17.70% weight is the highest across 6 holdings, so monitoring 
 * for a close below upper band next session would justify REDUCE.
 */
const { getDb } = require('../core/db.js');

const roundId = 'ELEC-20260525-1648';
const symbol = 'AAPL.US';

const rawAnalysis = {
  bb_period: 20,
  bb_multiplier: 2,
  latest_close: 308.82,
  sma20: 289.35,
  upper_band: 314.19,
  lower_band: 264.50,
  bb_percent: 0.8919,
  bandwidth: 0.1717,
  price_above_upper: false,
  price_between_sma_upper: true,
  consecutive_above_upper: 0,
  close_5d_ago: 298.21,
  change_5d_pct: 3.56
};

const vote = {
  vote_id: 'VOTE-AGT004-AAPL-' + Date.now(),
  trade_id: roundId,
  agent_id: 'AGT-004',
  vote_node: 'BUY',           // this is BUY since we're voting on a long position
  vote_direction: 'HOLD',     // HOLD / REDUCE / ADD / CLOSE
  confidence: 0.70,
  reasoning: `BB(20,2) analysis for AAPL.US: close $308.82, SMA20 $289.35, Upper $314.19, Lower $264.50. %B=89.19% in upper band half, price trending up within bands. Bandwidth 17.17% widening (no squeeze). 5-day change +3.56% (steady uptrend). NOT above upper band — no overextension sell signal. Position at 17.70% is highest allocation. BB strategy: HOLD — uptrend intact, no mean-reversion trigger. Would REDUCE if price closes below upper band next session without breaking higher.`,
  raw_analysis: JSON.stringify(rawAnalysis)
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

  // Update election_rounds counters
  const votes = getDb().prepare('SELECT vote_direction FROM agent_votes WHERE trade_id = ?').all(vote.trade_id);
  const counts = { buy: 0, sell: 0, hold: 0 };
  for (const v of votes) {
    if (v.vote_direction === 'BUY' || v.vote_direction === 'ADD') counts.buy++;
    else if (v.vote_direction === 'SELL' || v.vote_direction === 'REDUCE' || v.vote_direction === 'CLOSE') counts.sell++;
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
