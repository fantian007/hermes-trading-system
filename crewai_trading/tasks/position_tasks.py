"""
持仓分析 Task 定义

包括：查持仓、查行情、调仓投票。
"""

from crewai_trading.core.base_task import Task
from crewai_trading.agents.data_agent import create_data_agent
from crewai_trading.agents.strategy_agent import create_strategy_agent

_data_agent = create_data_agent()
_strategy_agent = create_strategy_agent()


def create_positions_query_task() -> Task:
    """查询当前持仓 — 由数据部门拉取 DB 持仓列表。"""
    return Task(
        description=(
            "QUERY_POSITIONS\n"
            "1. 调用 DbTools.get_positions() 查询所有 OPEN 状态的持仓。\n"
            "2. 返回持仓列表：symbol、方向、数量、开仓价、盈亏等。"
        ),
        agent=_data_agent,
        expected_output="list of open positions with details",
    )


def create_market_price_task(symbols: list[str]) -> Task:
    """获取多个标的的实时行情。

    Args:
        symbols: 股票代码列表
    """
    symbol_list = ", ".join(symbols)
    return Task(
        description=(
            f"QUERY_MARKET_PRICES for [{symbol_list}]\n"
            f"1. 对每个symbol调用 MarketTools.get_quote(symbol) 获取实时行情。\n"
            f"2. 返回每个symbol的最新价格、涨跌幅、成交量。"
        ),
        agent=_data_agent,
        expected_output="real-time prices for each symbol",
    )


def create_position_rebalance_task(
    positions: list[dict], market_data: dict
) -> Task:
    """调仓投票 — 根据持仓和行情生成调仓建议。

    Args:
        positions: 当前持仓列表
        market_data: 行情数据
    """
    return Task(
        description=(
            f"POSITION_REBALANCE\n"
            f"Current positions: {positions}\n"
            f"Market data: {market_data}\n"
            f"1. 分析每支持仓的盈亏状态、风险敞口。\n"
            f"2. 判断是否需要减仓/加仓/止盈/止损。\n"
            f"3. 输出调仓建议列表：[{{symbol, action, reason, confidence}}]。"
        ),
        agent=_strategy_agent,
        expected_output="rebalance suggestions for current positions",
    )
