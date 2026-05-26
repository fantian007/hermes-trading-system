"""
巡检Crew定义

流程：CEO→舆情→HR→广告
"""

from typing import List

from crewai_trading.core.crew_base import Crew
from crewai_trading.core.base_agent import Agent
from crewai_trading.core.base_task import Task
from crewai_trading.agents.ceo_agent import create_ceo_agent
from crewai_trading.agents.sentiment_agent import create_sentiment_agent
from crewai_trading.agents.hr_agent import create_hr_agent
from crewai_trading.agents.advertising_agent import create_advertising_agent
from crewai_trading.tasks.patrol_tasks import (
    create_health_check_task,
    create_news_patrol_task,
    create_hr_performance_task,
)


def create_patrol_crew() -> Crew:
    """创建巡检Crew。

    流程：
    1. CEO执行系统健康检查
    2. 舆情部门执行新闻巡检
    3. HR执行绩效审计
    4. 广告部门汇总并发送通知（如有异常）
    """
    ceo_agent: Agent = create_ceo_agent()
    sentiment_agent: Agent = create_sentiment_agent()
    hr_agent: Agent = create_hr_agent()
    adv_agent: Agent = create_advertising_agent()

    # ── 步骤1: CEO健康检查 ─────────────────────────────────
    health_task = create_health_check_task()

    # ── 步骤2: 舆情新闻巡检 ────────────────────────────────
    news_task = create_news_patrol_task()

    # ── 步骤3: HR绩效审计 ──────────────────────────────────
    hr_task = create_hr_performance_task()

    # ── 步骤4: 异常汇总与通知 ──────────────────────────────
    alert_task = Task(
        description=(
            "SUMMARIZE_AND_NOTIFY\n"
            "1. 获取前面所有巡检步骤的结果。\n"
            "2. 汇总系统健康状态、舆情动态、绩效报告。\n"
            "3. 如果有任何异常/告警需要对外通知，调用 FeishuTools.send_message() 发送。\n"
            "4. 返回本次巡检汇总报告。"
        ),
        agent=adv_agent,
        expected_output="patrol summary report with any notifications sent",
    )

    tasks: List[Task] = [health_task, news_task, hr_task, alert_task]
    agents: List[Agent] = [ceo_agent, sentiment_agent, hr_agent, adv_agent]

    return Crew(
        agents=agents,
        tasks=tasks,
        process="sequential",
        verbose=True,
    )
