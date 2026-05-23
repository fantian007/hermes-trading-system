#!/usr/bin/env node
/**
 * Advertising Notification Generator — CLI entry point
 *
 * 广告部门 ADV-001 的 CLI 接口。接收海龟分析 JSON，渲染模板，发送到飞书。
 *
 * 用法:
 *   # 从 stdin 读取 JSON（单只股票）
 *   echo '{"symbol":"NVDA.US",...}' | npx tsx src/scripts/ad-notify.ts
 *
 *   # 从文件读取
 *   npx tsx src/scripts/ad-notify.ts --file /tmp/analysis.json
 *
 *   # 批量模式（JSON array）
 *   npx tsx src/scripts/ad-notify.ts --batch --file /tmp/batch.json
 *
 *   # 指定格式
 *   npx tsx src/scripts/ad-notify.ts --format detail < analysis.json
 *
 *   # 通用文本通知
 *   npx tsx src/scripts/ad-notify.ts --generic --title "标题" --color red <<< "正文"
 *
 * 输出: JSON 格式发送结果数组
 */

import { readFileSync } from 'node:fs';
import { AdvertisingEngine } from '../advertising/index.js';
import type {
  TurtleAnalysisResult,
} from '../advertising/types.js';
import type { BatchScanItem } from '../advertising/templates.js';

// ═══════════════════════════════════════════════════════════════════
//  CLI Args
// ═══════════════════════════════════════════════════════════════════

interface Args {
  mode: 'turtle' | 'batch' | 'generic';
  format: 'signal' | 'detail' | 'batch';
  file?: string;
  genericTitle?: string;
  genericColor?: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const has = (flag: string) => args.includes(`--${flag}`);
  const get = (key: string): string => {
    const idx = args.indexOf(`--${key}`);
    return idx >= 0 ? (args[idx + 1] ?? '') : '';
  };

  const mode = has('generic') ? 'generic'
    : has('batch') ? 'batch'
    : 'turtle';

  return {
    mode,
    format: (get('format') as 'signal' | 'detail' | 'batch') || (mode === 'batch' ? 'batch' : 'signal'),
    file: get('file') || undefined,
    genericTitle: get('title') || undefined,
    genericColor: get('color') || undefined,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  Input reading
// ═══════════════════════════════════════════════════════════════════

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString().trim();
}

function readInput(args: Args): Promise<string> {
  if (args.file) {
    try {
      return Promise.resolve(readFileSync(args.file, 'utf-8').trim());
    } catch (err: any) {
      console.error(JSON.stringify({ error: `无法读取文件: ${args.file}`, detail: err.message }));
      process.exit(1);
    }
  }
  return readStdin();
}

// ═══════════════════════════════════════════════════════════════════
//  Main
// ═══════════════════════════════════════════════════════════════════

async function main() {
  const args = parseArgs();

  // ── 通用文本模式（不需要 JSON 输入）──
  if (args.mode === 'generic') {
    const body = await readStdin();
    if (!body && !args.genericTitle) {
      console.error('Usage: ad-notify.ts --generic --title "标题" <<< "正文"');
      process.exit(1);
    }

    const engine = new AdvertisingEngine();
    await engine.start();

    const results = await engine.notify(
      args.genericTitle || '通知',
      body || '(无内容)',
      (args.genericColor as 'green' | 'blue' | 'orange' | 'red' | 'purple' | 'grey') || 'blue',
    );

    console.log(JSON.stringify(results));
    return;
  }

  // ── 读取 JSON 输入 ──
  const raw = await readInput(args);
  if (!raw) {
    console.error('Usage: echo \'JSON\' | ad-notify.ts [--format signal|detail]');
    console.error('       ad-notify.ts --file <path> [--batch]');
    process.exit(1);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error(JSON.stringify({ error: '输入不是有效的 JSON', raw: raw.slice(0, 200) }));
    process.exit(1);
  }

  const engine = new AdvertisingEngine();
  await engine.start();

  // ── 批量模式 ──
  if (args.mode === 'batch' || args.format === 'batch') {
    const items: BatchScanItem[] = Array.isArray(parsed) ? parsed : [parsed];
    const validItems = items.filter((i) => i.symbol && typeof i.price === 'number');

    if (validItems.length === 0) {
      console.log(JSON.stringify([{ success: false, error: '无有效批量数据' }]));
      return;
    }

    const results = await engine.notifyBatch(validItems, validItems.length);
    console.log(JSON.stringify(results));
    return;
  }

  // ── 单只股票模式 ──
  const analysis: TurtleAnalysisResult = parsed;

  if (!analysis.symbol || typeof analysis.currentPrice !== 'number') {
    console.error(JSON.stringify({ error: '缺少 symbol/currentPrice 字段', received: Object.keys(parsed) }));
    process.exit(1);
  }

  let results;
  if (args.format === 'detail') {
    results = await engine.notifyDetail(analysis);
  } else {
    results = await engine.notifyAnalysis(analysis);
  }

  console.log(JSON.stringify(results));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
