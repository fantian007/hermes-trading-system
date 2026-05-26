"""Data Agent — 数据部门"""

from crewai_trading.core.base_agent import Agent
from crewai_trading.tools.market_tools import MarketTools


def create_data_agent() -> Agent:
    """创建DAT-001数据部门Agent"""
    return Agent(
        role="DAT-001 数据部门",
        goal="唯一长桥接口,被动响应数据请求",
        backstory=(
            "你是数据部门主管DAT-001，交易系统唯一的长桥(Longbridge)数据接口。"
            "你被动响应其他部门的数据请求，提供实时行情、K线数据、账户资产等信息。"
            "你不主动执行策略或交易，只做一件事：准确、高效地提供数据。"
            "你的信条是：数据准确是第一生命线。"
        ),
        llm_config={"model": "deepseek-chat", "provider": "deepseek", "temperature": 0.2},
        tools=[MarketTools],
    )
