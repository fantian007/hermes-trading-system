"""
投票流程 Task 定义

包括：创建轮次、50策略投票、聚合。均复用 core/base_task.py 的 Task 基类。
"""

from crewai_trading.core.base_task import Task
from crewai_trading.agents.strategy_agent import create_strategy_agent
from crewai_trading.agents.election_agent import create_election_agent

_strategy_agent = create_strategy_agent()
_election_agent = create_election_agent()


def create_voting_round_task(symbol: str) -> Task:
    """创建投票轮次 — 由策略部门组长发起。

    Args:
        symbol: 投票标的，如 "TSLA.US"
    """
    return Task(
        description=(
            f"CREATE_VOTING_ROUND for {symbol}\n"
            f"1. 调用 DbTools.create_round(symbol={symbol}, total_voters=50) 创建投票轮次。\n"
            f"2. 记录 round_id 并返回，供后续投票使用。"
        ),
        agent=_strategy_agent,
        expected_output=f"election round created for {symbol}, round_id returned",
    )


def create_strategy_vote_task(
    round_id: str, symbol: str, strategy_name: str, agent_id: str, vote_side: str
) -> Task:
    """单个策略投票 — 每轮由50个策略视角分别投票。

    Args:
        round_id: 选举轮次ID
        symbol: 股票代码
        strategy_name: 策略名称
        agent_id: Agent ID，如 "AGT-002"
        vote_side: 投票方向 (BUY/SELL/HOLD)
    """
    return Task(
        description=(
            f"STRATEGY_VOTE for {symbol} | round={round_id}\n"
            f"Strategy: {strategy_name} ({agent_id})\n"
            f"1. 获取 {symbol} 的最新行情数据 (通过 MarketTools.get_quote / get_kline)。\n"
            f"2. 运用 {strategy_name} 策略视角独立分析，给出 vote (BUY/SELL/HOLD)。\n"
            f"3. 调用 DbTools.write_vote(round_id={round_id}, agent_id={agent_id}, "
            f"vote=<你的判断>, confidence=<0-1>, reasoning=<分析逻辑>) 记录投票。"
        ),
        agent=_strategy_agent,
        expected_output=f"vote recorded for {strategy_name} on {symbol} round {round_id}",
    )


def create_aggregate_task(round_id: str, symbol: str) -> Task:
    """聚合投票结果 — 由选举委员会执行。

    Args:
        round_id: 选举轮次ID
        symbol: 股票代码
    """
    return Task(
        description=(
            f"AGGREGATE_VOTES for {symbol} | round={round_id}\n"
            f"1. 调用 DbTools.aggregate_votes(round_id={round_id}) 获取投票结果。\n"
            f"2. 加权统计各方向票数，计算最终决策 (BUY/SELL/HOLD)。\n"
            f"3. 若 HOLD 比例超过 {{{{ HOLD_RATIO_MAX }}}}%，默认不操作。\n"
            f"4. 返回最终决策和信心度。"
        ),
        agent=_election_agent,
        expected_output=f"aggregated voting result for {symbol} round {round_id}",
    )
