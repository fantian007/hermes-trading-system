/**
 * 舆情部门 — 查看当前股池
 *
 * 职责（仅此一项）：
 *   输出当前 stock_pool 中所有 ACTIVE 状态的股票。
 *   不做任何业务判断。
 *
 * 用法：
 *   npx tsx src/scripts/sentiment-pool.ts --list
 *   npx tsx src/scripts/sentiment-pool.ts --list --limit 5
 */

import { getDb } from '../core/db.js';

interface Args {
  limit: number;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--limit');
  return {
    limit: idx >= 0 ? parseInt(args[idx + 1] || '50', 10) : 50,
  };
}

function main() {
  const { limit } = parseArgs();

  const rows = getDb().prepare(`
    SELECT symbol, signal_type, strength, source, reason, added_at
    FROM stock_pool
    WHERE status = 'ACTIVE'
    ORDER BY added_at DESC
    LIMIT ?
  `).all(limit) as any[];

  console.log(JSON.stringify({
    status: 'ok',
    total: rows.length,
    stocks: rows.map(r => ({
      symbol: r.symbol,
      signal_type: r.signal_type,
      strength: r.strength,
      source: r.source,
      reason: r.reason,
      added_at: r.added_at,
    })),
  }));
}

main();
