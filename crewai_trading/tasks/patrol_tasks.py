"""
巡检 Task 定义

包括：CEO健康检查、新闻巡检。
"""

from crewai_trading.core.base_task import Task
from crewai_trading.agents.ceo_agent import create_ceo_agent
from crewai_trading.agents.sentiment_agent import create_sentiment_agent

_ceo_agent = create_ceo_agent()
_sentiment_agent = create_sentiment_agent()


def create_health_check_task() -> Task:
    """CEO 系统健康检查 — 每15分钟执行一次。

    检查DB连通性、Agent状态、账户资金、持仓盈亏。
    """
    return Task(
        description=(
            "SYSTEM_HEALTH_CHECK\n"
            "1. 检查数据库连通性：调用 DbTools.get_account() 确认可以正常读取。\n"
            "2. 检查当前持仓：调用 DbTools.get_positions() 确认持仓无异常。\n"
            "3. 检查账户概况：调用 DbTools.get_account() 获取总资产/总盈亏/最大回撤。\n"
            "4. 若有异常（数据库不可用、回撤超限等），生成告警并返回。"
        ),
        agent=_ceo_agent,
        expected_output="system health report with any alerts",
    )


def create_news_patrol_task() -> Task:
    """新闻巡检 — 舆情部门每日(或每周期)执行。

    扫描候选股池的新闻，筛选高影响力事件。
    """
    return Task(
        description=(
            "NEWS_PATROL\n"
            "1. 调用 DbTools.get_pool(status='ACTIVE') 获取候选股池。\n"
            "2. 对池中每个symbol，调用 WebTools.search_news(symbol) 搜索最新新闻。\n"
            "3. 筛选出高影响力新闻（重大财报、政策变化、行业事件等）。\n"
            "4. 返回新闻摘要及可能影响的分析。"
        ),
        agent=_sentiment_agent,
        expected_output="news patrol report with high-impact events",
    )


def create_hr_performance_task() -> Task:
    """HR 绩效审计 — 每日/每周检查各部门 Agent 绩效。"""
    from crewai_trading.agents.hr_agent import create_hr_agent

    _hr_agent = create_hr_agent()
    return Task(
        description=(
            "HR_PERFORMANCE_AUDIT\n"
            "1. 审计各 Agent 的近期任务执行情况。\n"
            "2. 检查知识库更新状况。\n"
            "3. 输出绩效审计报告，标注异常Agent。\n"
            "4. 对于表现异常的 Agent，向 CEO 提出改进建议。"
        ),
        agent=_hr_agent,
        expected_output="performance audit report for all agents",
    )


def create_feishu_alert_task(message: str) -> Task:
    """发送飞书告警 — 广告部门执行。

    Args:
        message: 告警内容
    """
    from crewai_trading.agents.advertising_agent import create_advertising_agent

    _adv_agent = create_advertising_agent()
    return Task(
        description=(
            f"FEISHU_ALERT\n"
            f"Alert content: {message}\n"
            f"1. 对告警内容进行去重检查（避免重复发送相同告警）。\n"
            f"2. 调用 FeishuTools.send_message(text=message) 发送飞书消息。\n"
            f"3. 返回发送结果。"
        ),
        agent=_adv_agent,
        expected_output="feishu alert sent successfully or error",
    )
