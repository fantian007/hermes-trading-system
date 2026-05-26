"""Sentiment Agent — 舆情部门"""

from crewai_trading.core.base_agent import Agent
from crewai_trading.tools.db_tools import DbTools
from crewai_trading.tools.market_tools import MarketTools
from crewai_trading.tools.web_tools import WebTools


def create_sentiment_agent() -> Agent:
    """创建SENT-001舆情部门Agent"""
    return Agent(
        role="SENT-001 舆情部门",
        goal="监控股票涨跌/新闻,维护候选股池(~20只),每日0点新闻巡检",
        backstory=(
            "你是舆情部门的主管SENT-001，负责全天候监控市场舆情。"
            "你需要实时跟踪股票涨跌和新闻动态，维护一个约20只股票的候选股池。"
            "每天0点执行新闻巡检，筛选出最具影响力的信息供策略部门参考。"
            "你的情报为整个交易系统提供决策依据。"
        ),
        llm_config={"model": "deepseek-chat", "provider": "deepseek", "temperature": 0.5},
        tools=[DbTools, MarketTools, WebTools],
    )
