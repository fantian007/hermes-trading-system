/**
 * 投票聚合 — PURE STATS TOOL
 *
 * 职责（仅此一项）：
 *   从 DB 读取某选举轮次的投票记录，输出加权统计（count 和 weighted score）。
 *   不执行任何决策算法，不判断胜负。
 *
 * 所有业务决策交给 Agent 自然语言：
 *   - Agent（选举委员会）读取 JSON 后这样说：
 *     "有 4 票 BUY 和 2 票 SELL，加权 buy 2.5 vs sell 0.8，我认为应该 BUY"
 *
 * 用法：
 *   npx tsx src/scripts/aggregate-votes.ts --round-id ELEC-20260521-1430
 */

import { getDb } from '../core/db.js';
import type { VoteResponse, Agent } from '../core/types.js';

// ---- Weight calculation (pure math, not business logic) ----

/** 计算智能体的投票权重（纯数学公式：win_rate × log2(1 + total_trades)） */
function calculateWeight(agent: Agent): number {
  const { win_rate, total_trades } = agent;
  const experienceFactor = total_trades === 0 ? 0.5 : Math.log2(1 + total_trades);
  const baseWeight = total_trades === 0 ? 0.5 : win_rate;
  return baseWeight * experienceFactor;
}

// ---- Arg parsing ----

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

  // Load round info
  const round = getDb().prepare('SELECT * FROM election_rounds WHERE round_id = ?').get(roundId) as any;
  if (!round) {
    console.log(JSON.stringify({ error: `Round ${roundId} not found` }));
    process.exit(1);
  }

  // Load all votes from DB for this round
  const voteRows = getDb().prepare(`
    SELECT vote_id, agent_id, vote_direction, confidence, reasoning, is_shadow
    FROM agent_votes
    WHERE trade_id = ? OR trade_id = ?
  `).all(roundId, roundId) as any[];

  if (voteRows.length === 0) {
    console.log(JSON.stringify({ error: 'No votes found for this round', roundId }));
    process.exit(1);
  }

  // Load ACTIVE agents for weight calculation
  const activeAgents = getDb().prepare('SELECT * FROM agents WHERE status = ?').all('ACTIVE') as Agent[];
  const weightMap = new Map<string, number>();
  for (const agent of activeAgents) {
    weightMap.set(agent.agent_id, calculateWeight(agent));
  }

  // Aggregate weighted counts (PURE STATS — no decision algorithm)
  const results = {
    buy:  { count: 0, weighted: 0 },
    sell: { count: 0, weighted: 0 },
    hold: { count: 0, weighted: 0 },
  };

  let totalActiveVoters = 0;
  const votes: Array<{ agent_id: string; vote_direction: string; weighted: number }> = [];

  for (const row of voteRows) {
    const weight = weightMap.get(row.agent_id) ?? 0;
    if (weight > 0) {
      totalActiveVoters++;
    }
    const dir = (row.vote_direction || 'hold').toLowerCase() as 'buy' | 'sell' | 'hold';
    results[dir].count += (weight > 0 ? 1 : 0);
    results[dir].weighted += weight;
    votes.push({
      agent_id: row.agent_id,
      vote_direction: row.vote_direction,
      weighted: weight,
    });
  }

  // Output stats only — NO decision
  console.log(JSON.stringify({
    type: 'vote_stats',
    round_id: roundId,
    symbol: round.symbol,
    total_active_voters: totalActiveVoters,
    results,
    individual_votes: votes,
  }));
}

main().catch(console.error);
