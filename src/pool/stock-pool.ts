/**
 * 候选股池管理 — Stock Pool CRUD
 *
 * 核心职责：
 *   1. addSignal     — 智能体发现交易机会后，向股池添加信号
 *   2. removeSignal  — 手动移除某只股票的信号
 *   3. getActivePool — 获取当前所有 ACTIVE 状态的候选股
 *   4. expireOldSignals — 清理超时的旧信号（标记为 EXPIRED）
 *
 * 股池表 stock_pool 的主键为 (symbol, agent_id, added_at)，
 * 意味着同一智能体可对同一股票在不同时间多次添加信号（叠加效应）。
 */

import { getDb, prepare } from '../core/db.js';
import type { StockSignal, StockPoolItem } from '../core/types.js';

// ---------------------------------------------------------------------------
// addSignal
// ---------------------------------------------------------------------------

/**
 * 向股池添加一个交易信号
 *
 * 插入 stock_pool 表，状态默认为 ACTIVE。
 * 如果同一 (symbol, agent_id, added_at) 已存在（理论上不会，因为 added_at 包含毫秒），
 * 使用 INSERT OR IGNORE 防止重复。
 *
 * @param signal - 交易信号对象
 *   - symbol:      股票代码（如 "AAPL.US"）
 *   - signal_type: 信号方向（BULLISH / BEARISH）
 *   - strength:    信号强度（1-5）
 *   - source:      信号来源
 *   - reason:      信号理由
 *   - source_url:  可选的来源 URL
 *   - agent_id:    发现信号的智能体工号
 */
export function addSignal(signal: StockSignal): void {
  const now = new Date().toISOString();

  const stmt = prepare(`
    INSERT OR IGNORE INTO stock_pool
      (symbol, signal_type, strength, source, reason, source_url,
       agent_id, status, added_at, removed_at)
    VALUES
      (@symbol, @signal_type, @strength, @source, @reason, @source_url,
       @agent_id, 'ACTIVE', @added_at, NULL)
  `);

  stmt.run({
    symbol: signal.symbol,
    signal_type: signal.signal_type,
    strength: signal.strength,
    source: signal.source,
    reason: signal.reason,
    source_url: signal.source_url ?? null,
    agent_id: signal.agent_id,
    added_at: now,
  });
}

// ---------------------------------------------------------------------------
// removeSignal
// ---------------------------------------------------------------------------

/**
 * 从股池中移除某智能体对某只股票的信号
 *
 * 将所有匹配 (symbol, agent_id) 且状态为 ACTIVE 的记录标记为 REMOVED，
 * 同时记录 removed_at 时间戳。
 *
 * @param symbol  - 股票代码
 * @param agentId - 智能体工号
 * @returns 受影响的行数（实际更新的记录数）
 */
export function removeSignal(symbol: string, agentId: string): number {
  const now = new Date().toISOString();

  const stmt = prepare(`
    UPDATE stock_pool
    SET status = 'REMOVED', removed_at = @removed_at
    WHERE symbol = @symbol
      AND agent_id = @agent_id
      AND status = 'ACTIVE'
  `);

  const result = stmt.run({
    symbol,
    agent_id: agentId,
    removed_at: now,
  });

  return Number(result.changes);
}

// ---------------------------------------------------------------------------
// getActivePool
// ---------------------------------------------------------------------------

/**
 * 获取当前所有 ACTIVE 状态的候选股
 *
 * 按添加时间降序排列，最新信号优先。
 * 返回的 StockPoolItem 数组供上游选举编排器使用（填充 VoteRequest.signals）。
 *
 * @returns StockPoolItem 数组
 */
export function getActivePool(): StockPoolItem[] {
  const stmt = prepare(`
    SELECT
      symbol,
      signal_type,
      strength,
      source,
      reason,
      source_url,
      agent_id,
      status,
      added_at,
      removed_at
    FROM stock_pool
    WHERE status = 'ACTIVE'
    ORDER BY added_at DESC
  `);

  return stmt.all() as unknown as StockPoolItem[];
}

// ---------------------------------------------------------------------------
// expireOldSignals
// ---------------------------------------------------------------------------

/**
 * 将超时的旧信号标记为 EXPIRED
 *
 * 扫描 stock_pool 中状态为 ACTIVE 且 added_at 早于 cutoff 的记录，
 * 批量标记为 EXPIRED 并记录 removed_at。
 *
 * 应通过定时任务周期性调用（如每 5 分钟一次），
 * 配合 config.scanIntervalSec 使用。
 *
 * @param maxAgeMinutes - 信号最大存活时间（分钟）
 * @returns 被标记为 EXPIRED 的记录数
 */
export function expireOldSignals(maxAgeMinutes: number): number {
  // SQLite datetime 函数：计算截止时间
  const stmt = prepare(`
    UPDATE stock_pool
    SET
      status = 'EXPIRED',
      removed_at = datetime('now')
    WHERE status = 'ACTIVE'
      AND added_at < datetime('now', @cutoff)
  `);

  const cutoff = `-${maxAgeMinutes} minutes`;

  const result = stmt.run({ cutoff });
  return Number(result.changes);
}
