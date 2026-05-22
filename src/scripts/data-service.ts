#!/usr/bin/env node
/**
 * 数据部门 — 统一行情数据服务
 *
 * 所有行情数据请求都通过此脚本。
 * 数据 Agent 运行此脚本 → 返回 JSON → Agent 读取并回复请求方。
 *
 * 用法：
 *   npx tsx src/scripts/data-service.ts --type quote --symbol NVDA.US
 *   npx tsx src/scripts/data-service.ts --type kline --symbol AAPL.US --days 30
 *   npx tsx src/scripts/data-service.ts --type account
 *   npx tsx src/scripts/data-service.ts --type watchlist
 *   npx tsx src/scripts/data-service.ts --type positions
 */

import { execSync } from 'node:child_process';

// ===== Longbridge CLI helper =====

function lb(args: string): any {
  try {
    const out = execSync(`longbridge ${args} --format json`, {
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    }).toString().trim();
    if (!out) return [];
    // Handle multi-line output where first line might be progress text
    const lines = out.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('{') || line.startsWith('[')) {
        return JSON.parse(line);
      }
    }
    return [];
  } catch (e: any) {
    return { error: e.stderr?.toString()?.slice(0, 300) ?? e.message };
  }
}

// ===== Data fetching functions =====

function fetchQuote(symbol: string): any {
  const result = lb(`quote ${symbol}`);
  if (Array.isArray(result) && result.length > 0) {
    return result[0];
  }
  if (result && !Array.isArray(result) && result.last) {
    return result;
  }
  return { error: `No quote data for ${symbol}` };
}

function fetchKline(symbol: string, days: number): any {
  // CLI: longbridge kline history <SYMBOL> [--start <DATE>] [--end <DATE>] [--period <day|week|month>]
  // No --count flag, so just fetch and slice
  const result = lb(`kline history ${symbol} --period day`);
  if (result && result.error) return result;
  if (!Array.isArray(result) || result.length === 0) {
    return { error: `No kline data for ${symbol}` };
  }

  // Return only the requested number of days
  const klines = result.slice(-days);

  // Compute summary statistics
  const closes = klines.map((k: any) => parseFloat(k.close || '0'));
  const high = Math.max(...klines.map((k: any) => parseFloat(k.high || '0')));
  const low = Math.min(...klines.map((k: any) => parseFloat(k.low || '0')));
  const volume = klines.reduce((s: number, k: any) => s + (parseFloat(k.volume || '0')), 0);
  const avgVolume = volume / klines.length;
  const latest = klines[klines.length - 1];
  const first = klines[0];
  const changePct = parseFloat(first.close || '0') > 0
    ? ((parseFloat(latest.close || '0') - parseFloat(first.close || '0')) / parseFloat(first.close || '0')) * 100
    : 0;

  // Simple MA calculations
  function ma(period: number): number {
    if (klines.length < period) return 0;
    return closes.slice(-period).reduce((s: number, c: number) => s + c, 0) / period;
  }

  return {
    symbol,
    days,
    summary: {
      latest_close: latest.close,
      high,
      low,
      open: first.open,
      close: latest.close,
      change_pct: parseFloat(changePct.toFixed(2)),
      volume,
      avg_volume: parseFloat(avgVolume.toFixed(0)),
      ma5: parseFloat(ma(5).toFixed(2)),
      ma10: parseFloat(ma(10).toFixed(2)),
      ma20: parseFloat(ma(20).toFixed(2)),
      ma50: parseFloat(ma(50).toFixed(2)),
      latest_date: latest.time || latest.date || 'unknown',
    },
    klines: klines.map((k: any) => ({
      date: k.time || k.timestamp || k.date || 'unknown',
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
      volume: k.volume,
    })),
  };
}

function fetchNews(symbol: string): any {
  // 长桥 news API 当前在模拟盘中无权限（403308）
  // 后续开通后这里直接调用 longbridge news <SYMBOL> --format json
  // 目前返回占位信息供 Agent 参考
  return {
    symbol,
    note: 'news API not available in sim account — Agent can use sentiment-scan.ts or manual analysis instead',
    available: false,
  };
}

function fetchAccount(): any {
  const result = lb('account');
  if (result && result.error) return result;
  return result;
}

function fetchWatchlist(): any {
  // Use a default watchlist
  const symbols = ['NVDA.US', 'AAPL.US', 'TSLA.US', 'MSFT.US', 'GOOGL.US', 'AMZN.US', 'META.US'];
  const quotes = lb(`quote ${symbols.join(' ')}`);
  if (!Array.isArray(quotes)) {
    return { error: 'Failed to fetch watchlist quotes', raw: quotes };
  }
  return quotes.map((q: any) => ({
    symbol: q.symbol,
    last: q.last,
    change: q.change,
    change_percentage: q.change_percentage,
    volume: q.volume,
    open: q.open,
    high: q.high,
    low: q.low,
    prev_close: q.prev_close,
  }));
}

function fetchPositions(): any {
  const result = lb('positions');
  if (result && result.error) return result;
  const posList = Array.isArray(result)
    ? result
    : (result?.channels?.[0]?.positions || []);
  return posList.map((p: any) => ({
    symbol: p.symbol,
    quantity: p.quantity,
    available_quantity: p.available_quantity,
    cost_price: p.cost_price,
    market_price: p.market_price,
    current_price: p.current_price,
    pnl: p.pnl,
    pnl_percentage: p.pnl_percentage,
  }));
}

// ===== Main =====

function printHelp(): void {
  const help = `
数据部门 — 统一行情数据服务

用法:
  npx tsx src/scripts/data-service.ts --type quote    --symbol <SYM>
  npx tsx src/scripts/data-service.ts --type kline    --symbol <SYM> [--days 50]
  npx tsx src/scripts/data-service.ts --type account
  npx tsx src/scripts/data-service.ts --type watchlist
  npx tsx src/scripts/data-service.ts --type positions

参数:
  --type     数据类型: quote | kline | account | watchlist | positions
  --symbol   股票代码 (如 NVDA.US)
  --days     K线天数 (默认 50, 仅用于 kline 类型)

示例:
  npx tsx src/scripts/data-service.ts --type quote --symbol NVDA.US
  npx tsx src/scripts/data-service.ts --type kline --symbol AAPL.US --days 30
  npx tsx src/scripts/data-service.ts --type account
  npx tsx src/scripts/data-service.ts --type watchlist
`.trim();
  console.log(help);
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const get = (key: string): string => {
    const idx = args.indexOf(`--${key}`);
    return idx >= 0 ? args[idx + 1] || '' : '';
  };

  const type = get('type') || 'help';
  const symbol = get('symbol');
  const daysStr = get('days');
  const days = daysStr ? parseInt(daysStr, 10) : 50;

  let result: any;

  switch (type) {
    case 'quote':
      if (!symbol) {
        console.log(JSON.stringify({ error: '--symbol is required for quote type' }));
        process.exit(1);
      }
      result = fetchQuote(symbol);
      break;

    case 'kline':
      if (!symbol) {
        console.log(JSON.stringify({ error: '--symbol is required for kline type' }));
        process.exit(1);
      }
      result = fetchKline(symbol, days);
      break;

    case 'account':
      result = fetchAccount();
      break;

    case 'watchlist':
      result = fetchWatchlist();
      break;

    case 'positions':
      result = fetchPositions();
      break;

    case 'news':
      if (!symbol) {
        console.log(JSON.stringify({ error: '--symbol is required for news type' }));
        process.exit(1);
      }
      result = fetchNews(symbol);
      break;

    default:
      printHelp();
      process.exit(1);
  }

  console.log(JSON.stringify(result, null, 2));
}

main();
