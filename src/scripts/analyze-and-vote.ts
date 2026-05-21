/**
 * 策略分析 + 投票脚本
 *
 * 用法：
 *   npx tsx src/scripts/analyze-and-vote.ts \
 *     --agent-id AGT-0001 \
 *     --round-id ELEC-20260521-1430 \
 *     --symbol NVDA.US \
 *     --vote-node BUY \
 *     --current-price 125.30
 *
 * 策略 Agent 调用此脚本：
 *   1. 拉取行情数据（K线 + 实时报价）
 *   2. 读取自己的 agent_traits 获得自我认知
 *   3. 输出 JSON 投票结果到 stdout
 *   → Agent 读取 stdout 中的投票决定，作为其推理依据
 */

import { getKline, getQuote } from '../market/quote.js';
import { getDb } from '../core/db.js';

interface Args {
  agentId: string;
  roundId: string;
  symbol: string;
  voteNode: string;
  currentPrice: number;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const get = (key: string) => {
    const idx = args.indexOf(`--${key}`);
    return idx >= 0 ? args[idx + 1] : '';
  };
  return {
    agentId:       get('agent-id'),
    roundId:       get('round-id'),
    symbol:        get('symbol'),
    voteNode:      get('vote-node') || 'BUY',
    currentPrice:  parseFloat(get('current-price') || '0'),
  };
}

async function main() {
  const { agentId, roundId, symbol, voteNode, currentPrice } = parseArgs();

  if (!agentId || !symbol) {
    console.error('Usage: analyze-and-vote.ts --agent-id <ID> --symbol <SYM> --round-id <ID> --vote-node BUY|SELL --current-price <N>');
    process.exit(1);
  }

  // 1. 读取自己的 Agent 信息
  const agent = getDb().prepare('SELECT * FROM agents WHERE agent_id = ?').get(agentId) as any;
  if (!agent) {
    console.log(JSON.stringify({ error: `Agent ${agentId} not found` }));
    process.exit(1);
  }

  // 2. 读取自己的 traits（自我认知）
  const traits = getDb().prepare(
    'SELECT trait_key, trait_value, trait_type, confidence FROM agent_traits WHERE agent_id = ?'
  ).all(agentId) as any[];

  // 3. 拉行情数据
  const klineResult = await getKline(symbol, '', '', 'day');
  const quoteResult = await getQuote([symbol]);

  // 4. 输出分析上下文（给 Agent 作为推理输入）
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
      voteNode,
      currentPrice,
      kline: 'error' in klineResult ? null : klineResult?.slice?.(0, 50) ?? null,
      quote: 'error' in quoteResult ? null : quoteResult?.[0] ?? null,
    },
    instruction: `
Based on your strategy (${agent.strategy_summary}), analyze the above market data and
your self-traits. Output a JSON vote:

{
  "agent_id": "${agentId}",
  "round_id": "${roundId}",
  "vote_direction": "BUY" | "SELL" | "HOLD",
  "confidence": 0.0 ~ 1.0,
  "reasoning": "Your analysis reasoning (1-3 sentences)"
}
`,
  };

  console.log(JSON.stringify(context, null, 2));
}

main().catch(console.error);
