/**
 * AGT-004 Bollinger Band Breakout Strategist Vote Submission
 * Round: ELEC-20260523-2103 | Symbol: SMCI.US
 * 
 * Real-time analysis based on actual market data from 2026-05-22 close.
 * BB(20,2) framework analysis with squeeze detection.
 */
import { getDb } from '../core/db.js';

const vote = {
  vote_id: 'VOTE-AGT004-' + Date.now(),
  trade_id: 'ELEC-20260523-2103',
  agent_id: 'AGT-004',
  vote_node: 'SMCI.US',
  vote_direction: 'BUY',
  confidence: 0.72,
  reasoning:
    'AGT-004 BB(20,2)分析 SMCI.US: ' +
    '价格$35.58低于上轨$37.09(BB%=87.4%), 距上轨仍有$1.51空间 (非轨道外运行, 非极度过伸). ' +
    'SMA20=$31.08, 价格高于SMA 14.5%(中等水平, 非极端超买). ' +
    '经典布林带挤压模式(带宽从4月$24.45-$29.13盘整段→5月6日突破$27.83→$34.66+24.5%), ' +
    '当前带宽38.7%仍在扩张(挤压后突破的趋势延续阶段). ' +
    '5月20-22日三连阳$30.56→$35.58(+16.4%), 是第二波加速(第一波5月6日脉冲后5月7-19日消化). ' +
    '量能39.4M=1.1x均值, 温和放量非虚涨. ' +
    '布林带核心策略: 挤压后突破+持续扩张=趋势延续信号. 价格在轨道内运行(非轨道外), 向上空间充足. ' +
    '综合判断: BUY. 带宽扩张尚未完成, 上轨$37.09是短期目标, 趋势完好.',
  raw_analysis: JSON.stringify({
    bb_period: 20,
    bb_multiplier: 2,
    latest_close: 35.580,
    sma20: 31.08,
    upper_band: 37.09,
    lower_band: 25.07,
    bb_percent: 0.874,
    bandwidth: 0.387,
    price_above_upper: false,
    squeeze_detected: true,
    squeeze_breakout_confirmed: true,
    second_wave_breakout: true,
    volume_ratio_30d: 1.10,
    run_from_30d_low_pct: 37.0,
    recent_3d_gain_pct: 16.4,
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
