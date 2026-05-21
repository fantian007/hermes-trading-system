/**
 * Agent Lifecycle Management — Agent 生命周期管理（淘汰 / 复活）
 *
 * 实现看板式人事流转：
 *   1. checkElimination()    — 低胜率 ACTIVE → SHADOW（留用察看）
 *   2. checkShadowCompletion() — SHADOW 完成 10 笔 shadow 交易后评估
 *   3. rankAndEliminate()    — 末位淘汰 ACTIVE 中排名最后的 Agent
 *
 * 所有状态变更均记录到 agent_status_log 表。
 */

import { getDb, runInTransaction } from '../core/db.js';
import type { Agent, AgentStatus, AgentStatusLog } from '../core/types.js';

// ═══════════════════════════════════════════════════════════════════
//  公开 API
// ═══════════════════════════════════════════════════════════════════

/**
 * 淘汰检查：找出胜率过低的 ACTIVE Agent，降级为 SHADOW（留用察看）
 *
 * 条件：
 *   - status = 'ACTIVE'
 *   - total_trades >= 10
 *   - win_rate < 0.5
 *
 * @returns 被降级的 agent_id 列表（可能为空）
 */
export function checkElimination(): string[] {
  const db = getDb();
  const eliminated: string[] = [];

  const candidates = db.prepare(`
    SELECT agent_id, win_rate, total_trades
    FROM agents
    WHERE status = 'ACTIVE'
      AND total_trades >= 10
      AND win_rate < 0.5
  `).all() as Pick<Agent, 'agent_id' | 'win_rate' | 'total_trades'>[];

  const changeStatus = db.prepare(`
    UPDATE agents SET status = ? WHERE agent_id = ? AND status = 'ACTIVE'
  `);

  const insertLog = db.prepare(`
    INSERT INTO agent_status_log
      (agent_id, from_status, to_status, reason, triggered_by, changed_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `);

  const txn = runInTransaction(() => {
    for (const agent of candidates) {
      changeStatus.run('SHADOW', agent.agent_id);
      insertLog.run(
        agent.agent_id,
        'ACTIVE',
        'SHADOW',
        `胜率过低: ${(agent.win_rate * 100).toFixed(1)}% (${agent.total_trades}笔)`,
        'AUDITOR',
      );
      eliminated.push(agent.agent_id);
    }
  });

  txn();
  return eliminated;
}

/**
 * Shadow 完成检查：SHADOW Agent 完成 10 笔 shadow 交易后评估去留
 *
 * 判断逻辑：
 *   - shadow 交易数 >= 10 → 进入评估
 *     - win_rate >= 0.5 → 复活为 ACTIVE，随后触发 rankAndEliminate()
 *     - win_rate <  0.5 → 正式 TERMINATED
 *   - shadow 交易数 <  10 → 继续留用察看，不做变更
 *
 * @returns { resurrected, terminated } 分别列出复活和淘汰的 agent_id
 */
export function checkShadowCompletion(): {
  resurrected: string[];
  terminated: string[];
} {
  const db = getDb();
  const resurrected: string[] = [];
  const terminated: string[] = [];

  const shadowAgents = db.prepare(`
    SELECT agent_id, win_rate
    FROM agents
    WHERE status = 'SHADOW'
  `).all() as Pick<Agent, 'agent_id' | 'win_rate'>[];

  const changeStatus = db.prepare(`
    UPDATE agents SET status = ?, terminated_at = ? WHERE agent_id = ?
  `);

  const insertLog = db.prepare(`
    INSERT INTO agent_status_log
      (agent_id, from_status, to_status, reason, triggered_by, changed_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `);

  const txn = runInTransaction(() => {
    for (const agent of shadowAgents) {
      const shadowCompleted = countShadowTrades(db, agent.agent_id);

      if (shadowCompleted < 10) continue; // 还不够，继续观察

      if (agent.win_rate >= 0.5) {
        // 复活
        changeStatus.run('ACTIVE', null, agent.agent_id);
        insertLog.run(
          agent.agent_id,
          'SHADOW',
          'ACTIVE',
          `Shadow考察通过: 胜率${(agent.win_rate * 100).toFixed(1)}%, 完成${shadowCompleted}笔shadow交易`,
          'SHADOW_COMPLETE',
        );
        resurrected.push(agent.agent_id);
      } else {
        // 淘汰
        changeStatus.run('TERMINATED', datetimeNow(), agent.agent_id);
        insertLog.run(
          agent.agent_id,
          'SHADOW',
          'TERMINATED',
          `Shadow考察未通过: 胜率${(agent.win_rate * 100).toFixed(1)}%, 完成${shadowCompleted}笔shadow交易`,
          'SHADOW_COMPLETE',
        );
        terminated.push(agent.agent_id);
      }
    }
  });

  txn();

  // 复活后触发末位淘汰（仅对复活者重新排名后执行）
  if (resurrected.length > 0) {
    rankAndEliminate();
  }

  return { resurrected, terminated };
}

/**
 * 末位淘汰：ACTIVE Agent 中排名最后的被 TERMINATED
 *
 * 排名范围：
 *   - status = 'ACTIVE'
 *   - total_trades >= 10（保护新手免于立即淘汰）
 *
 * 排名依据：win_rate ASC（最低者淘汰）
 * 同分情况下：total_trades ASC（交易更少者优先淘汰）
 *
 * @returns 被淘汰的 agent_id，若无符合条件者返回 null
 */
export function rankAndEliminate(): string | null {
  const db = getDb();

  const lastPlace = db.prepare(`
    SELECT agent_id, win_rate, total_trades
    FROM agents
    WHERE status = 'ACTIVE'
      AND total_trades >= 10
    ORDER BY
      win_rate      ASC,
      total_trades  ASC
    LIMIT 1
  `).get() as Pick<Agent, 'agent_id' | 'win_rate' | 'total_trades'> | undefined;

  if (!lastPlace) return null;

  const txn = runInTransaction(() => {
    db.prepare(`
      UPDATE agents
      SET status = 'TERMINATED', terminated_at = ?
      WHERE agent_id = ?
    `).run(datetimeNow(), lastPlace.agent_id);

    db.prepare(`
      INSERT INTO agent_status_log
        (agent_id, from_status, to_status, reason, triggered_by, changed_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(
      lastPlace.agent_id,
      'ACTIVE',
      'TERMINATED',
      `末位淘汰: 胜率${(lastPlace.win_rate * 100).toFixed(1)}% (${lastPlace.total_trades}笔)`,
      'RANKING_ELIMINATION',
    );
  });

  txn();
  return lastPlace.agent_id;
}

// ═══════════════════════════════════════════════════════════════════
//  内部辅助
// ═══════════════════════════════════════════════════════════════════

/** 统计某个 Agent 已完成（投票过）的 shadow 交易数量 */
function countShadowTrades(db: ReturnType<typeof getDb>, agentId: string): number {
  const row = db.prepare(`
    SELECT COUNT(DISTINCT trade_id) AS cnt
    FROM agent_votes
    WHERE agent_id = ?
      AND is_shadow = 1
  `).get(agentId) as { cnt: number } | undefined;

  return row?.cnt ?? 0;
}

/** 返回 ISO-8601 当前时间字符串，兼容 SQLite datetime('now') 格式 */
function datetimeNow(): string {
  return new Date().toISOString().replace('T', ' ').replace(/\..+/, '');
}
