/**
 * 盯盘触发投票脚本 — 最小数据提供者
 *
 * 职责：
 *   - 读取候选股池
 *   - 检查冷却期
 *   - **预风控检查：判断市场是否开市（非周末、非节假日）**
 *   - 创建选举轮次
 *   - 输出 JSON 上下文（Agent 据此做自然语言决策）
 *
 * 用法：
 *   npx tsx src/scripts/trigger-vote.ts
 *
 * 注意：不拉行情，不检测信号，不做业务判断。
 *       Agent 通过自然语言读取输出 JSON 来决定是否投票。
 */

import { getActivePool } from '../pool/stock-pool.js';
import { createElectionRound } from '../voting/orchestrator.js';
import { getDb } from '../core/db.js';
import { config } from '../core/config.js';

// ===== 预风控：市场开市检查 =====

/** US 股市主要节假日（2026 年） */
const US_HOLIDAYS_2026 = new Set([
  '2026-01-01', // New Year's Day
  '2026-01-19', // Martin Luther King Jr. Day
  '2026-02-16', // Presidents' Day
  '2026-04-18', // Good Friday
  '2026-05-25', // Memorial Day
  '2026-06-19', // Juneteenth
  '2026-07-03', // Independence Day (observed)
  '2026-09-07', // Labor Day
  '2026-11-26', // Thanksgiving Day
  '2026-12-25', // Christmas Day
]);

/** US 股市交易时段（ET = UTC-5, EDT = UTC-4）
 *  常规时段：周一~周五 09:30~16:00 ET
 *  盘前：04:00~09:30 ET
 *  盘后：16:00~20:00 ET
 *  这里仅限制非节假日 + 周一~周五，不限制具体小时（允许盘前/盘后操作）。 */
function isMarketOpen(): boolean {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();

  // 周六(6) / 周日(0) → 休市
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }

  // 节假日检查（用 ET 日期）
  const etHour = now.getUTCHours() - (now.getUTCMonth() >= 2 && now.getUTCMonth() <= 10 ? 4 : 5);
  const etDate = new Date(now);
  etDate.setUTCHours(etHour);
  const dateStr = etDate.toISOString().slice(0, 10);

  if (US_HOLIDAYS_2026.has(dateStr)) {
    return false;
  }

  return true;
}

async function main() {
  // ===== 预风控检查 =====
  if (!isMarketOpen()) {
    const now = new Date();
    const dayName = ['日', '一', '二', '三', '四', '五', '六'][now.getUTCDay()];
    const reason = dayName === '六' || dayName === '日'
      ? `今天周${dayName}，市场休市`
      : `今天是 US 节假日`;
    console.log(JSON.stringify({
      type: 'pre_risk_block',
      status: 'skipped',
      reason,
      date: now.toISOString().slice(0, 10),
    }));
    return;
  }

  const pool = getActivePool();
  console.log(JSON.stringify({ pool_size: pool.length }));

  for (const item of pool) {
    // 冷却检查：30 分钟内是否已对该票发起过投票
    const recent = getDb().prepare(`
      SELECT round_id FROM election_rounds
      WHERE symbol = ?
        AND created_at > datetime('now', ?)
      ORDER BY created_at DESC LIMIT 1
    `).get(item.symbol, `-${Math.ceil(config.voteCooldownSec / 60)} minutes`) as { round_id: string } | undefined;

    if (recent) continue;

    const voteNode = item.signal_type === 'BULLISH' ? 'BUY' : 'SELL';
    const roundId = createElectionRound(item.symbol, 'PRICE_BREAKOUT', item.reason, 0, voteNode);

    const output = {
      type: 'vote_trigger',
      symbol: item.symbol,
      round_id: roundId,
      signal_type: item.signal_type,
      strength: item.strength,
      reason: item.reason,
      source: item.source,
      agent_id: item.agent_id,
      vote_node: voteNode,
    };
    console.log(JSON.stringify(output));
  }

  console.log(JSON.stringify({ status: 'complete' }));
}

main().catch(console.error);
