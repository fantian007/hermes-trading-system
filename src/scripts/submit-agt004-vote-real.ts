/**
 * AGT-004 Bollinger Band Breakout Strategist Vote Submission
 * Round: ELEC-20260524-0451 | Symbol: ARM.US
 * 
 * Real-time analysis based on actual market data from 2026-05-22 close.
 */
import { getDb } from '../core/db.js';

const vote = {
  vote_id: 'VOTE-AGT004-' + Date.now(),
  trade_id: 'ELEC-20260524-0451',
  agent_id: 'AGT-004',
  vote_node: 'BUY',
  vote_direction: 'BUY',
  confidence: 0.55,
  reasoning:
    'AGT-004 BB(20,2)分析: 价格$306.51远超上轨$282.47(BB%=120.78%), 连续2日轨道外运行, 带宽51.5%确认强趋势(无挤压信号). ' +
    '5日加速+46.5%, 近20日最低点到当前涨+54.3%. 量能1.23x均值, 资金持续涌入. ' +
    '布林带策略核心: 轨道外运行+宽带宽=趋势延续, 顺势BUY. ' +
    '但价格高于SMA20达$82(+36.4%), 极度超买, 均值回归风险显著. ' +
    '已连续2日突破上轨+46.5%暴力拉升, 抛物线形态. ' +
    '综合判断: BUY (谨慎). 信用度下调至0.55, 高波动环境下入场位置非常不利.',
  raw_analysis: JSON.stringify({
    bb_period: 20,
    bb_multiplier: 2,
    latest_close: 306.51,
    sma20: 224.64,
    upper_band: 282.47,
    lower_band: 166.82,
    bb_percent: 1.2078,
    bandwidth: 0.515,
    price_above_upper: true,
    consecutive_above_upper: 2,
    accel_5d_pct: 46.5,
    volume_vs_avg: 1.23,
    run_from_window_start: 42.0,
    run_from_low_pct: 54.3,
    extreme_extension_above_sma20_pct: 36.4,
  }),
};

try {
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
  console.log(`Round: total=${votes.length} B=${counts.buy} S=${counts.sell} H=${counts.hold}`);
  for (const v of votes) {
    console.log(`  ${v.agent_id}: ${v.vote_direction} (conf=${v.confidence})`);
  }
  console.log(JSON.stringify({ vote: vote.vote_direction, confidence: vote.confidence }));
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
}
