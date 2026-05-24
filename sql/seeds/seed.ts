/**
 * Phase 2 预设审核 Agent 种子数据
 *
 * 1 个审核框架：均线交叉
 * 原策略部门已重组为审核部门。
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
console.log('[db:seed] Done — 1 review agent seeded');

closeDb();
