/**
 * Win Rate Statistics — 胜率统计模块
 *
 * 扫描 win_reports 表，更新 agents 表中的统计字段。
 * 提供 Agent 排行榜查询和个体详细统计。
 */

import { getDb } from '../core/db.js';
import type { Agent } from '../core/types.js';

/**
 * 更新所有 Agent 的胜率统计数据
 *
 * 扫描 win_reports 表，按 agent_id 聚合计算：
 *   - win_count:    WIN 结果的数量
 *   - total_trades: 所有已上报结果的数量
 *   - win_rate:     win_count / total_trades（无记录则为 0）
 *   - win_rate_recent_5: 最近 5 笔中 WIN 的占比
 *
 * 使用单条 SQL CTE + window function 完成计算，
 * 最后批量 UPDATE agents 表。无 win_reports 的 agent 重置为 0。
 */
export function updateAgentStats(): void {
  const db = getDb();

  // 带 window function 的聚合：每个 agent 取最近 5 条的 WIN 数
  const sql = `
    WITH ranked AS (
      SELECT
        agent_id,
        result,
        ROW_NUMBER() OVER (
          PARTITION BY agent_id
          ORDER BY self_reported_at DESC
        ) AS rn
      FROM win_reports
    ),
    aggregated AS (
      SELECT
        agent_id,
        COUNT(*)                          AS total_trades,
        SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END) AS win_count,
        SUM(CASE WHEN result = 'WIN' AND rn <= 5 THEN 1 ELSE 0 END) AS recent_wins,
        COUNT(CASE WHEN rn <= 5 THEN 1 END) AS recent_total
      FROM ranked
      GROUP BY agent_id
    )
    UPDATE agents SET
      win_count         = COALESCE((SELECT a.win_count   FROM aggregated a WHERE a.agent_id = agents.agent_id), 0),
      total_trades      = COALESCE((SELECT a.total_trades FROM aggregated a WHERE a.agent_id = agents.agent_id), 0),
      win_rate          = CASE
        WHEN (SELECT a.total_trades FROM aggregated a WHERE a.agent_id = agents.agent_id) > 0
        THEN CAST((SELECT a.win_count FROM aggregated a WHERE a.agent_id = agents.agent_id) AS REAL)
             / (SELECT a.total_trades FROM aggregated a WHERE a.agent_id = agents.agent_id)
        ELSE 0.0
      END,
      win_rate_recent_5 = CASE
        WHEN (SELECT a.recent_total FROM aggregated a WHERE a.agent_id = agents.agent_id) > 0
        THEN CAST((SELECT a.recent_wins FROM aggregated a WHERE a.agent_id = agents.agent_id) AS REAL)
             / (SELECT a.recent_total FROM aggregated a WHERE a.agent_id = agents.agent_id)
        ELSE 0.0
      END
  `;

  db.exec(sql);
}

/**
 * 获取 Agent 排行榜
 *
 * 排序规则（降序优先）：
 *   1. win_rate        DESC
 *   2. total_trades    DESC
 *   3. win_rate_recent_5 DESC
 *
 * 返回完整 Agent 对象数组。
 */
export function getAgentRankings(): Agent[] {
  const db = getDb();

  const stmt = db.prepare(`
    SELECT
      agent_id, agent_name, profile_name, strategy_source, strategy_summary,
      indicators, status, win_count, total_trades, win_rate, win_rate_recent_5,
      joined_at, terminated_at, last_vote_at, created_by
    FROM agents
    ORDER BY
      win_rate        DESC,
      total_trades    DESC,
      win_rate_recent_5 DESC
  `);

  return stmt.all() as Agent[];
}

/**
 * 获取单个 Agent 的详细统计数据
 *
 * 返回 Agent 基础信息 + 额外统计维度，包括：
 *   - 胜率趋势（最近 5/10/20 笔）
 *   - 最近一笔结果
 *   - 当前状态
 */
export function getAgentStats(agentId: string): AgentStats | null {
  const db = getDb();

  const agent = db.prepare(`
    SELECT * FROM agents WHERE agent_id = ?
  `).get(agentId) as Agent | undefined;

  if (!agent) return null;

  // 各窗口胜率
  const windows = computeWinRateWindows(db, agentId);

  // 最近一笔结果
  const lastReport = db.prepare(`
    SELECT result, trade_id, self_reported_at
    FROM win_reports
    WHERE agent_id = ?
    ORDER BY self_reported_at DESC
    LIMIT 1
  `).get(agentId) as { result: string; trade_id: string; self_reported_at: string } | undefined;

  // shadow 交易计数
  const shadowCount = db.prepare(`
    SELECT COUNT(DISTINCT trade_id) AS cnt
    FROM agent_votes
    WHERE agent_id = ? AND is_shadow = 1
  `).get(agentId) as { cnt: number };

  return {
    agent,
    winRateRecent5:  windows.recent5,
    winRateRecent10: windows.recent10,
    winRateRecent20: windows.recent20,
    lastTradeResult: lastReport?.result ?? null,
    lastTradeId:     lastReport?.trade_id ?? null,
    shadowTradesCompleted: shadowCount.cnt,
  };
}

// ----- 内部辅助 -----

export interface AgentStats {
  agent: Agent;
  winRateRecent5: number;
  winRateRecent10: number;
  winRateRecent20: number;
  lastTradeResult: string | null;
  lastTradeId: string | null;
  shadowTradesCompleted: number;
}

function computeWinRateWindows(
  db: ReturnType<typeof getDb>,
  agentId: string,
): { recent5: number; recent10: number; recent20: number } {
  const reports = db.prepare(`
    SELECT result
    FROM win_reports
    WHERE agent_id = ?
    ORDER BY self_reported_at DESC
  `).all(agentId) as { result: string }[];

  const calc = (limit: number): number => {
    const slice = reports.slice(0, limit);
    if (slice.length === 0) return 0;
    const wins = slice.filter(r => r.result === 'WIN').length;
    return wins / slice.length;
  };

  return {
    recent5:  calc(5),
    recent10: calc(10),
    recent20: calc(20),
  };
}
