#!/usr/bin/env node
/**
 * Turtle Trading Strategy Analyzer — CLI entry point
 *
 * Fetches kline data, runs Turtle analysis, outputs structured JSON.
 * Supports single-stock and batch modes.
 *
 * 用法:
 *   # 单只股票分析
 *   npx tsx src/scripts/turtle-analyze.ts --symbol NVDA.US
 *   npx tsx src/scripts/turtle-analyze.ts --symbol NVDA.US --days 120 --account 88000
 *
 *   # 批量分析
 *   npx tsx src/scripts/turtle-analyze.ts --batch NVDA.US,MSFT.US,AAPL.US
 *   npx tsx src/scripts/turtle-analyze.ts --batch NVDA.US,MSFT.US --account 88000
 *
 *   # 使用 data-service 获取数据 (推荐, 走 data-agent)
 *   npx tsx src/scripts/turtle-analyze.ts --symbol NVDA.US --via data-agent
 *
 * 输出: JSON(单只) 或 JSON Array(批量)
 */

import { execSync } from 'node:child_process';
import { analyzeTurtle, normalizeKlines, type TurtleAnalysisResult } from '../strategies/turtle.js';

// ===== CLI Args =====

interface Args {
  symbol: string;
  batchSymbols: string[];
  days: number;
  accountSize: number;
  via: 'direct' | 'data-agent';
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const get = (key: string): string => {
    const idx = args.indexOf(`--${key}`);
    return idx >= 0 ? (args[idx + 1] ?? '') : '';
  };

  const symbol = get('symbol');
  const batchRaw = get('batch');
  const batchSymbols = batchRaw
    ? batchRaw.split(',').map(s => s.trim()).filter(Boolean)
    : [];
  const days = parseInt(get('days') || '120', 10);
  const accountSize = parseFloat(get('account') || '0');
  const via = (get('via') || 'direct') as 'direct' | 'data-agent';

  return { symbol, batchSymbols, days, accountSize, via };
}

// ===== Data fetching =====

function fetchKlineDirect(symbol: string, days: number): any[] {
  try {
    const out = execSync(
      `longbridge kline history ${symbol} --period day --format json`,
      { timeout: 30_000, maxBuffer: 1024 * 1024 }
    ).toString().trim();

    if (!out) return [];

    // Handle progress-line output
    const lines = out.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('{') || line.startsWith('[')) {
        const parsed = JSON.parse(line);
        if (Array.isArray(parsed)) {
          return normalizeKlines(parsed.slice(-days));
        }
        if (parsed.error) {
          console.error(JSON.stringify({ error: parsed.error }));
          return [];
        }
      }
    }
    return [];
  } catch (e: any) {
    console.error(JSON.stringify({
      error: `Failed to fetch kline for ${symbol}`,
      detail: e.stderr?.toString()?.slice(0, 200) ?? e.message,
    }));
    return [];
  }
}

function fetchKlineViaDataAgent(symbol: string, days: number): any[] {
  try {
    const out = execSync(
      `npx tsx src/scripts/data-service.ts --type kline --symbol ${symbol} --days ${days}`,
      { timeout: 30_000 }
    ).toString().trim();

    if (!out) return [];

    const parsed = JSON.parse(out);
    if (parsed?.error) {
      console.error(JSON.stringify({ error: parsed.error }));
      return [];
    }

    // data-service wraps in { symbol, days, summary, klines: [...] }
    if (parsed.klines && Array.isArray(parsed.klines)) {
      return normalizeKlines(parsed.klines);
    }
    return [];
  } catch (e: any) {
    console.error(JSON.stringify({
      error: `Failed to fetch kline via data-agent for ${symbol}`,
      detail: e.stderr?.toString()?.slice(0, 200) ?? e.message,
    }));
    return [];
  }
}

function fetchKline(symbol: string, days: number, via: 'direct' | 'data-agent'): any[] {
  if (via === 'data-agent') {
    return fetchKlineViaDataAgent(symbol, days);
  }
  return fetchKlineDirect(symbol, days);
}

// ===== Main =====

function analyzeOne(symbol: string, days: number, accountSize: number, via: 'direct' | 'data-agent'): TurtleAnalysisResult {
  const klines = fetchKline(symbol, days, via);
  return analyzeTurtle({ symbol, klines, accountSize: accountSize > 0 ? accountSize : undefined });
}

function main(): void {
  const { symbol, batchSymbols, days, accountSize, via } = parseArgs();

  // Batch mode
  if (batchSymbols.length > 0) {
    const results = batchSymbols.map(sym => analyzeOne(sym, days, accountSize, via));
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  // Single mode
  if (!symbol) {
    console.error(JSON.stringify({
      error: '--symbol or --batch is required',
      usage: [
        'npx tsx src/scripts/turtle-analyze.ts --symbol NVDA.US',
        'npx tsx src/scripts/turtle-analyze.ts --symbol NVDA.US --days 120 --account 88000',
        'npx tsx src/scripts/turtle-analyze.ts --batch NVDA.US,MSFT.US',
        'npx tsx src/scripts/turtle-analyze.ts --symbol NVDA.US --via data-agent',
      ],
    }));
    process.exit(1);
  }

  const result = analyzeOne(symbol, days, accountSize, via);
  console.log(JSON.stringify(result, null, 2));
}

main();
