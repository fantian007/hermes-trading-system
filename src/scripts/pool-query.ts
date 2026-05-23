#!/usr/bin/env node
/**
 * 股池查询 CLI — Stock Pool Query CLI
 *
 * 数据部门工号 DAT-001 专用脚本。
 * 其他部门可通过此脚本获取标准化股池数据。
 *
 * 用法：
 *   npx tsx src/scripts/pool-query.ts                    # 完整查询（含实时行情）
 *   npx tsx src/scripts/pool-query.ts --skip-quotes       # 跳过行情查询（离线模式）
 *   npx tsx src/scripts/pool-query.ts --json              # JSON 输出（默认）
 *   npx tsx src/scripts/pool-query.ts --table             # 表格输出（可读）
 *   npx tsx src/scripts/pool-query.ts --symbol NVDA.US    # 查询特定股票
 *   npx tsx src/scripts/pool-query.ts --min-signals 3     # 过滤：至少 3 个信号
 *   npx tsx src/scripts/pool-query.ts --lb-timeout 5000   # 自定义长桥超时
 */

import { fetchStockPool, type FetchStockPoolOptions } from '../pool/query.js';
import type { StockPoolStock, StockPoolResult } from '../core/types.js';

// ============================================================================
// Argument parsing
// ============================================================================

function parseArgs(argv: string[]) {
  const opts: {
    skipQuotes: boolean;
    json: boolean;
    table: boolean;
    symbol: string | null;
    minSignals: number;
    lbTimeoutMs: number;
    help: boolean;
  } = {
    skipQuotes: false,
    json: false,
    table: false,
    symbol: null,
    minSignals: 0,
    lbTimeoutMs: 10_000,
    help: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--skip-quotes': opts.skipQuotes = true; break;
      case '--json':        opts.json = true; break;
      case '--table':       opts.table = true; break;
      case '--help':
      case '-h':            opts.help = true; break;
      case '--symbol':      opts.symbol = argv[++i] ?? ''; break;
      case '--min-signals': opts.minSignals = parseInt(argv[++i] ?? '0', 10); break;
      case '--lb-timeout':  opts.lbTimeoutMs = parseInt(argv[++i] ?? '10000', 10); break;
    }
  }

  return opts;
}

// ============================================================================
// Output formatters
// ============================================================================

function formatJson(result: StockPoolResult): string {
  return JSON.stringify(result, null, 2);
}

function formatTable(result: StockPoolResult): string {
  if (result.pool_size === 0) {
    return '📭 当前股池为空';
  }

  const lines: string[] = [
    `📊 股池快照 — ${result.generated_at}`,
    `   总信号数: ${result.pool_size}  |  独立股票: ${result.unique_symbols.length}`,
    '',
  ];

  // 表头
  lines.push('  SYMBOL        NAME                SIG  🟢BULL  🔴BEAR  强度  ├── 行情');
  lines.push('  ────────────  ──────────────────  ───  ──────  ──────  ────  ──────────');

  for (const stock of result.stocks) {
    const name = (stock.name ?? '-').padEnd(18).slice(0, 18);
    const sym = stock.symbol.padEnd(12);
    const sig = String(stock.signal_count).padStart(3);
    const bull = String(stock.aggregate.bullish_signals).padStart(6);
    const bear = String(stock.aggregate.bearish_signals).padStart(6);
    const avg = String(stock.aggregate.avg_strength).padStart(4);

    let quoteStr = '-';
    if (stock.quote) {
      const changeSign = stock.quote.change_pct >= 0 ? '+' : '';
      quoteStr = `${stock.quote.last.toFixed(2)} ${changeSign}${stock.quote.change_pct.toFixed(2)}%`;
    }

    lines.push(`  ${sym}  ${name}  ${sig}  ${bull}  ${bear}  ${avg}  ├── ${quoteStr}`);
  }

  return lines.join('\n');
}

function formatBrief(result: StockPoolResult): string {
  // 简洁模式：只输出股票列表
  if (result.pool_size === 0) {
    return 'POOL_EMPTY';
  }

  const lines: string[] = [];
  for (const stock of result.stocks) {
    const name = stock.name ?? '';
    const quote = stock.quote
      ? ` @ ${stock.quote.last.toFixed(2)} (${stock.quote.change_pct >= 0 ? '+' : ''}${stock.quote.change_pct.toFixed(2)}%)`
      : '';
    lines.push(`${stock.symbol}\t${name}\t${stock.signal_count}信号\t强度${stock.aggregate.avg_strength}${quote}`);
  }
  return lines.join('\n');
}

// ============================================================================
// Main
// ============================================================================

function main() {
  const opts = parseArgs(process.argv);

  if (opts.help) {
    console.log(`
股池查询 CLI — Stock Pool Query

用法:
  npx tsx src/scripts/pool-query.ts [选项]

选项:
  --skip-quotes       跳过长桥实时行情查询（离线/长桥不可用时）
  --json              JSON 格式输出（默认）
  --table             表格格式输出（可读）
  --brief             简洁文本输出
  --symbol <SYM>      只查询特定股票（如 NVDA.US）
  --min-signals <N>   过滤：至少 N 个信号的股票（默认 0）
  --lb-timeout <MS>   长桥 CLI 超时毫秒（默认 10000）

示例:
  npx tsx src/scripts/pool-query.ts
  npx tsx src/scripts/pool-query.ts --table
  npx tsx src/scripts/pool-query.ts --skip-quotes --brief
  npx tsx src/scripts/pool-query.ts --symbol AAPL.US
  npx tsx src/scripts/pool-query.ts --min-signals 3 --table
`);
    process.exit(0);
  }

  const fetchOpts: FetchStockPoolOptions = {
    skipQuotes: opts.skipQuotes,
    lbTimeoutMs: opts.lbTimeoutMs,
  };

  console.error('🔍 正在查询股池...');
  const result = fetchStockPool(fetchOpts);
  console.error('✅ 查询完成');

  // 过滤
  let stocks = result.stocks;
  if (opts.symbol) {
    stocks = stocks.filter(s => s.symbol === opts.symbol);
  }
  if (opts.minSignals > 0) {
    stocks = stocks.filter(s => s.signal_count >= opts.minSignals);
  }

  const filtered: StockPoolResult = {
    ...result,
    stocks,
    unique_symbols: stocks.map(s => s.symbol).sort(),
    pool_size: stocks.reduce((sum, s) => sum + s.signal_count, 0),
  };

  // 输出
  if (opts.table) {
    console.log(formatTable(filtered));
  } else if (opts.json || (!opts.json && !opts.table)) {
    console.log(formatJson(filtered));
  } else {
    console.log(formatBrief(filtered));
  }
}

main();
