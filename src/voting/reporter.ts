/**
 * 胜负上报模块 — Win/Loss Reporter
 *
 * 核心职责：
 *   1. reportWin — 智能体在交易结束后自报胜负结果
 *   2. processSelfReflection — 处理智能体的自我反思，更新 agent_traits
 *   3. checkMissingReports — 扫描遗漏上报的智能体，自动插入 MISS 记录
 *
 * 上报流程：
 *   交易关闭 → 通知所有投票智能体 → 智能体调用 reportWin →
 *   审计器定时调用 checkMissingReports 查漏补缺
 */

import { getDb, prepare, runInTransaction } from '../core/db.js';
import type { WinReportRequest } from '../core/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 生成上报记录 ID，格式：RPT-{tradeId}-{agentId} */
function generateReportId(tradeId: string, agentId: string): string {
  return `RPT-${tradeId}-${agentId}`;
}

// ---------------------------------------------------------------------------
// reportWin
// ---------------------------------------------------------------------------

/**
 * 智能体自报一笔交易的胜负结果
 *
 * 写入 win_reports 表，同时触发自我反思处理（如果有）。
 * 使用 INSERT OR REPLACE 以支持重复上报（幂等覆盖）。
 *
 * @param report - 上报请求体
 *   - agent_id:          智能体工号
 *   - trade_id:          关联交易 ID
 *   - result:            胜负结果（WIN / LOSE / MISS）
 *   - buy_vote_match:    买入方向投票是否与实际一致
 *   - sell_vote_match:   卖出方向投票是否与实际一致
 *   - self_reflection:   可选的自我反思数据
 */
export function reportWin(report: WinReportRequest): void {
  const db = getDb();
  const reportId = generateReportId(report.trade_id, report.agent_id);
  const now = new Date().toISOString();

  // 安全序列化 self_reflection
  const reflectionJson = report.self_reflection
    ? JSON.stringify(report.self_reflection)
    : null;

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO win_reports
      (report_id, trade_id, agent_id, result,
       buy_vote_match, sell_vote_match,
       self_reported_at, auditor_verified_at, self_reflection)
    VALUES
      (@report_id, @trade_id, @agent_id, @result,
       @buy_vote_match, @sell_vote_match,
       @self_reported_at, NULL, @self_reflection)
  `);

  stmt.run({
    report_id: reportId,
    trade_id: report.trade_id,
    agent_id: report.agent_id,
    result: report.result,
    buy_vote_match: report.buy_vote_match ? 1 : 0,
    sell_vote_match: report.sell_vote_match ? 1 : 0,
    self_reported_at: now,
    self_reflection: reflectionJson,
  });

  // 如果有自我反思数据，自动处理
  if (report.self_reflection) {
    processSelfReflection(report.agent_id, report.self_reflection);
  }
}

// ---------------------------------------------------------------------------
// processSelfReflection
// ---------------------------------------------------------------------------

/**
 * 处理智能体的自我反思，写入 agent_traits 表
 *
 * 自我反思数据来自 WinReportRequest.self_reflection.trait_updates，
 * 每一项包含 { key, value, confidence }，对应 trait_key / trait_value / confidence。
 * trait_type 固定为 'PATTERN'（策略行为模式）。
 *
 * 使用 INSERT OR REPLACE（基于 UNIQUE(agent_id, trait_key) 约束），
 * 每次覆盖最新反思值，confidence 和 sample_count 累加。
 *
 * 如果 self_reflection 包含 note 字段，也作为一条 PATTERN trait 记录。
 *
 * @param agentId    - 智能体工号
 * @param reflection - 自我反思对象
 */
export function processSelfReflection(
  agentId: string,
  reflection: NonNullable<WinReportRequest['self_reflection']>,
): void {
  const db = getDb();
  const now = new Date().toISOString();

  // 读取已有 trait 以累加 sample_count
  const readStmt = db.prepare(
    'SELECT sample_count, confidence FROM agent_traits WHERE agent_id = ? AND trait_key = ?',
  );

  const upsertStmt = db.prepare(`
    INSERT OR REPLACE INTO agent_traits
      (agent_id, trait_key, trait_value, trait_type, confidence, last_updated, sample_count)
    VALUES
      (@agent_id, @trait_key, @trait_value, 'PATTERN', @confidence, @last_updated, @sample_count)
  `);

  const runAll = runInTransaction(() => {
    // 处理 trait_updates 数组
    const updates = reflection.trait_updates ?? [];

    for (const update of updates) {
      // 查询已有记录以累加样本数
      const existing = readStmt.get(agentId, update.key) as
        | { sample_count: number; confidence: number }
        | undefined;

      const newSampleCount = (existing?.sample_count ?? 0) + 1;
      // 新置信度取移动平均（新旧各半权重）
      const newConfidence = existing
        ? (existing.confidence * 0.5 + update.confidence * 0.5)
        : update.confidence;

      upsertStmt.run({
        agent_id: agentId,
        trait_key: update.key,
        trait_value: update.value,
        confidence: Math.min(1.0, Math.max(0.0, newConfidence)),
        last_updated: now,
        sample_count: newSampleCount,
      });
    }

    // 如果有 note，作为单独 trait 记录
    if (reflection.note && reflection.note.trim().length > 0) {
      const existing = readStmt.get(agentId, 'reflection_note') as
        | { sample_count: number; confidence: number }
        | undefined;

      const newSampleCount = (existing?.sample_count ?? 0) + 1;
      upsertStmt.run({
        agent_id: agentId,
        trait_key: 'reflection_note',
        trait_value: reflection.note.slice(0, 500), // 截断防止过长
        confidence: 1.0,
        last_updated: now,
        sample_count: newSampleCount,
      });
    }
  });

  runAll();
}

// ---------------------------------------------------------------------------
// checkMissingReports
// ---------------------------------------------------------------------------

/**
 * 检查遗漏上报的智能体，自动插入 MISS 记录
 *
 * 场景：交易结束后，部分智能体未在规定时间内调用 reportWin。
 * 审计器调用此函数，对 agentIds 中未在 win_reports 表出现的智能体，
 * 自动插入 result='MISS' 的记录。
 *
 * MISS 意味着该智能体未主动上报，按"失败"处理以保持数据完整。
 *
 * @param tradeId  - 交易 ID
 * @param agentIds - 应上报的所有智能体工号列表
 * @returns 新插入 MISS 记录的数量
 */
export function checkMissingReports(
  tradeId: string,
  agentIds: string[],
): number {
  const db = getDb();
  const now = new Date().toISOString();

  // 查询已上报的智能体
  const reportedStmt = db.prepare(
    'SELECT agent_id FROM win_reports WHERE trade_id = ?',
  );
  const reportedRows = reportedStmt.all(tradeId) as { agent_id: string }[];
  const reportedSet = new Set(reportedRows.map((r) => r.agent_id));

  // 找出遗漏的智能体
  const missingIds = agentIds.filter((id) => !reportedSet.has(id));

  if (missingIds.length === 0) return 0;

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO win_reports
      (report_id, trade_id, agent_id, result,
       buy_vote_match, sell_vote_match,
       self_reported_at, auditor_verified_at, self_reflection)
    VALUES
      (@report_id, @trade_id, @agent_id, 'MISS',
       0, 0,
       @self_reported_at, @auditor_verified_at, NULL)
  `);

  const runAll = runInTransaction(() => {
    for (const agentId of missingIds) {
      insertStmt.run({
        report_id: generateReportId(tradeId, agentId),
        trade_id: tradeId,
        agent_id: agentId,
        self_reported_at: now,
        auditor_verified_at: now, // 审计器自动标记为已验证
      });
    }
  });

  runAll();

  return missingIds.length;
}
