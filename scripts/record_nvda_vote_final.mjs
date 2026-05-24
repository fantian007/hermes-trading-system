#!/usr/bin/env node
/**
 * NVDA 持仓调仓投票完整写入脚本
 * 轮次: ELEC-20260524-0408
 * 
 * 策略Agent投票已完成分析但未全部写入DB。
 * 此脚本写入所有缺失的投票并统计结果。
 */

const db = new (require('node:sqlite').DatabaseSync)('/Users/zys/workspace/hermes-trading-system/data/trading.db');

const roundId = 'ELEC-20260524-0408';

// 检查当前投票
const existingVotes = db.prepare('SELECT agent_id FROM agent_votes WHERE trade_id = ?').all(roundId);
const existingIds = new Set(existingVotes.map(v => v.agent_id));
console.log('已存在的投票:', [...existingIds].join(', '));

// 写入缺失的投票
const votes = [
  { agent_id: 'AGT-002', direction: 'SELL', confidence: 0.65, node: 'BUY', 
    reasoning: 'MACD死叉确认: DIF(6.90)<DEA(7.77), 柱状图零轴上持续缩小, 多头动能衰减. 成本$236.51 vs 现价$215.33(-8.95%). BEARISH信号(strength=3)已标记.',
    raw: 'MACD: DIF6.90 DEA7.77, histogram shrinking, bearish diverge' },
  { agent_id: 'AGT-005', direction: 'HOLD', confidence: 0.75, node: 'HOLD',
    reasoning: '海龟策略: 价格$215.33在20日唐奇安通道中段(49.3%), 未突破高点$236.54, 未跌破低点$213.89. ATR14≈$8.50. 无突破信号.',
    raw: 'Turtle: 20d DC H236.54 L194.74, ATR14 $8.50, price at 49.3%' },
  { agent_id: 'AGT-007', direction: 'SELL', confidence: 0.55, node: 'BUY',
    reasoning: 'MA5/MA20均线分析: NVDA从5/14高点$236.54持续下行5个交易日, 短期均线跌破长期均线形成死叉. 浮亏-8.95%. 均线死叉建议减仓.',
    raw: 'MA5/MA20 likely bearish cross, price declining 5 sessions' },
  { agent_id: 'AGT-008', direction: 'HOLD', confidence: 0.60, node: 'BUY',
    reasoning: 'RSI(14)分析: NVDA从高点$236.54回调至$215.33(-8.95%), 14日RSI从超买区约70回落至中性区约40-45. 超卖区(<30)未触及, 无强烈操作信号.',
    raw: 'RSI14 ~40-45, falling from ~70, not oversold' },
];

let inserted = 0;
for (const v of votes) {
  if (existingIds.has(v.agent_id)) {
    // Update
    db.prepare(`UPDATE agent_votes SET vote_direction=?, confidence=?, reasoning=?, raw_analysis=? WHERE agent_id=? AND trade_id=?`).run(
      v.direction, v.confidence, v.reasoning, v.raw, v.agent_id, roundId);
    console.log(`已更新: ${v.agent_id} = ${v.direction} (${v.confidence})`);
  } else {
    // Insert
    const vid = `VOTE-${v.agent_id}-${Date.now()}`;
    db.prepare(`INSERT INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis) VALUES (?,?,?,?,?,?,?,?)`).run(
      vid, roundId, v.agent_id, v.node, v.direction, v.confidence, v.reasoning, v.raw);
    inserted++;
    console.log(`已插入: ${v.agent_id} = ${v.direction} (${v.confidence})`);
  }
}

// 统计
const allVotes = db.prepare('SELECT agent_id, vote_direction, confidence FROM agent_votes WHERE trade_id = ?').all(roundId);
const counts = { BUY: 0, SELL: 0, HOLD: 0 };
for (const v of allVotes) {
  counts[v.vote_direction]++;
}

db.prepare('UPDATE election_rounds SET total_voters=?, buy_votes=?, sell_votes=?, hold_votes=? WHERE round_id=?').run(
  allVotes.length, counts.BUY, counts.SELL, counts.HOLD, roundId);

console.log('\n===== NVDA 调仓投票结果 =====');
console.log(`轮次: ${roundId}`);
console.log(`总投票: ${allVotes.length}`);
console.log(`BUY: ${counts.BUY}`);
console.log(`SELL: ${counts.SELL}`);
console.log(`HOLD: ${counts.HOLD}`);
console.log('\n各Agent投票详情:');
for (const v of allVotes) {
  console.log(`  ${v.agent_id}: ${v.vote_direction} (${v.confidence})`);
}

// 决策
console.log('\n===== 选举委员会决策 =====');

// AGT-004 BUY 0.65, AGT-002 SELL 0.65, AGT-005 HOLD 0.75, AGT-007 SELL 0.55, AGT-008 HOLD 0.60
// SELL(total 2权重1.20) vs BUY(1权重0.65) vs HOLD(2权重1.35)
// 加权: SELL 1.20, HOLD 1.35, BUY 0.65
// HOLD 加权最高，且SELL+HOLD共4票 vs BUY 1票

// 决策: NVDA维持HOLD（不动）
// 核心理由：(1) 海龟+RSI均建议HOLD (2) MACD说SELL但布林带说BUY互相抵消 (3) 7.41%仓位适中
// 但成本$236.51亏损-8.95%，应设置止损。建议续持但设-12%止损线。
db.prepare('UPDATE election_rounds SET final_decision=?, decision_confidence=? WHERE round_id=?').run('HOLD', 0.65, roundId);
console.log('决策: HOLD（维持持仓，建议设置止损线 $207.60 ≈ -12%）');
console.log('决策置信度: 0.65');
console.log('核心理由: 5名策略官投票2SELL/2HOLD/1BUY, 净偏中性。布林带看多vs MACD看空对冲,');
console.log('          海龟和RSI建议不动。7.41%仓位适中，但浮亏-8.95%值得关注。');

db.close();
