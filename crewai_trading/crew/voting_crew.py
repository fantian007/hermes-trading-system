"""
投票Crew定义

流程：数据→策略→选举→执行
"""

from typing import List

from crewai_trading.core.crew_base import Crew
from crewai_trading.core.base_agent import Agent
from crewai_trading.core.base_task import Task
from crewai_trading.agents.data_agent import create_data_agent
from crewai_trading.agents.strategy_agent import create_strategy_agent
from crewai_trading.agents.election_agent import create_election_agent
from crewai_trading.agents.execution_agent import create_execution_agent
from crewai_trading.tasks.voting_tasks import (
    create_voting_round_task,
    create_aggregate_task,
)


def create_voting_crew(symbol: str, round_id: str) -> Crew:
    """为单个标的创建投票Crew。

    流程：
    1. 数据部门获取行情（内嵌在策略vote task中）
    2. 策略部门组长模拟50个策略视角投票 → 写入DB
    3. 选举委员会聚合投票结果
    4. 执行部门根据结果执行交易

    Args:
        symbol: 交易标的
        round_id: 选举轮次ID（需提前创建）
    """
    data_agent: Agent = create_data_agent()
    strategy_agent: Agent = create_strategy_agent()
    election_agent: Agent = create_election_agent()
    execution_agent: Agent = create_execution_agent()

    # ── 步骤1: 获取行情数据 ─────────────────────────────────
    fetch_data_task = Task(
        description=(
            f"FETCH_MARKET_DATA for {symbol}\n"
            f"1. 调用 MarketTools.get_quote(symbol={symbol}) 获取实时报价。\n"
            f"2. 调用 MarketTools.get_kline(symbol={symbol}, days=60) 获取60日K线。\n"
            f"3. 返回行情数据和K线数据，供策略部门使用。"
        ),
        agent=data_agent,
        expected_output=f"market data and kline for {symbol}",
    )

    # ── 步骤2: 策略投票 ────────────────────────────────────
    strategy_vote_task = Task(
        description=(
            f"STRATEGY_VOTE_SIMULATION for {symbol} | round={round_id}\n"
            f"1. 你作为策略部门组长AGT-001，需要模拟50个策略视角进行独立投票。\n"
            f"2. 每个视角根据各自策略逻辑分析 {symbol} 的行情数据，给出 BUY/SELL/HOLD。\n"
            f"3. 调用 DbTools.write_vote() 记录每个策略视角的投票。\n"
            f"4. 汇总所有50个策略的投票情况。"
        ),
        agent=strategy_agent,
        expected_output=f"50 strategy votes recorded for {symbol} round {round_id}",
    )

    # ── 步骤3: 聚合投票 ────────────────────────────────────
    aggregate_vote_task = create_aggregate_task(round_id, symbol)

    # ── 步骤4: 执行交易 ────────────────────────────────────
    execution_task = Task(
        description=(
            f"EXECUTE_DECISION for {symbol} | round={round_id}\n"
            f"1. 获取选举委员会对 {symbol} 的最终决策结果。\n"
            f"2. 如果是 BUY/SELL，进行风控检查（仓位比例、资金余额、单笔损失上限）。\n"
            f"3. 风控通过后，调用 MarketTools.place_order() 执行交易。\n"
            f"4. 调用 DbTools.write_trade() 将交易记录写入数据库。\n"
            f"5. 返回执行结果。"
        ),
        agent=execution_agent,
        expected_output=f"trade executed for {symbol} or decision to hold",
    )

    tasks: List[Task] = [
        fetch_data_task,
        strategy_vote_task,
        aggregate_vote_task,
        execution_task,
    ]

    agents: List[Agent] = [
        data_agent,
        strategy_agent,
        election_agent,
        execution_agent,
    ]

    return Crew(
        agents=agents,
        tasks=tasks,
        process="sequential",
        verbose=True,
    )
