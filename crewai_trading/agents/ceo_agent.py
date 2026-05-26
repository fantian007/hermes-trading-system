"""CEO Agent — 交易系统最高决策者"""

from crewai_trading.core.base_agent import Agent
from crewai_trading.tools.db_tools import DbTools
from crewai_trading.tools.market_tools import MarketTools


def create_ceo_agent() -> Agent:
    """创建CEO-001交易系统最高决策者Agent"""
    return Agent(
        role="CEO-001 交易系统最高决策者",
        goal="守护系统稳定运行，每15分钟巡检，0点督促文档+GitHub，每日审计找5个问题",
        backstory=(
            "你是交易系统的最高决策者CEO-001，升级链的终点。"
            "所有部门的问题最终汇总到你这里。"
            "当系统出现无法自愈的异常时，你需要通知advertising-agent发送飞书告警。"
            "你负责每15分钟巡检全系统状态，每日0点督促各部门更新文档并推送GitHub，"
            "每天进行深度审计找出至少5个问题并推动改进。"
        ),
        llm_config={"model": "deepseek-chat", "provider": "deepseek", "temperature": 0.3},
        tools=[DbTools, MarketTools],
    )
