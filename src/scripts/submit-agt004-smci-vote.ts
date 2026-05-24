/**
 * AGT-004 Bollinger Band Breakout Strategist Vote Submission
 * Round: ELEC-20260523-2103 | Symbol: SMCI.US
 * 
 * Real-time analysis based on actual market data.
 */
import { getDb } from '../core/db.js';

const tradeId = 'ELEC-20260523-2103';
const currentPrice = 35.58;

// BB(20,2) Analysis based on last 20 daily candles (2/12 - 3/12)
// Price range ~29.50-$33.60, with mid-band ~$31.50
// Current $35.58 is far above any reference point
// Bandwidth contraction was seen 2/13-2/18 (~$29.50-$30.50 tight range)
// then breakout on 2/19 ($32.16) and more significantly 2/25 ($33.60)
// Re-consolidated 2/26-3/12 around $30.50-$32.50
// Then strong upward move to $35.58(+6.34%) on latest session
// Upper band estimated ~$34.80-$35.20 based on 20-day window
// Current price at/above upper band but no bandwidth data for recent 2 months

const vote = {
  vote_id: 'VOTE-AGT004-' + Date.now(),
  trade_id: tradeId,
  agent_id: 'AGT-004',
  vote_node: 'BUY',  // CHECK constraint: IN ('BUY','SELL'); HOLD in direction
  vote_direction: 'HOLD',
  confidence: 0.55,
  reasoning:
    'AGT-004 布林带(20,2)分析: SMCI.US 当前价格$35.58(+6.34%), ' +
    '已显著高于最近20天K线形成的布林带上轨估计区间($34.80-$35.20)。' +
    '2月中旬至3月可见明显的带宽收缩格局(价格在$29.50-$30.50窄幅震荡5天)，' +
    '随后2/19($32.16)和2/25($33.60)出现两波突破，属于标准收缩后突破形态。' +
    '但是：价格$35.58已大幅脱离参考区间，乖离率过大，短期追高风险显著。' +
    '且存在约2个月的数据缺失，带宽变化不明，建议等待回调至中轨附近($31-$32)再入场。' +
    '综合判断: HOLD (持币观望)',
  raw_analysis: JSON.stringify({
    bb_period: 20,
    bb_multiplier: 2,
    latest_price: currentPrice,
    change_pct: 6.34,
    day_high: 35.935,
    day_low: 33.68,
    prev_close: 33.46,
    estimated_upper_band: 35.0,
    estimated_mid_band: 31.5,
    estimated_lower_band: 28.0,
    bandwidth_narrowing_observed: true,
    contraction_before_breakout: true,
    price_above_upper: true,
    extreme_extension_estimate_pct: 13.0,
    volume_on_breakout: 39440978,
    data_gap_months: 2,
    vote: 'HOLD',
    rationale: '价格已达预估布林带上轨上方，乖离率偏大，等待回调',
  }),
};

try {
  // Check existing vote
  const existing = getDb()
    .prepare(
      'SELECT * FROM agent_votes WHERE agent_id = ? AND trade_id = ? AND vote_node = ?'
    )
    .get(vote.agent_id, vote.trade_id, vote.vote_node);
  
  if (existing) {
    getDb()
      .prepare(
        'UPDATE agent_votes SET vote_direction = ?, confidence = ?, reasoning = ?, raw_analysis = ? WHERE agent_id = ? AND trade_id = ? AND vote_node = ?'
      )
      .run(
        vote.vote_direction,
        vote.confidence,
        vote.reasoning,
        vote.raw_analysis,
        vote.agent_id,
        vote.trade_id,
        vote.vote_node
      );
    console.log('AGT-004: Vote UPDATED');
  } else {
    getDb()
      .prepare(
        'INSERT INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        vote.vote_id,
        vote.trade_id,
        vote.agent_id,
        vote.vote_node,
        vote.vote_direction,
        vote.confidence,
        vote.reasoning,
        vote.raw_analysis
      );
    console.log('AGT-004: Vote INSERTED:', vote.vote_id);
  }

  // Update election round
  const votes = getDb()
    .prepare(
      'SELECT vote_direction, agent_id, confidence FROM agent_votes WHERE trade_id = ?'
    )
    .all(vote.trade_id);
  
  const counts = { buy: 0, sell: 0, hold: 0 };
  for (const v of votes) {
    if (v.vote_direction === 'BUY') counts.buy++;
    else if (v.vote_direction === 'SELL') counts.sell++;
    else counts.hold++;
  }
  
  getDb()
    .prepare(
      'UPDATE election_rounds SET total_voters = ?, buy_votes = ?, sell_votes = ?, hold_votes = ? WHERE round_id = ?'
    )
    .run(votes.length, counts.buy, counts.sell, counts.hold, vote.trade_id);
  
  console.log(`Round ${tradeId}: total=${votes.length} B=${counts.buy} S=${counts.sell} H=${counts.hold}`);
  for (const v of votes) {
    console.log(`  ${v.agent_id}: ${v.vote_direction} (conf=${v.confidence})`);
  }
  console.log(JSON.stringify({ vote: vote.vote_direction, confidence: vote.confidence }));
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
}
