/**
 * Phase 2 预设审核 Agent 种子数据
 *
 * 5 个审核框架：均线交叉 / MACD / RSI / 布林带 / 海龟交易法
 * 原策略部门（strategy agents AGT-0001~0005）已重组为审核部门（review agents RAG-0001~0005）。
 * 审核 Agents 不参与投票交易，而是在交易完成后做事后审核。
 *
 * 注意：选举委员会（AST-0001）仍使用 election-committee profile，未受影响。
 * 用法：npx tsx sql/seeds/seed.ts
 */

import { getDb, closeDb, runInTransaction } from '../../src/core/db.js';

const presetAgents = [
  {
    agent_id: 'RAG-0001',
    agent_name: '均线交叉审核官',
    profile_name: 'review-01',
    strategy_source: '《股市趋势技术分析》',
    strategy_summary: '审核框架：均线交叉审核。检查 MA5/MA20 在交易时间点的位置关系，判断入场/出场时机是否与技术信号匹配。',
    indicators: JSON.stringify(['ma']),
  },
  {
    agent_id: 'RAG-0002',
    agent_name: 'MACD审核官',
    profile_name: 'review-02',
    strategy_source: '《技术指标实战》',
    strategy_summary: '审核框架：MACD 交叉审核。检查 MACD 快线（DIF）与慢线（DEA）在交易时间点的金叉/死叉位置，评估交易方向是否合理。',
    indicators: JSON.stringify(['macd']),
  },
  {
    agent_id: 'RAG-0003',
    agent_name: 'RSI审核官',
    profile_name: 'review-03',
    strategy_source: '《技术分析精解》',
    strategy_summary: '审核框架：RSI 超买超卖审核。检查交易时间点的 RSI 值是否处于超买（>70）或超卖（<30）区域，验证交易方向与震荡指标的一致性。',
    indicators: JSON.stringify(['rsi']),
  },
  {
    agent_id: 'RAG-0004',
    agent_name: '布林带审核官',
    profile_name: 'review-04',
    strategy_source: '《布林带实战指南》',
    strategy_summary: '审核框架：布林带突破审核。检查价格在交易时间点相对于布林带上轨/下轨的位置，结合成交量确认突破信号的有效性。',
    indicators: JSON.stringify(['bollinger', 'rsi']),
  },
  {
    agent_id: 'RAG-0005',
    agent_name: '海龟交易审核官',
    profile_name: 'review-05',
    strategy_source: '《海龟交易法则》',
    strategy_summary: '审核框架：海龟交易法则审核。检查价格是否突破了 N 日高低点通道，以及 ATR 维度下的仓位合理性评估。',
    indicators: JSON.stringify(['atr', 'ma']),
  },
];

const insertSql = `
  INSERT OR IGNORE INTO agents
    (agent_id, agent_name, profile_name, strategy_source, strategy_summary, indicators, status, created_by)
  VALUES
    (@agent_id, @agent_name, @profile_name, @strategy_source, @strategy_summary, @indicators, 'ACTIVE', 'system')
`;

const insertSignature = `
  INSERT OR IGNORE INTO strategy_signatures
    (agent_id, source_book, core_concept, indicators_used, market_scope)
  VALUES
    (@agent_id, @source_book, @core_concept, @indicators_used, 'US')
`;

function seed() {
  const stmt = getDb().prepare(insertSql);
  const sigStmt = getDb().prepare(insertSignature);

  for (const agent of presetAgents) {
    stmt.run(agent);
    sigStmt.run({
      agent_id: agent.agent_id,
      source_book: agent.strategy_source,
      core_concept: agent.strategy_summary,
      indicators_used: agent.indicators,
    });
    console.log(`[db:seed] Inserted ${agent.agent_id} — ${agent.agent_name}`);
  }
}

console.log('[db:seed] Seeding preset review agents...');
seed();
console.log('[db:seed] Done — 5 review agents seeded');

closeDb();
