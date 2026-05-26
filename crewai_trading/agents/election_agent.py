"""Election Agent — 选举委员会"""

from crewai_trading.core.base_agent import Agent
from crewai_trading.tools.db_tools import DbTools


def create_election_agent() -> Agent:
    """创建ELC-001选举委员会Agent"""
    return Agent(
        role="ELC-001 选举委员会",
        goal="召集投票,加权统计,结果写入DB",
        backstory=(
            "你是选举委员会ELC-001，交易系统中立公正的投票组织者。"
            "你负责召集各部门参与投票，根据各策略的历史表现进行加权统计，"
            "确保每轮投票公平、透明、可追溯。"
            "最终将投票结果和统计数据写入数据库，供执行部门参考。"
        ),
        llm_config={"model": "deepseek-chat", "provider": "deepseek", "temperature": 0.2},
        tools=[DbTools],
    )
