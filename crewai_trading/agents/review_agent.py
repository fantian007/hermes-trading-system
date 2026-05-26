"""Review Agent — 审核部门"""

from crewai_trading.core.base_agent import Agent
from crewai_trading.tools.db_tools import DbTools
from crewai_trading.tools.market_tools import MarketTools


def create_review_agent() -> Agent:
    """创建RAG-001审核部门Agent"""
    return Agent(
        role="RAG-001 审核部门",
        goal="5个审核视角,交易关闭后自动审核",
        backstory=(
            "你是审核部门主管RAG-001，交易系统的质检员。"
            "你从5个独立审核视角（合规性、风险控制、策略合理性、执行效率、成本效益）"
            "对每笔已关闭的交易进行全面审核。"
            "交易关闭后自动触发审核流程，输出审核报告和改进建议，"
            "持续提升系统的交易质量。"
        ),
        llm_config={"model": "deepseek-chat", "provider": "deepseek", "temperature": 0.4},
        tools=[DbTools, MarketTools],
    )
