/**
 * 数据库 Schema — Phase 1 MVP
 *
 * 所有表均使用 TEXT 主键（业务 ID），方便分布式扩展。
 * 包含约束、索引、以及建表后的初始种子数据插入。
 */

/* ================================================================
   表1: agents — 员工档案
   ================================================================ */
CREATE TABLE IF NOT EXISTS agents (
  agent_id          TEXT PRIMARY KEY,          -- 工号 "AGT-0001"，永不回收
  agent_name        TEXT NOT NULL,             -- 策略名称
  profile_name      TEXT NOT NULL,             -- Hermes profile 名
  strategy_source   TEXT NOT NULL DEFAULT '',   -- 策略来源书籍/课程
  strategy_summary  TEXT NOT NULL DEFAULT '',   -- 核心概念摘要 (≤100字)
  indicators        TEXT,                      -- JSON 数组 ["bollinger","rsi"]
  status            TEXT NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE','SHADOW','TERMINATED')),
  win_count         INTEGER NOT NULL DEFAULT 0,
  total_trades      INTEGER NOT NULL DEFAULT 0,
  win_rate          REAL    NOT NULL DEFAULT 0.0,
  win_rate_recent_5 REAL    NOT NULL DEFAULT 0.0,
  joined_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  terminated_at     TEXT,
  last_vote_at      TEXT,
  created_by        TEXT    NOT NULL DEFAULT 'system'
);

/* ================================================================
   表2: agent_status_log — 人事变动流水
   ================================================================ */
CREATE TABLE IF NOT EXISTS agent_status_log (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id          TEXT NOT NULL REFERENCES agents(agent_id),
  from_status       TEXT NOT NULL,
  to_status         TEXT NOT NULL,
  reason            TEXT NOT NULL DEFAULT '',
  triggered_by      TEXT NOT NULL DEFAULT 'AUDITOR',
  related_trade_id  TEXT,
  changed_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_status_log_agent
  ON agent_status_log(agent_id, changed_at);

/* ================================================================
   表3: trades — 交易主表
   ================================================================ */
CREATE TABLE IF NOT EXISTS trades (
  trade_id          TEXT PRIMARY KEY,           -- "TRD-20260521-001"
  symbol            TEXT NOT NULL,              -- "NVDA.US"
  direction         TEXT NOT NULL DEFAULT 'LONG'
                    CHECK (direction IN ('LONG','SHORT')),
  buy_price         REAL NOT NULL,
  sell_price        REAL,
  quantity          INTEGER NOT NULL,
  pnl               REAL,
  pnl_pct           REAL,
  buy_time          TEXT NOT NULL DEFAULT (datetime('now')),
  sell_time         TEXT,
  hold_duration_s   INTEGER,
  approved_by       TEXT NOT NULL,              -- election round_id
  status            TEXT NOT NULL DEFAULT 'OPEN'
                    CHECK (status IN ('OPEN','CLOSED','CANCELLED')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at         TEXT
);

CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol, created_at);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);

/* ================================================================
   表4: agent_votes — 每次投票记录
   ================================================================ */
CREATE TABLE IF NOT EXISTS agent_votes (
  vote_id           TEXT PRIMARY KEY,          -- "VOTE-..."
  trade_id          TEXT NOT NULL REFERENCES trades(trade_id),
  agent_id          TEXT NOT NULL REFERENCES agents(agent_id),
  vote_node         TEXT NOT NULL CHECK (vote_node IN ('BUY','SELL')),
  vote_direction    TEXT NOT NULL CHECK (vote_direction IN ('BUY','SELL','HOLD')),
  confidence        REAL NOT NULL DEFAULT 0.5,
  reasoning         TEXT NOT NULL DEFAULT '',
  raw_analysis      TEXT,
  voted_at          TEXT NOT NULL DEFAULT (datetime('now')),
  is_shadow         INTEGER NOT NULL DEFAULT 0,
  UNIQUE(trade_id, agent_id, vote_node)
);

CREATE INDEX IF NOT EXISTS idx_votes_agent ON agent_votes(agent_id, voted_at);
CREATE INDEX IF NOT EXISTS idx_votes_trade ON agent_votes(trade_id);

/* ================================================================
   表5: win_reports — 胜负上报
   ================================================================ */
CREATE TABLE IF NOT EXISTS win_reports (
  report_id           TEXT PRIMARY KEY,
  trade_id            TEXT NOT NULL REFERENCES trades(trade_id),
  agent_id            TEXT NOT NULL REFERENCES agents(agent_id),
  result              TEXT NOT NULL CHECK (result IN ('WIN','LOSE','MISS')),
  buy_vote_match      INTEGER NOT NULL DEFAULT 0,
  sell_vote_match     INTEGER NOT NULL DEFAULT 0,
  self_reported_at    TEXT NOT NULL DEFAULT (datetime('now')),
  auditor_verified_at TEXT,
  self_reflection     TEXT,                    -- JSON: trait_updates + note
  UNIQUE(trade_id, agent_id)
);

/* ================================================================
   表6: election_rounds — 选举轮次记录
   ================================================================ */
CREATE TABLE IF NOT EXISTS election_rounds (
  round_id            TEXT PRIMARY KEY,         -- "ELEC-20260521-1430"
  symbol              TEXT NOT NULL,
  total_voters        INTEGER NOT NULL DEFAULT 0,
  buy_votes           INTEGER NOT NULL DEFAULT 0,
  sell_votes          INTEGER NOT NULL DEFAULT 0,
  hold_votes          INTEGER NOT NULL DEFAULT 0,
  final_decision      TEXT NOT NULL DEFAULT 'HOLD'
                      CHECK (final_decision IN ('BUY','SELL','HOLD')),
  decision_confidence REAL NOT NULL DEFAULT 0.0,
  resulted_trade_id   TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  executed_at         TEXT
);

/* ================================================================
   表7: stock_pool — 候选股池
   ================================================================ */
CREATE TABLE IF NOT EXISTS stock_pool (
  symbol        TEXT NOT NULL,
  signal_type   TEXT NOT NULL CHECK (signal_type IN ('BULLISH','BEARISH')),
  strength      INTEGER NOT NULL DEFAULT 1 CHECK (strength BETWEEN 1 AND 5),
  source        TEXT NOT NULL DEFAULT '',
  reason        TEXT NOT NULL DEFAULT '',
  source_url    TEXT,
  agent_id      TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'ACTIVE'
                CHECK (status IN ('ACTIVE','EXPIRED','REMOVED')),
  added_at      TEXT NOT NULL DEFAULT (datetime('now')),
  removed_at    TEXT,
  PRIMARY KEY (symbol, agent_id, added_at)
);

CREATE INDEX IF NOT EXISTS idx_pool_status ON stock_pool(status, symbol);

/* ================================================================
   表8: agent_traits — Agent 人格持久化
   ================================================================ */
CREATE TABLE IF NOT EXISTS agent_traits (
  agent_id      TEXT NOT NULL REFERENCES agents(agent_id),
  trait_key     TEXT NOT NULL,
  trait_value   TEXT NOT NULL,
  trait_type    TEXT NOT NULL DEFAULT 'PATTERN'
                CHECK (trait_type IN ('NUMBER','CATEGORY','PATTERN','HISTORY')),
  confidence    REAL NOT NULL DEFAULT 0.5,
  last_updated  TEXT NOT NULL DEFAULT (datetime('now')),
  sample_count  INTEGER NOT NULL DEFAULT 1,
  UNIQUE(agent_id, trait_key)
);

/* ================================================================
   表9: strategy_signatures — 策略签名去重
   ================================================================ */
CREATE TABLE IF NOT EXISTS strategy_signatures (
  agent_id        TEXT PRIMARY KEY REFERENCES agents(agent_id),
  source_book     TEXT NOT NULL DEFAULT '',
  core_concept    TEXT NOT NULL DEFAULT '',
  indicators_used TEXT NOT NULL DEFAULT '',
  market_scope    TEXT NOT NULL DEFAULT 'US'
);

/* ================================================================
   表11: review_reports — 审核部门审核报告
   ================================================================ */
CREATE TABLE IF NOT EXISTS review_reports (
  report_id         TEXT PRIMARY KEY,              -- "REV-20260521-001"
  trade_id          TEXT NOT NULL REFERENCES trades(trade_id),
  agent_id          TEXT NOT NULL REFERENCES agents(agent_id),
  verdict           TEXT NOT NULL CHECK (verdict IN ('PASS','WARN','FAIL')),
  reasoning         TEXT NOT NULL DEFAULT '',
  review_framework  TEXT NOT NULL DEFAULT '',       -- e.g. "均线交叉审核框架"
  reviewed_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(trade_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_review_reports_trade
  ON review_reports(trade_id, reviewed_at);

/* ================================================================
   表13: departments — 部门组织架构
   ================================================================ */
CREATE TABLE IF NOT EXISTS departments (
  dept_id           TEXT PRIMARY KEY,              -- "DPT-001"
  dept_name         TEXT NOT NULL UNIQUE,          -- "选股部门"
  dept_desc         TEXT NOT NULL DEFAULT '',       -- 部门职责描述
  leader_agent_id   TEXT NOT NULL REFERENCES agents(agent_id),  -- 组长工号
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  created_by        TEXT NOT NULL DEFAULT 'system'
);

/* ================================================================
   表12: daily_ledger — 每日风控账簿
   ================================================================ */
CREATE TABLE IF NOT EXISTS daily_ledger (
  date            TEXT PRIMARY KEY,             -- "2026-05-21"
  trade_count     INTEGER NOT NULL DEFAULT 0,
  total_pnl       REAL    NOT NULL DEFAULT 0.0,
  peak_equity     REAL    NOT NULL DEFAULT 0.0,
  trough_equity   REAL    NOT NULL DEFAULT 0.0,
  max_drawdown    REAL    NOT NULL DEFAULT 0.0,
  melted          INTEGER NOT NULL DEFAULT 0,   -- 是否触发熔断
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
