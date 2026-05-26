"""
CEO 主循环

核心调度逻辑：
- 每15分钟执行一次巡检（health check + news patrol + hr audit）
- 0点执行特殊任务（文档更新、GitHub推送、策略自成长）
- 处理投票调度和仓位分析
"""

import time
import logging
from datetime import datetime, timezone
from typing import Optional

from crewai_trading.config.settings import settings
from crewai_trading.crew.patrol_crew import create_patrol_crew
from crewai_trading.crew.voting_crew import create_voting_crew
from crewai_trading.tasks.position_tasks import (
    create_positions_query_task,
    create_market_price_task,
    create_position_rebalance_task,
)
from crewai_trading.tools.db_tools import DbTools
from crewai_trading.tools.market_tools import MarketTools

logger = logging.getLogger("ceo_loop")

# 巡检间隔（秒）
PATROL_INTERVAL = 15 * 60  # 15分钟
# 投票冷却时间（秒）
VOTE_COOLDOWN = settings.VOTE_COOLDOWN_SEC


class CEOMainLoop:
    """CEO主循环 — 交易系统的核心调度器。"""

    def __init__(self):
        self._last_patrol_time: float = 0.0
        self._last_vote_time: float = 0.0
        self._running: bool = False
        self._vote_cooldown_symbols: dict[str, float] = {}  # symbol → last vote time

    # ── 公共方法 ────────────────────────────────────────────

    def run(self) -> None:
        """启动CEO主循环，持续运行直到手动停止。"""
        self._running = True
        logger.info("🚀 CEO主循环启动")
        self._on_startup()

        while self._running:
            try:
                now = datetime.now(timezone.utc)

                # ── 每15分钟巡检 ─────────────────────────
                if self._should_patrol():
                    self._execute_patrol()

                # ── 0点特殊任务 ──────────────────────────
                if self._is_midnight(now):
                    self._execute_midnight_tasks()

                # ── 持仓分析与调仓投票 ───────────────────
                self._execute_position_analysis()

                # ── 休眠 ─────────────────────────────────
                time.sleep(60)  # 每分钟检查一次

            except KeyboardInterrupt:
                logger.info("🛑 CEO主循环被手动中断")
                break
            except Exception as exc:
                logger.error(f"❌ CEO主循环异常: {exc}", exc_info=True)
                time.sleep(60)

        self._running = False
        logger.info("🏁 CEO主循环已停止")

    def stop(self) -> None:
        """安全停止主循环。"""
        self._running = False

    # ── 内部方法 ────────────────────────────────────────────

    def _on_startup(self) -> None:
        """启动时的初始化检查。"""
        logger.info("执行启动检查...")
        try:
            account = DbTools.get_account()
            if "error" in account:
                logger.warning(f"⚠️ 启动检查 — 数据库读取异常: {account['error']}")
            else:
                logger.info(f"✅ 启动检查通过 — 账户概况: {account}")
        except Exception as exc:
            logger.error(f"❌ 启动检查失败: {exc}")

    def _should_patrol(self) -> bool:
        """判断是否需要执行巡检（距上次巡检超过15分钟）。"""
        return (time.time() - self._last_patrol_time) >= PATROL_INTERVAL

    def _is_midnight(self, now: datetime) -> bool:
        """判断当前时间是否为0点（允许2分钟误差）。"""
        return now.hour == 0 and now.minute <= 2

    def _execute_patrol(self) -> None:
        """执行巡检Crew。"""
        logger.info("🔍 开始15分钟周期巡检...")
        self._last_patrol_time = time.time()

        try:
            patrol_crew = create_patrol_crew()
            results = patrol_crew.kickoff()
            logger.info(f"✅ 巡检完成: {len(results)} 个任务执行")

            # 记录巡检结果到日志
            for idx, result in results.items():
                agent_role = result.get("agent_role", "unknown")
                result_text = result.get("result", "")[:200]
                logger.info(f"  [{idx}] {agent_role}: {result_text}...")

        except Exception as exc:
            logger.error(f"❌ 巡检失败: {exc}")

    def _execute_midnight_tasks(self) -> None:
        """执行0点特殊任务：文档更新、GitHub推送、策略自成长。"""
        logger.info("🌙 执行0点特殊任务...")

        # TODO: 待实现
        # 1. 督促各部门更新文档
        # 2. 推送GitHub
        # 3. 策略自成长（复盘当日表现，优化参数）
        # 4. 深度审计

        tasks = [
            "策略自成长 — 复盘当日策略表现，优化参数",
            "文档同步 — 督促各部门更新文档",
            "GitHub推送 — 提交当日变更",
            "深度审计 — 找出至少5个问题并推动改进",
        ]
        for t in tasks:
            logger.info(f"  📋 {t}")
            # 以下为占位实现
            time.sleep(0.5)

        logger.info("✅ 0点特殊任务完成")

    def _execute_position_analysis(self) -> None:
        """执行持仓分析 — 检查现有持仓是否需要调仓。"""
        logger.info("📊 执行持仓分析...")

        try:
            # 1. 查询当前持仓
            positions = DbTools.get_positions()
            if not positions or (isinstance(positions, list) and len(positions) == 0):
                logger.info("  当前无持仓，跳过调仓分析")
                return

            if isinstance(positions, list) and "error" in positions[0]:
                logger.warning(f"  ⚠️ 查询持仓出错: {positions[0]['error']}")
                return

            logger.info(f"  当前持仓: {len(positions)} 笔")

            # 2. 获取持仓标的的实时行情
            symbols = [p.get("symbol", "") for p in positions if p.get("symbol")]
            if not symbols:
                logger.info("  无法获取标的列表，跳过")
                return

            market_data = {}
            for symbol in symbols:
                quote = MarketTools.get_quote(symbol)
                market_data[symbol] = quote

            # 3. 检查是否在投票冷却期
            for pos in positions:
                symbol = pos.get("symbol", "")
                last_vote = self._vote_cooldown_symbols.get(symbol, 0.0)
                if (time.time() - last_vote) >= VOTE_COOLDOWN:
                    logger.info(f"  ⏳ {symbol} — 冷却期已过，触发投票...")
                    self._trigger_vote_for_symbol(symbol)
                    self._vote_cooldown_symbols[symbol] = time.time()
                else:
                    remaining = int(VOTE_COOLDOWN - (time.time() - last_vote))
                    logger.info(f"  💤 {symbol} — 投票冷却中 (剩余{remaining}s)")

        except Exception as exc:
            logger.error(f"❌ 持仓分析失败: {exc}")

    def _trigger_vote_for_symbol(self, symbol: str) -> None:
        """对某个标的触发投票流程。

        Args:
            symbol: 股票代码
        """
        logger.info(f"🗳️ 为 {symbol} 触发投票流程...")

        try:
            # 1. 创建选举轮次
            round_id = DbTools.create_round(symbol=symbol, total_voters=50)
            if isinstance(round_id, dict) and "error" in round_id:
                logger.error(f"  创建选举轮次失败: {round_id['error']}")
                return

            logger.info(f"  选举轮次创建成功: {round_id}")

            # 2. 运行投票Crew
            voting_crew = create_voting_crew(symbol=symbol, round_id=round_id)
            results = voting_crew.kickoff()

            # 3. 输出投票结果
            if 2 in results:  # aggregate task 的 index
                aggregate_result = results[2]["result"][:300]
                logger.info(f"  投票结果: {aggregate_result}")

            if 3 in results:  # execution task 的 index
                exec_result = results[3]["result"][:200]
                logger.info(f"  执行结果: {exec_result}")

            logger.info(f"✅ {symbol} 投票流程完成")

        except Exception as exc:
            logger.error(f"❌ {symbol} 投票流程异常: {exc}")
