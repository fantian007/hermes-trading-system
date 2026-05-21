/**
 * 投票聚合 + 决策脚本
 *
 * 用法：
 *   npx tsx src/scripts/aggregate-votes.ts --round-id ELEC-20260521-1430
 *
 * 选举委员调用此脚本：
 *   1. 等待所有策略 Agent 投票完成（或超时）
 *   2. 聚合投票结果
 *   3. 执行决策算法
 *   4. 输出最终决策到 stdout
 */

import { aggregateVotes, recordVotes, updateElectionRound } from '../voting/aggregator.js';
import { getDb } from '../core/db.js';
import type { VoteResponse } from '../core/types.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (key: string) => {
    const idx = args.indexOf(`--${key}`);
    return idx >= 0 ? args[idx + 1] : '';
  };
  return { roundId: get('round-id') };
}

async function main() {
  const { roundId } = parseArgs();

  if (!roundId) {
    console.error('Usage: aggregate-votes.ts --round-id <ID>');
    process.exit(1);
  }

  // 读取选举轮次信息
  const round = getDb().prepare('SELECT * FROM election_rounds WHERE round_id = ?').get(roundId) as any;
  if (!round) {
    console.log(JSON.stringify({ error: `Round ${roundId} not found` }));
    process.exit(1);
  }

  // 读取 stdin 中的投票（由协调脚本传入）
  // 投票格式：每行一个 JSON VoteResponse
  const votes: VoteResponse[] = [];
  
  process.stdin.setEncoding('utf-8');
  let input = '';
  
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  // 解析输入
  const lines = input.trim().split('\n').filter(Boolean);
  for (const line of lines) {
    try {
      const vote = JSON.parse(line) as VoteResponse;
      if (vote.agent_id && vote.round_id && vote.vote_direction) {
        votes.push(vote);
      }
    } catch {
      // 跳过无效行
    }
  }

  if (votes.length === 0) {
    console.log(JSON.stringify({ error: 'No valid votes received', roundId }));
    process.exit(1);
  }

  // 记录投票到 DB (用 roundId 作为临时 trade_id)
  recordVotes(votes, roundId, round.symbol, roundId, 'BUY');

  // 聚合投票
  const summary = aggregateVotes(roundId, votes);

  // 更新选举轮次
  updateElectionRound(roundId, summary);

  // 输出最终决策
  const output = {
    round_id: roundId,
    symbol: round.symbol,
    vote_node: round.vote_node || summary.vote_node,
    final_decision: summary.winning_direction,
    confidence: summary.winning_confidence,
    results: summary.results,
    total_voters: summary.total_voters,
  };

  console.log(JSON.stringify(output));
}

main().catch(console.error);
