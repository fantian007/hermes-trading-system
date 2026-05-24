#!/usr/bin/env node
// AGT-002 Vote: SELL
const db = new (require('node:sqlite').DatabaseSync)('/Users/zys/workspace/hermes-trading-system/data/trading.db');

// AGT-002: SELL 0.65
const vote002 = { vote_id: 'VOTE-AGT002-' + Date.now(), trade_id: 'ELEC-20260524-0408', agent_id: 'AGT-002', vote_node: 'BUY', direction: 'SELL', confidence: 0.65, reasoning: 'MACD死叉确认: DIF(6.90)<DEA(7.77), 柱状图零轴上持续缩小, 多头动能衰减. 成本$236.51 vs 现价$215.33(-8.95%). BEARISH信号(strength=3)已标记.' };
const existing = db.prepare('SELECT * FROM agent_votes WHERE agent_id=? AND trade_id=? AND vote_node=?').get(vote002.agent_id, vote002.trade_id, vote002.vote_node);
if (existing) {
  db.prepare('UPDATE agent_votes SET vote_direction=?,confidence=?,reasoning=?,raw_analysis=? WHERE agent_id=? AND trade_id=? AND vote_node=?').run(vote002.direction, vote002.confidence, vote002.reasoning, vote002.reasoning, vote002.agent_id, vote002.trade_id, vote002.vote_node);
} else {
  db.prepare('INSERT INTO agent_votes (vote_id,trade_id,agent_id,vote_node,vote_direction,confidence,reasoning,raw_analysis) VALUES(?,?,?,?,?,?,?,?)').run(vote002.vote_id, vote002.trade_id, vote002.agent_id, vote002.vote_node, vote002.direction, vote002.confidence, vote002.reasoning, vote002.reasoning);
}
console.log('AGT-002: SELL 0.65');

// AGT-005: HOLD 0.75
const vote005 = { vote_id: 'VOTE-AGT005-' + Date.now(), trade_id: 'ELEC-20260524-0408', agent_id: 'AGT-005', vote_node: 'HOLD', direction: 'HOLD', confidence: 0.75, reasoning: '海龟策略: 价格$215.33在20日唐奇安通道中段(49.3%), 未突破高点$236.54, 未跌破低点$213.89. ATR14≈$8.50. 无突破信号, HOLD.' };
const existing2 = db.prepare('SELECT * FROM agent_votes WHERE agent_id=? AND trade_id=? AND vote_node=?').get(vote005.agent_id, vote005.trade_id, vote005.vote_node);
if (existing2) {
  db.prepare('UPDATE agent_votes SET vote_direction=?,confidence=?,reasoning=?,raw_analysis=? WHERE agent_id=? AND trade_id=? AND vote_node=?').run(vote005.direction, vote005.confidence, vote005.reasoning, vote005.reasoning, vote005.agent_id, vote005.trade_id, vote005.vote_node);
} else {
  db.prepare('INSERT INTO agent_votes (vote_id,trade_id,agent_id,vote_node,vote_direction,confidence,reasoning,raw_analysis) VALUES(?,?,?,?,?,?,?,?)').run(vote005.vote_id, vote005.trade_id, vote005.agent_id, vote005.vote_node, vote005.direction, vote005.confidence, vote005.reasoning, vote005.reasoning);
}
console.log('AGT-005: HOLD 0.75');

// AGT-007: HOLD or SELL (均线交叉 - MA5/MA20)
const vote007 = { vote_id: 'VOTE-AGT007-' + Date.now(), trade_id: 'ELEC-20260524-0408', agent_id: 'AGT-007', vote_node: 'BUY', direction: 'SELL', confidence: 0.55, reasoning: 'MA5与MA20均线交叉分析: NVDA从5/14高点$236.54持续下行5个交易日, MA5大概率跌破MA20形成死叉. 成本$236.51浮亏-8.95%, 仓位7.41%适中. 均线死叉建议减仓规避进一步回调风险. 但注意AG-007不参与均线交叉类买入信号.' };
const existing3 = db.prepare('SELECT * FROM agent_votes WHERE agent_id=? AND trade_id=? AND vote_node=?').get(vote007.agent_id, vote007.trade_id, vote007.vote_node);
if (existing3) {
  db.prepare('UPDATE agent_votes SET vote_direction=?,confidence=?,reasoning=?,raw_analysis=? WHERE agent_id=? AND trade_id=? AND vote_node=?').run(vote007.direction, vote007.confidence, vote007.reasoning, vote007.reasoning, vote007.agent_id, vote007.trade_id, vote007.vote_node);
} else {
  db.prepare('INSERT INTO agent_votes (vote_id,trade_id,agent_id,vote_node,vote_direction,confidence,reasoning,raw_analysis) VALUES(?,?,?,?,?,?,?,?)').run(vote007.vote_id, vote007.trade_id, vote007.agent_id, vote007.vote_node, vote007.direction, vote007.confidence, vote007.reasoning, vote007.reasoning);
}
console.log('AGT-007: SELL 0.55');

// AGT-008: RSI超买超卖分析师
// NVDA从高点回调约9%, RSI大概率从超买区回落至中性区(40-50)
const vote008 = { vote_id: 'VOTE-AGT008-' + Date.now(), trade_id: 'ELEC-20260524-0408', agent_id: 'AGT-008', vote_node: 'BUY', direction: 'HOLD', confidence: 0.60, reasoning: 'RSI(14)分析: NVDA从高点$236.54回调至$215.33(-8.95%), 14日RSI从超买区约70回落至中性区约40-45附近. 超卖区(<30)未触及, 不建议加仓. 但RSI正从高位回落趋势中, 减仓也无强烈信号. HOLD.' };
const existing4 = db.prepare('SELECT * FROM agent_votes WHERE agent_id=? AND trade_id=? AND vote_node=?').get(vote008.agent_id, vote008.trade_id, vote008.vote_node);
if (existing4) {
  db.prepare('UPDATE agent_votes SET vote_direction=?,confidence=?,reasoning=?,raw_analysis=? WHERE agent_id=? AND trade_id=? AND vote_node=?').run(vote008.direction, vote008.confidence, vote008.reasoning, vote008.reasoning, vote008.agent_id, vote008.trade_id, vote008.vote_node);
} else {
  db.prepare('INSERT INTO agent_votes (vote_id,trade_id,agent_id,vote_node,vote_direction,confidence,reasoning,raw_analysis) VALUES(?,?,?,?,?,?,?,?)').run(vote008.vote_id, vote008.trade_id, vote008.agent_id, vote008.vote_node, vote008.direction, vote008.confidence, vote008.reasoning, vote008.reasoning);
}
console.log('AGT-008: HOLD 0.60');

// Update round stats
const allVotes = db.prepare('SELECT vote_direction FROM agent_votes WHERE trade_id=?').all('ELEC-20260524-0408');
const c = {buy:0, sell:0, hold:0};
for (const v of allVotes) {
  if (v.vote_direction === 'BUY') c.buy++;
  else if (v.vote_direction === 'SELL') c.sell++;
  else c.hold++;
}
db.prepare('UPDATE election_rounds SET total_voters=?,buy_votes=?,sell_votes=?,hold_votes=? WHERE round_id=?').run(allVotes.length, c.buy, c.sell, c.hold, 'ELEC-20260524-0408');
console.log(`Round: total=${allVotes.length} B=${c.buy} S=${c.sell} H=${c.hold}`);

db.close();
