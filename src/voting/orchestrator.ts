/**
 * 投票编排器 — Vote Orchestrator
 *
 * 负责选举轮次的生命周期管理：
 *   1. 创建选举轮次（election_round）
 *   2. 为 ACTIVE 智能体生成投票请求
 *   3. 为 SHADOW 智能体生成影子投票请求（仅记录，不参与决策）
 *
 * 影子投票仅用于数据收集与策略评估，不影响选举结果。
 */

import { getDb, prepare } from '../core/db.js';
import type {
  VoteRequest,
  VoteNode,
  TriggerType,
  Agent,
} from '../core/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 生成选举轮次 ID，格式：ELEC-YYYYMMDD-HHMM */
function generateRoundId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toISOString().slice(11, 16).replace(':', '');
  return `ELEC-${date}-${time}`;
}

/** 查询指定状态的智能体列表 */
function getAgentsByStatus(status: string): Agent[] {
  const stmt = prepare('SELECT * FROM agents WHERE status = ?');
  return stmt.all(status) as Agent[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * 创建选举轮次
 *
 * 在 election_rounds 表中插入一条新记录，代表一次投票事件的开始。
 * 初始状态：total_voters / buy_votes / sell_votes / hold_votes 均为 0，
 * final_decision 默认为 HOLD（尚未出结果）。
 *
 * @param symbol       - 股票代码，如 "NVDA.US"
 * @param triggerType  - 触发类型（价格突破 / 新闻 / 社交热度等）
 * @param triggerDetail - 触发详情描述
 * @param currentPrice - 当前价格
 * @param voteNode     - 本轮投票关注的节点：BUY 或 SELL
 * @returns 生成的 round_id
 */
export function createElectionRound(
  symbol: string,
  triggerType: TriggerType,
  triggerDetail: string,
  currentPrice: number,
  voteNode: VoteNode,
): string {
  const roundId = generateRoundId();
  const now = new Date().toISOString();

  const stmt = prepare(`
    INSERT INTO election_rounds
      (round_id, symbol, total_voters, buy_votes, sell_votes, hold_votes,
       final_decision, decision_confidence, resulted_trade_id, created_at)
    VALUES
      (@round_id, @symbol, 0, 0, 0, 0,
       'HOLD', 0.0, NULL, @created_at)
  `);

  stmt.run({
    round_id: roundId,
    symbol,
    created_at: now,
  });

  return roundId;
}

/**
 * 为所有 ACTIVE 智能体生成投票请求
 *
 * 遍历 agents 表中 status='ACTIVE' 的智能体，为每个智能体构造一个 VoteRequest。
 * SHADOW 和 TERMINATED 状态的智能体**不参与**决策投票。
 *
 * @param roundId       - 选举轮次 ID
 * @param symbol        - 股票代码
 * @param triggerType   - 触发类型
 * @param triggerDetail - 触发详情
 * @param currentPrice  - 当前价格
 * @param voteNode      - 投票节点（BUY / SELL）
 * @returns VoteRequest 数组，每个元素对应一个 ACTIVE 智能体
 */
export function generateVoteRequests(
  roundId: string,
  symbol: string,
  triggerType: TriggerType,
  triggerDetail: string,
  currentPrice: number,
  voteNode: VoteNode,
): VoteRequest[] {
  const agents = getAgentsByStatus('ACTIVE');

  return agents.map((agent) => ({
    round_id: roundId,
    symbol,
    trigger_type: triggerType,
    trigger_detail: triggerDetail,
    current_price: currentPrice,
    signals: [], // 由调用方按需填充来自 stock_pool 的信号
    vote_node: voteNode,
    deadline_seconds: 60, // 默认 60 秒投票窗口
  }));
}

/**
 * 为所有 SHADOW 智能体生成影子投票请求
 *
 * 影子投票请求在结构上与正式请求一致，但在 aggregator 层会被标记为 is_shadow=true，
 * 其投票结果**不计入**最终决策，仅用于事后评估与策略训练。
 *
 * @param roundId       - 选举轮次 ID
 * @param symbol        - 股票代码
 * @param triggerType   - 触发类型
 * @param triggerDetail - 触发详情
 * @param currentPrice  - 当前价格
 * @param voteNode      - 投票节点（BUY / SELL）
 * @returns VoteRequest 数组，每个元素对应一个 SHADOW 智能体
 */
export function createShadowVoteRequests(
  roundId: string,
  symbol: string,
  triggerType: TriggerType,
  triggerDetail: string,
  currentPrice: number,
  voteNode: VoteNode,
): VoteRequest[] {
  const shadowAgents = getAgentsByStatus('SHADOW');

  return shadowAgents.map((agent) => ({
    round_id: roundId,
    symbol,
    trigger_type: triggerType,
    trigger_detail: triggerDetail,
    current_price: currentPrice,
    signals: [],
    vote_node: voteNode,
    deadline_seconds: 60,
  }));
}
