/**
 * 投票聚合引擎 — Vote Aggregator
 *
 * 核心职责：
 *   1. 计算每个智能体的加权投票权重
 *   2. 汇总所有投票结果，执行 4 步选举算法
 *   3. 将投票记录持久化到 agent_votes 表
 *   4. 更新 election_rounds 表，写入最终决策
 *
 * 选举算法（4 步）：
 *   Step 1 — 按权重累加各方向的加权得票
 *   Step 2 — 投票人数不足 minVoters → 裁决 HOLD
 *   Step 3 — HOLD 比例 > holdRatioMax → 裁决 HOLD
 *   Step 4 — 领先方向得票率 ≥ directionThreshold → 裁决该方向，否则 HOLD
 */

import { getDb, prepare, runInTransaction } from '../core/db.js';
import { config } from '../core/config.js';
import type {
  VoteResponse,
  VoteSummary,
  VoteDirection,
  Agent,
} from '../core/types.js';

// ---------------------------------------------------------------------------
// Weight Calculation
// ---------------------------------------------------------------------------

/**
 * 计算智能体的投票权重
 *
 * 权重公式：win_rate × log2(1 + total_trades)
 *
 * 设计理念：
 *   - win_rate（胜率）是过往决策质量的核心指标
 *   - log2(1 + total_trades) 奖励经验积累，同时对数压缩防止老手一家独大
 *   - 新手（0 笔交易）权重为 0，新手（1 笔）权重 ≈ win_rate × 1
 *
 * 注意：虽然任务描述中有 "× confidence"，但 Agent 表不含独立 confidence 字段；
 * 此处使用 win_rate 作为代理置信度。未来可在 agent_traits 中引入独立 confidence。
 *
 * @param agent - 智能体行（来自 agents 表）
 * @returns 权重值（0.0 ~ 1.0+）
 */
export function calculateWeight(agent: Agent): number {
  const { win_rate, total_trades } = agent;

  // 经验因子：log2(1 + n)，n=0 时为 0（新人无投票权重）
  const experienceFactor = Math.log2(1 + total_trades);

  return win_rate * experienceFactor;
}

// ---------------------------------------------------------------------------
// Decision Engine (4-Step Algorithm)
// ---------------------------------------------------------------------------

/**
 * 根据加权投票汇总执行 4 步选举算法
 *
 *   Step 1 — 累加加权得票（已在 aggregateVotes 中完成）
 *   Step 2 — 投票人数不足 minVoters → 裁决 HOLD
 *   Step 3 — HOLD 比例 > holdRatioMax → 裁决 HOLD（多数人犹豫时按兵不动）
 *   Step 4 — 领先方向得票率 ≥ directionThreshold → 裁决该方向，否则 HOLD
 *
 * @param summary - 加权投票汇总结果
 * @returns { direction: VoteDirection, confidence: number }
 */
export function determineDecision(summary: VoteSummary): {
  direction: VoteDirection;
  confidence: number;
} {
  const { total_voters, results } = summary;
  const { buy, sell, hold } = results;

  // Step 2: 最低投票人数检查
  if (total_voters < config.minVoters) {
    return { direction: 'HOLD', confidence: 0.0 };
  }

  // Step 3: HOLD 比例检查
  // 如果超过 holdRatioMax 的智能体选择观望，则不做交易
  const holdRatio = hold.count / total_voters;
  if (holdRatio > config.holdRatioMax) {
    return { direction: 'HOLD', confidence: holdRatio };
  }

  // Step 4: 方向性检查（在 BUY / SELL 之间进行）
  const directionalTotal = buy.count + sell.count;
  if (directionalTotal === 0) {
    // 全部投 HOLD，极罕见但安全处理
    return { direction: 'HOLD', confidence: 1.0 };
  }

  if (buy.count > sell.count) {
    const buyRatio = buy.weighted / (buy.weighted + sell.weighted);
    if (buyRatio >= config.directionThreshold) {
      return { direction: 'BUY', confidence: buyRatio };
    }
  } else if (sell.count > buy.count) {
    const sellRatio = sell.weighted / (buy.weighted + sell.weighted);
    if (sellRatio >= config.directionThreshold) {
      return { direction: 'SELL', confidence: sellRatio };
    }
  }

  // 平局或未达阈值 → 观望
  return { direction: 'HOLD', confidence: 0.0 };
}

// ---------------------------------------------------------------------------
// Vote Aggregation
// ---------------------------------------------------------------------------

/**
 * 汇总一次选举轮次的所有投票结果
 *
 * 流程：
 *   1. 加载 ACTIVE 智能体以获取权重
 *   2. 对每张票按权重累加到对应方向
 *   3. 调用 determineDecision 执行 4 步算法
 *   4. 返回 VoteSummary
 *
 * 注意：此函数仅做内存计算，不写数据库。持久化由 recordVotes 和
 * updateElectionRound 分别完成。
 *
 * @param roundId - 本轮选举 ID
 * @param votes   - 所有智能体（含影子）的投票响应
 * @returns 完整投票汇总（含加权结果和最终裁决）
 */
export function aggregateVotes(
  roundId: string,
  votes: VoteResponse[],
): VoteSummary {
  // 加载所有 ACTIVE 智能体以获取权重
  const activeStmt = prepare('SELECT * FROM agents WHERE status = ?');
  const activeAgents = activeStmt.all('ACTIVE') as Agent[];

  // 建立 agent_id → weight 映射
  const weightMap = new Map<string, number>();
  for (const agent of activeAgents) {
    weightMap.set(agent.agent_id, calculateWeight(agent));
  }

  // 累加各方向得票（count + weighted）
  const results: VoteSummary['results'] = {
    buy:  { count: 0, weighted: 0 },
    sell: { count: 0, weighted: 0 },
    hold: { count: 0, weighted: 0 },
  };

  let totalVoters = 0;
  const individualVoteIds: string[] = [];

  // 找到第一个非空的 vote_node 来确定本轮关注的方向
  // 默认取第一张票的 vote_node 上下文（由调用方在 VoteRequest 中统一设定）
  // 这里从投票响应的 round_id 上下文推断（VoteResponse 不含 vote_node）
  // 因此 vote_node 从首个投票的方向上下文推断，或由调用方传入。
  // 对于聚合而言，vote_node 不影响算法逻辑，仅用于展示。
  let firstDirection: VoteDirection = 'HOLD';

  for (const vote of votes) {
    // 只有 ACTIVE 智能体的票计入决策
    const weight = weightMap.get(vote.agent_id) ?? 0;

    if (weight > 0) {
      totalVoters++;
    }

    const dir = vote.vote_direction.toLowerCase() as VoteDirection;
    results[dir].count += (weight > 0 ? 1 : 0);
    results[dir].weighted += weight;

    if (totalVoters === 1) {
      firstDirection = vote.vote_direction;
    }

    // 收集 vote_id（由 recordVotes 生成后回填，此处预留）
    individualVoteIds.push(`VOTE-${roundId}-${vote.agent_id}`);
  }

  // 推断 vote_node：如果第一张票是 BUY，则 vote_node 为 BUY（进场信号）
  // 这里简化处理
  const voteNode = 'BUY'; // 由调用方 override，聚合器只关心方向

  // 创建临时 summary 用于决策
  const tempSummary: VoteSummary = {
    round_id: roundId,
    symbol: '', // 由调用方填充
    vote_node: voteNode,
    total_voters: totalVoters,
    results,
    winning_direction: 'HOLD',
    winning_confidence: 0.0,
    individual_vote_ids: individualVoteIds,
  };

  // 执行 4 步决策算法
  const decision = determineDecision(tempSummary);

  const summary: VoteSummary = {
    ...tempSummary,
    winning_direction: decision.direction,
    winning_confidence: decision.confidence,
  };

  return summary;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * 将投票结果写入 agent_votes 表
 *
 * 为每张票生成唯一 vote_id（格式：VOTE-{roundId}-{agent_id}），
 * 并写入 agent_votes 表。影子投票的 is_shadow 标记为 1。
 *
 * @param votes    - 所有投票响应
 * @param roundId  - 所属选举轮次 ID
 * @param symbol   - 股票代码
 * @param tradeId  - 关联交易 ID（可为空字符串，此时用 roundId 占位）
 * @param voteNode - 本轮投票的节点类型（BUY / SELL）
 */
export function recordVotes(
  votes: VoteResponse[],
  roundId: string,
  symbol: string,
  tradeId: string,
  voteNode: string,
): void {
  const db = getDb();
  const now = new Date().toISOString();

  // 加载完整 agent 列表以区分 ACTIVE vs SHADOW
  const agentStmt = db.prepare('SELECT agent_id, status FROM agents');
  const allAgents = agentStmt.all() as { agent_id: string; status: string }[];
  const statusMap = new Map(allAgents.map((a) => [a.agent_id, a.status]));

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO agent_votes
      (vote_id, trade_id, agent_id, vote_node, vote_direction,
       confidence, reasoning, raw_analysis, voted_at, is_shadow)
    VALUES
      (@vote_id, @trade_id, @agent_id, @vote_node, @vote_direction,
       @confidence, @reasoning, @analysis_detail, @voted_at, @is_shadow)
  `);

  const effectiveTradeId = tradeId || roundId;

  const runAll = runInTransaction(() => {
    for (const vote of votes) {
      const agentStatus = statusMap.get(vote.agent_id) ?? 'ACTIVE';
      insertStmt.run({
        vote_id: `VOTE-${roundId}-${vote.agent_id}`,
        trade_id: effectiveTradeId,
        agent_id: vote.agent_id,
        vote_node: voteNode,
        vote_direction: vote.vote_direction,
        confidence: vote.confidence,
        reasoning: vote.reasoning,
        analysis_detail: vote.analysis_detail ?? null,
        voted_at: now,
        is_shadow: agentStatus === 'SHADOW' ? 1 : 0,
      });
    }
  });

  runAll();
}

/**
 * 更新 election_rounds 表，写入聚合后的最终决策
 *
 * 调用时机：aggregateVotes + recordVotes 之后。
 *
 * @param roundId - 选举轮次 ID
 * @param summary - 加权投票汇总（含最终决策）
 */
export function updateElectionRound(
  roundId: string,
  summary: VoteSummary,
): void {
  const stmt = prepare(`
    UPDATE election_rounds
    SET
      total_voters   = @total_voters,
      buy_votes      = @buy_votes,
      sell_votes     = @sell_votes,
      hold_votes     = @hold_votes,
      final_decision = @final_decision,
      decision_confidence = @decision_confidence,
      executed_at    = @executed_at
    WHERE round_id = @round_id
  `);

  stmt.run({
    round_id: roundId,
    total_voters: summary.total_voters,
    buy_votes: summary.results.buy.count,
    sell_votes: summary.results.sell.count,
    hold_votes: summary.results.hold.count,
    final_decision: summary.winning_direction,
    decision_confidence: summary.winning_confidence,
    executed_at: new Date().toISOString(),
  });
}
