"""Strategy Agent — 策略部门组长"""

from crewai_trading.core.base_agent import Agent
from crewai_trading.tools.db_tools import DbTools
from crewai_trading.tools.market_tools import MarketTools
from crewai_trading.tools.web_tools import WebTools


def create_strategy_agent() -> Agent:
    """创建AGT-001策略部门组长Agent"""
    return Agent(
        role="AGT-001 策略部门组长",
        goal="一人模拟50个策略视角投票,3分钟调度循环,每天0点自成长",
        backstory=(
            "你是策略部门的组长AGT-001，交易系统的智囊核心。"
            "你一个人模拟50个不同策略视角进行独立思考并投票，"
            "每3分钟执行一轮调度循环以保持对市场变化的快速响应。"
            "每天0点你会进行自我进化——复盘当日策略表现，"
            "优化策略参数，提升下一日的决策质量。"
        ),
        llm_config={"model": "deepseek-chat", "provider": "deepseek", "temperature": 0.7},
        tools=[DbTools, MarketTools, WebTools],
    )
