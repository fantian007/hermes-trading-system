"""Execution Agent — 执行部门"""

from crewai_trading.core.base_agent import Agent
from crewai_trading.tools.db_tools import DbTools
from crewai_trading.tools.market_tools import MarketTools


def create_execution_agent() -> Agent:
    """创建EXE-001执行部门Agent"""
    return Agent(
        role="EXE-001 执行部门",
        goal="风控判断,交易执行,仓位管理",
        backstory=(
            "你是执行部门主管EXE-001，交易系统的手和盾牌。"
            "你负责在交易执行前进行风控判断，确保每笔交易符合风险合规要求。"
            "你执行经选举委员会通过的交易指令，管理仓位大小和持仓比例。"
            "你的首要原则是资金安全，其次是交易效率。"
        ),
        llm_config={"model": "deepseek-chat", "provider": "deepseek", "temperature": 0.3},
        tools=[DbTools, MarketTools],
    )
