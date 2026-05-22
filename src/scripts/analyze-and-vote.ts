/**
 * 市场数据提供者 — 给 Agent 决策用
 *
 * 职责（仅此一项）：
 *   拉取原始市场数据 + Agent 自身档案数据，输出 JSON。
 *   不做任何分析、不提示任何方向、不引导投票。
 *
 * Agent 读取 stdout JSON 后，自己数据分析、自己思考、自己投票。
 *
 * 用法：
 *   npx tsx src/scripts/analyze-and-vote.ts \
 *     --agent-id AGT-001 \
 *     --symbol NVDA.US
 */

import { getKline, getQuote } from '../market/quote.js';
import { getDb } from '../core/db.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKDIR = resolve(__dirname, '../..');

interface Args {
  agentId: string;
  symbol: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const get = (key: string) => {
    const idx = args.indexOf(`--${key}`);
    return idx >= 0 ? args[idx + 1] : '';
  };
  return {
    agentId: get('agent-id'),
    symbol: get('symbol'),
  };
}

/** 通过 data-agent 的 CLI 获取行情（避免直接调 longbridge） */
function getMarketDataViaDataAgent(symbol: string): string {
  try {
    const out = execSync(
      `npx tsx src/scripts/data-service.ts --type quote --symbol ${symbol}`,
      { cwd: WORKDIR, timeout: 15_000 }
    ).toString().trim();
    return out;
  } catch {
    return JSON.stringify({ error: 'Failed to get quote from data-agent' });
  }
}

async function main() {
  const { agentId, symbol } = parseArgs();

  if (!agentId || !symbol) {
    console.error('Usage: analyze-and-vote.ts --agent-id <ID> --symbol <SYM>');
    process.exit(1);
  }

  // 1. Agent 自身档案
  const agent = getDb().prepare('SELECT * FROM agents WHERE agent_id = ?').get(agentId) as any;
  if (!agent) {
    console.log(JSON.stringify({ error: `Agent ${agentId} not found` }));
    process.exit(1);
  }

  // 2. 读取自己的 traits（自我认知）
  const traits = getDb().prepare(
    'SELECT trait_key, trait_value, trait_type, confidence FROM agent_traits WHERE agent_id = ?'
  ).all(agentId) as any[];

  // 3. 拉行情数据（只做原始数据获取）
  const klineResult = await getKline(symbol, '', '', 'day');
  const quoteResult = await getQuote([symbol]);

  // 4. 只输出原始数据，不做任何分析建议
  const context = {
    agent: {
      id: agent.agent_id,
      name: agent.agent_name,
      strategy: agent.strategy_summary,
      source: agent.strategy_source,
      indicators: agent.indicators ? JSON.parse(agent.indicators) : [],
      status: agent.status,
      winRate: agent.win_rate,
      totalTrades: agent.total_trades,
    },
    traits: traits.map((t: any) => ({
      key: t.trait_key,
      value: t.trait_value,
      type: t.trait_type,
      confidence: t.confidence,
    })),
    market: {
      symbol,
      kline: 'error' in klineResult ? null : klineResult?.slice?.(0, 50) ?? null,
      quote: 'error' in quoteResult ? null : quoteResult?.[0] ?? null,
    },
    // 不再包含 instruction 模板，Agent 自己决定怎么分析和投票
  };

  console.log(JSON.stringify(context, null, 2));
}

main().catch(console.error);
