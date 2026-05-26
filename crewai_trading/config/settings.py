"""
全局配置模块

从 .env 加载 DEEPSEEK_API_KEY, FEISHU_* 等环境变量，
提供统一的 settings 对象供全系统使用。
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# 项目根目录 (crewai_trading 的父目录)
PROJECT_ROOT = Path(__file__).resolve().parents[2]

# 加载 .env
dotenv_path = PROJECT_ROOT / ".env"
if dotenv_path.exists():
    load_dotenv(dotenv_path)


class Settings:
    """全局设置 — 从环境变量读取，提供默认值。"""

    # ── DeepSeek ────────────────────────────────────────────────
    DEEPSEEK_API_KEY: str = os.environ.get("DEEPSEEK_API_KEY", "")
    DEEPSEEK_BASE_URL: str = os.environ.get(
        "DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1"
    )
    LLM_MODEL: str = os.environ.get("LLM_MODEL", "deepseek-chat")
    LLM_TEMPERATURE: float = float(os.environ.get("LLM_TEMPERATURE", "0.7"))

    # ── Feishu ─────────────────────────────────────────────────
    FEISHU_APP_ID: str = os.environ.get("FEISHU_APP_ID", "")
    FEISHU_APP_SECRET: str = os.environ.get("FEISHU_APP_SECRET", "")
    FEISHU_CHAT_ID: str = os.environ.get("FEISHU_CHAT_ID", "")
    FEISHU_WEBHOOK_URL: str = os.environ.get("FEISHU_WEBHOOK_URL", "")

    # ── Longbridge ─────────────────────────────────────────────
    LONGBRIDGE_HTTP_URL: str = os.environ.get(
        "LONGBRIDGE_HTTP_URL", "https://openapi.longbridge.cn"
    )
    LONGBRIDGE_QUOTE_WS_URL: str = os.environ.get(
        "LONGBRIDGE_QUOTE_WS_URL", "wss://openapi-quote.longbridge.cn/v2"
    )
    LONGBRIDGE_TRADE_WS_URL: str = os.environ.get(
        "LONGBRIDGE_TRADE_WS_URL", "wss://openapi-trade.longbridge.cn/v2"
    )

    # ── 交易参数 ────────────────────────────────────────────────
    TOTAL_ASSET: float = float(os.environ.get("TOTAL_ASSET", "88000"))
    MAX_POSITION_PCT: float = float(os.environ.get("MAX_POSITION_PCT", "0.20"))
    MIN_CASH_RESERVE: float = float(os.environ.get("MIN_CASH_RESERVE", "0.10"))
    MAX_DAILY_TRADES: int = int(os.environ.get("MAX_DAILY_TRADES", "10"))
    MAX_LOSS_PER_TRADE: float = float(os.environ.get("MAX_LOSS_PER_TRADE", "0.05"))
    MAX_DRAWDOWN_DAILY: float = float(os.environ.get("MAX_DRAWDOWN_DAILY", "0.08"))

    # ── 选举阈值 ────────────────────────────────────────────────
    MIN_VOTERS: int = int(os.environ.get("MIN_VOTERS", "3"))
    HOLD_RATIO_MAX: float = float(os.environ.get("HOLD_RATIO_MAX", "0.50"))
    DIRECTION_THRESHOLD: float = float(os.environ.get("DIRECTION_THRESHOLD", "0.55"))

    # ── 盯盘 ────────────────────────────────────────────────────
    SCAN_INTERVAL_SEC: int = int(os.environ.get("SCAN_INTERVAL_SEC", "300"))
    VOTE_COOLDOWN_SEC: int = int(os.environ.get("VOTE_COOLDOWN_SEC", "1800"))
    COMMISSION: float = float(os.environ.get("COMMISSION", "2.00"))

    # ── DB ──────────────────────────────────────────────────────
    DB_PATH: str = os.environ.get("DB_PATH", "./data/trading.db")


# 单例
settings = Settings()
