/**
 * 审计周期脚本
 *
 * 用法：
 *   npx tsx src/scripts/audit-cycle.ts
 *
 * 审计 Agent 定时调用（如 cron 每 30 分钟）：
 *   1. 更新所有 Agent 胜率统计
 *   2. 检查淘汰条件
 *   3. 检查影子期完成
 *   4. 发送状态变更通知
 */

import { updateAgentStats, getAgentRankings } from '../audit/stats.js';
import { checkElimination, checkShadowCompletion } from '../audit/lifecycle.js';
import { sendMessage, notifyAgentStatusChange } from '../notify/feishu.js';
import { getDb } from '../core/db.js';

async function main() {
  console.log('[audit] Starting audit cycle...');

  // 1. 更新胜率统计
  updateAgentStats();
  console.log('[audit] Stats updated');

  // 2. 检查淘汰
  const eliminated = checkElimination();
  for (const agentId of eliminated) {
    const agent = getDb().prepare('SELECT agent_name, win_rate FROM agents WHERE agent_id = ?').get(agentId) as any;
    const reason = `胜率 ${(agent?.win_rate * 100).toFixed(1)}% < 50%，触发淘汰 → SHADOW`;
    await notifyAgentStatusChange(agentId, 'ACTIVE', 'SHADOW', reason);
    console.log(`[audit] ${agentId} → SHADOW (${agent?.win_rate?.toFixed?.(3)})`);
  }

  // 3. 检查影子期完成
  const { resurrected, terminated } = checkShadowCompletion();
  
  for (const agentId of resurrected) {
    const agent = getDb().prepare('SELECT agent_name, win_rate FROM agents WHERE agent_id = ?').get(agentId) as any;
    const reason = `影子期胜率 ${(agent?.win_rate * 100).toFixed(1)}% ≥ 50%，复活 → ACTIVE`;
    await notifyAgentStatusChange(agentId, 'SHADOW', 'ACTIVE', reason);
    console.log(`[audit] ${agentId} → ACTIVE (resurrected)`);
  }
  
  for (const agentId of terminated) {
    const agent = getDb().prepare('SELECT agent_name, win_rate FROM agents WHERE agent_id = ?').get(agentId) as any;
    const reason = `影子期结束胜率 ${(agent?.win_rate * 100).toFixed(1)}% < 50% → TERMINATED`;
    await notifyAgentStatusChange(agentId, 'SHADOW', 'TERMINATED', reason);
    console.log(`[audit] ${agentId} → TERMINATED`);
  }

  // 4. 输出当前排名（供 debug）
  const rankings = getAgentRankings();
  console.log('[audit] Current rankings:');
  for (const r of rankings.slice(0, 10)) {
    console.log(`  ${r.agent_id} | ${r.agent_name} | ${(r.win_rate * 100).toFixed(1)}% | ${r.total_trades}t | ${r.status}`);
  }

  console.log('[audit] Cycle complete');
}

main().catch(console.error);
