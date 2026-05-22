/**
 * 触发投票 — PURE DATA TOOL
 *
 * 职责（仅此两项）：
 *   1. 无参数：读取候选股池，输出所有 ACTIVE 信号的 JSON
 *   2. --symbol X --create-round：创建一个选举轮次并输出 round_id
 *
 * 所有业务决策交给 Agent 自然语言：
 *   - Agent（策略部门）读取输出 JSON，向 data-agent 询问价格，
 *     然后决定"我认为应该对 NVDA 发起投票"
 *   - 再以 --symbol NVDA --create-round 运行此脚本
 *
 * 用法：
 *   npx tsx src/scripts/trigger-vote.ts
 *   npx tsx src/scripts/trigger-vote.ts --symbol NVDA.US --create-round
 */

import { getActivePool } from '../pool/stock-pool.js';
import { createElectionRound } from '../voting/orchestrator.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (key: string) => {
    const idx = args.indexOf(`--${key}`);
    return idx >= 0 ? args[idx + 1] : '';
  };
  return {
    symbol: get('symbol'),
    createRound: args.includes('--create-round'),
  };
}

async function main() {
  const { symbol, createRound } = parseArgs();

  // Mode 1: Create an election round (Agent decision — just executes it)
  if (symbol && createRound) {
    const roundId = createElectionRound(symbol, 'PRICE_BREAKOUT', 'Agent-triggered via trigger-vote', 0, 'BUY');
    console.log(JSON.stringify({
      type: 'round_created',
      round_id: roundId,
      symbol,
    }));
    return;
  }

  // Mode 2: Read the active stock pool and output signals (no decisions)
  const pool = getActivePool();
  console.log(JSON.stringify({
    type: 'active_pool',
    count: pool.length,
    signals: pool.map(item => ({
      symbol: item.symbol,
      signal_type: item.signal_type,
      strength: item.strength,
      reason: item.reason,
      source: item.source,
      agent_id: item.agent_id,
    })),
  }));
}

main().catch(console.error);
