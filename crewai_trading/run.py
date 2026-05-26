"""
启动入口

python run.py           # 前台运行（Ctrl+C停止）
python run.py --daemon  # 后台守护进程模式
"""

import sys
import time
import signal
import logging
from typing import NoReturn

from crewai_trading.crew.ceo_loop import CEOMainLoop


def setup_logging() -> None:
    """配置日志格式。"""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler("ceo_loop.log", mode="a", encoding="utf-8"),
        ],
    )


def main() -> NoReturn:
    """启动主入口。"""
    setup_logging()
    logger = logging.getLogger("main")

    daemon_mode = "--daemon" in sys.argv

    logger.info("=" * 60)
    logger.info("🤖 Hermes 交易系统启动")
    logger.info(f"   模式: {'守护进程' if daemon_mode else '前台'}")
    logger.info("=" * 60)

    loop = CEOMainLoop()

    # 注册信号处理（安全退出）
    def _signal_handler(signum, frame):
        logger.info(f"收到信号 {signum}，正在停止...")
        loop.stop()

    signal.signal(signal.SIGINT, _signal_handler)
    signal.signal(signal.SIGTERM, _signal_handler)

    if daemon_mode:
        # 后台模式 — fork 子进程
        pid = _daemonize()
        if pid > 0:
            logger.info(f"守护进程已启动，PID={pid}")
            sys.exit(0)
        # 子进程继续运行

    try:
        loop.run()
    except Exception as exc:
        logger.critical(f"💥 系统崩溃: {exc}", exc_info=True)
        sys.exit(1)
    finally:
        logger.info("系统已停止")
        sys.exit(0)


def _daemonize() -> int:
    """创建守护进程。返回子进程PID（父进程）或0（子进程）。"""
    try:
        pid = _fork()
        if pid > 0:
            return pid  # 父进程退出
        # 子进程继续
        _setsid()  # 创建新会话
        _fork()  # 二次fork防止获取终端
        return 0
    except Exception as exc:
        logging.getLogger("main").error(f"守护进程化失败: {exc}")
        return -1


def _fork() -> int:
    """跨平台fork封装。"""
    import os
    return os.fork()


def _setsid() -> None:
    """创建新会话。"""
    import os
    os.setsid()


if __name__ == "__main__":
    main()
