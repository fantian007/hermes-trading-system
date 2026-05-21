/**
 * Phase 1 预设策略 Agent 种子数据
 *
 * 5 个经典策略：均线交叉 / MACD / RSI / 布林带 / 海龟交易法
 * 用法：npx tsx sql/seeds/seed.ts
 */

import { getDb, closeDb, runInTransaction } from '../../src/core/db.js';

const presetAgents = [
  {
    agent_id: 'AGT-0001',
    agent_name: '均线交叉策略',
    profile_name: 'strategy-01',
    strategy_source: '《股市趋势技术分析》',
    strategy_summary: '短期均线上穿长期均线为买入信号，下穿为卖出信号。使用 MA5/MA20 双均线交叉判定。',
    indicators: JSON.stringify(['ma']),
  },
  {
    agent_id: 'AGT-0002',
    agent_name: 'MACD 金叉策略',
    profile_name: 'strategy-02',
    strategy_source: '《技术指标实战》',
    strategy_summary: 'MACD 快线（DIF）上穿慢线（DEA）形成金叉买入，下穿形成死叉卖出。结合零轴位置判断趋势强度。',
    indicators: JSON.stringify(['macd']),
  },
  {
    agent_id: 'AGT-0003',
    agent_name: 'RSI 超买超卖策略',
    profile_name: 'strategy-03',
    strategy_source: '《技术分析精解》',
    strategy_summary: 'RSI 低于 30 为超卖区买入信号，高于 70 为超买区卖出信号。结合趋势确认避免假信号。',
    indicators: JSON.stringify(['rsi']),
  },
  {
    agent_id: 'AGT-0004',
    agent_name: '布林带突破策略',
    profile_name: 'strategy-04',
    strategy_source: '《布林带实战指南》',
    strategy_summary: '价格触及下轨且 RSI 未超卖时买入，触及上轨且成交量放大时卖出。突破中轨确认方向。',
    indicators: JSON.stringify(['bollinger', 'rsi']),
  },
  {
    agent_id: 'AGT-0005',
    agent_name: '海龟交易策略',
    profile_name: 'strategy-05',
    strategy_source: '《海龟交易法则》',
    strategy_summary: '价格突破 N 日高点买入，跌破 N 日低点卖出。使用 ATR 计算仓位大小，金字塔式加仓。',
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

console.log('[db:seed] Seeding preset strategy agents...');
seed();
console.log('[db:seed] Done — 5 preset agents seeded');

closeDb();
