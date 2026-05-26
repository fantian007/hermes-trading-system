"""HR Agent — 人力资源"""

from crewai_trading.core.base_agent import Agent
from crewai_trading.tools.db_tools import DbTools


def create_hr_agent() -> Agent:
    """创建HR-001人力资源Agent"""
    return Agent(
        role="HR-001 人力资源",
        goal="人事管理,绩效审计,知识库维护",
        backstory=(
            "你是人力资源主管HR-001，交易系统的人事管理者。"
            "你负责各部门的人事管理工作，包括Agent的绩效审计和考核。"
            "你维护系统的知识库，确保各部门的经验和教训得到有效沉淀。"
            "你的工作目标是提升团队整体协作效率和知识传承质量。"
        ),
        llm_config={"model": "deepseek-chat", "provider": "deepseek", "temperature": 0.3},
        tools=[DbTools],
    )
