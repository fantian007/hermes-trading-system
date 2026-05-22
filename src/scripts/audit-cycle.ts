/**
 * 审计周期 — PURE STATS TOOL
 *
 * 职责（仅此两项）：
 *   1. 更新所有 Agent 的胜率统计数据（updateAgentStats — 纯数据聚合）
 *   2. 输出当前排名和详细统计的 JSON
 *
 * 所有业务决策交给 Agent 自然语言：
 *   - Agent（审计）读取 JSON 后这样说：
 *     "RAG-0003 只有 40% 胜率，12 笔交易，应该降入 SHADOW"
 *     "RAG-0005 影子期完了 10 笔达到 60% 胜率，应该复活"
 *
 * 用法：
 *   npx tsx src/scripts/audit-cycle.ts
 */

import { updateAgentStats, getAgentRankings, getAgentStats } from '../audit/stats.js';

async function main() {
  // 1. Update stats (pure data computation)
  updateAgentStats();

  // 2. Get full rankings
  const rankings = getAgentRankings();

  // 3. Get detailed stats for each agent
  const detailedStats = rankings.map(agent => {
    const stats = getAgentStats(agent.agent_id);
    return stats;
  }).filter(Boolean);

  // 4. Output JSON — NO decisions, NO elimination logic
  console.log(JSON.stringify({
    type: 'audit_snapshot',
    timestamp: new Date().toISOString(),
    total_agents: rankings.length,
    rankings: rankings.map(r => ({
      agent_id: r.agent_id,
      agent_name: r.agent_name,
      status: r.status,
      win_rate: r.win_rate,
      win_rate_recent_5: r.win_rate_recent_5,
      total_trades: r.total_trades,
      win_count: r.win_count,
    })),
    details: detailedStats,
  }));
}

main().catch(console.error);
