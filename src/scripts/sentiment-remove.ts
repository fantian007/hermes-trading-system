/**
 * 舆情部门 — 从股池移除信号
 *
 * 职责（仅此一项）：
 *   将指定股票的所有 ACTIVE 信号标记为 REMOVED。
 *   不做任何业务判断——Agent 自己决定踢什么、为什么踢。
 *
 * 用法：
 *   npx tsx src/scripts/sentiment-remove.ts --symbol NVDA.US --reason "利空消息：出口限制加严"
 */

import { getDb } from '../core/db.js';

interface Args {
  symbol: string;
  reason: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--symbol');
  const ridx = args.indexOf('--reason');
  return {
    symbol: idx >= 0 ? args[idx + 1] : '',
    reason: ridx >= 0 ? args[ridx + 1] : '',
  };
}

function main() {
  const { symbol, reason } = parseArgs();

  if (!symbol) {
    console.error('Usage: sentiment-remove.ts --symbol <SYM> [--reason <REASON>]');
    process.exit(1);
  }

  const now = new Date().toISOString();

  // Remove all ACTIVE signals for this symbol from agent SENT-001
  const stmt = getDb().prepare(`
    UPDATE stock_pool
    SET status = 'REMOVED', removed_at = ?
    WHERE symbol = ?
      AND status = 'ACTIVE'
  `);
  const result = stmt.run(now, symbol);

  console.log(JSON.stringify({
    status: 'removed',
    symbol,
    reason: reason || '',
    affected_rows: result.changes,
  }));
}

main();
