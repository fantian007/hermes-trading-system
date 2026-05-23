// ===== Agent Status =====
export type AgentStatus = 'ACTIVE' | 'SHADOW' | 'TERMINATED';

// ===== Trade Direction =====
export type TradeDirection = 'LONG' | 'SHORT';
export type TradeStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';

// ===== Vote Types =====
export type VoteNode = 'BUY' | 'SELL';
export type VoteDirection = 'BUY' | 'SELL' | 'HOLD';
export type WinResult = 'WIN' | 'LOSE' | 'MISS';

// ===== Signal Types =====
export type SignalType = 'BULLISH' | 'BEARISH';
export type SignalSource = 'PRICE_BREAKOUT' | 'LONGBRIDGE_NEWS' | 'WEIBO_TRENDING' | 'XUEQIU_HOT' | 'UNKNOWN';

// ===== Trigger Types =====
export type TriggerType = 'PRICE_BREAKOUT' | 'NEWS_CATALYST' | 'SOCIAL_BUZZ' | 'STOP_LOSS' | 'TAKE_PROFIT';

// ===== Trait Types =====
export type TraitType = 'NUMBER' | 'CATEGORY' | 'PATTERN' | 'HISTORY';

// ===== Order Types =====
export type OrderSide = 'BUY' | 'SELL';
export type OrderTypeT = 'MARKET' | 'LIMIT';
export type OrderStatusT = 'PENDING' | 'FILLED' | 'PARTIALLY_FILLED' | 'REJECTED' | 'CANCELLED';

// ===== DB Models =====

export interface Agent {
  agent_id: string;           // PK: "AGT-0001"
  agent_name: string;         // "均值回归-布林带"
  profile_name: string;       // Hermes profile name
  strategy_source: string;    // e.g. "《海龟交易法则》"
  strategy_summary: string;   // Core concept (≤100 chars)
  indicators: string | null;  // JSON array of indicator tags
  status: AgentStatus;
  win_count: number;
  total_trades: number;
  win_rate: number;
  win_rate_recent_5: number;
  joined_at: string;          // ISO timestamp
  terminated_at: string | null;
  last_vote_at: string | null;
  created_by: string;
}

export interface AgentStatusLog {
  id: number;
  agent_id: string;
  from_status: AgentStatus;
  to_status: AgentStatus;
  reason: string;
  triggered_by: string;       // "AUDITOR" | "SHADOW_COMPLETE" | "RANKING_ELIMINATION"
  related_trade_id: string | null;
  changed_at: string;
}

export interface Trade {
  trade_id: string;           // PK: "TRD-20260521-001"
  symbol: string;
  direction: TradeDirection;
  buy_price: number;
  sell_price: number | null;
  quantity: number;
  pnl: number | null;
  pnl_pct: number | null;
  buy_time: string;
  sell_time: string | null;
  hold_duration_s: number | null;
  approved_by: string;        // election round_id
  status: TradeStatus;
  created_at: string;
  closed_at: string | null;
}

export interface AgentVote {
  vote_id: string;            // PK
  trade_id: string;
  agent_id: string;
  vote_node: VoteNode;
  vote_direction: VoteDirection;
  confidence: number;         // 0.0 ~ 1.0
  reasoning: string;
  raw_analysis: string | null;
  voted_at: string;
  is_shadow: boolean;
}

export interface WinReport {
  report_id: string;          // PK
  trade_id: string;
  agent_id: string;
  result: WinResult;
  buy_vote_match: boolean;
  sell_vote_match: boolean;
  self_reported_at: string;
  auditor_verified_at: string | null;
  self_reflection: string | null;  // JSON
}

export interface ElectionRound {
  round_id: string;           // PK: "ELEC-20260521-1430"
  symbol: string;
  total_voters: number;
  buy_votes: number;
  sell_votes: number;
  hold_votes: number;
  final_decision: VoteDirection;
  decision_confidence: number;
  resulted_trade_id: string | null;
  created_at: string;
  executed_at: string | null;
}

export interface StockPoolItem {
  symbol: string;
  signal_type: SignalType;
  strength: number;           // 1-5
  source: string;
  reason: string;
  source_url: string | null;
  agent_id: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REMOVED';
  added_at: string;
  removed_at: string | null;
}

export interface AgentTrait {
  agent_id: string;
  trait_key: string;
  trait_value: string;
  trait_type: TraitType;
  confidence: number;
  last_updated: string;
  sample_count: number;
}

export interface StrategySignature {
  agent_id: string;
  source_book: string;
  core_concept: string;
  indicators_used: string;
  market_scope: string;
}

// ===== Onboarding Types =====

export interface Department {
  dept_id: string;           // "DPT-001"
  dept_name: string;         // "选股部门"
  dept_desc: string;         // 部门职责描述
  leader_agent_id: string;   // 组长工号
  created_at: string;
  created_by: string;
}

// ===== Protocol Types =====

export interface VoteRequest {
  round_id: string;
  symbol: string;
  trigger_type: TriggerType;
  trigger_detail: string;
  current_price: number;
  signals: Array<{ source: string; strength: number }>;
  vote_node: VoteNode;
  deadline_seconds: number;
}

export interface VoteResponse {
  agent_id: string;
  round_id: string;
  vote_direction: VoteDirection;
  confidence: number;
  reasoning: string;
  analysis_detail?: string;
}

export interface VoteSummary {
  round_id: string;
  symbol: string;
  vote_node: VoteNode;
  total_voters: number;
  results: {
    buy: { count: number; weighted: number };
    sell: { count: number; weighted: number };
    hold: { count: number; weighted: number };
  };
  winning_direction: VoteDirection;
  winning_confidence: number;
  individual_vote_ids: string[];
}

export interface ExecutionDecision {
  round_id: string;
  symbol: string;
  action: VoteDirection;
  quantity: number;
  order_type: OrderTypeT;
  reason: string;
}

export interface TradeBroadcast {
  trade_id: string;
  symbol: string;
  buy_price: number;
  sell_price: number;
  pnl: number;
  pnl_pct: number;
  buy_time: string;
  sell_time: string;
  approved_by: string;
}

export interface WinReportRequest {
  agent_id: string;
  trade_id: string;
  result: WinResult;
  buy_vote_match: boolean;
  sell_vote_match: boolean;
  self_reflection?: {
    trait_updates?: Array<{ key: string; value: string; confidence: number }>;
    note?: string;
  };
}

// ===== Stock Pool Types =====

export interface StockPoolStock {
  symbol: string;
  name: string | null;          // 股票名称（如 "NVIDIA CORP"）
  signal_count: number;
  aggregate: {
    bullish_signals: number;
    bearish_signals: number;
    total_strength: number;
    avg_strength: number;
  };
  signals: Array<{
    agent_id: string;
    signal_type: string;
    strength: number;
    source: string;
    reason: string;
    added_at: string;
  }>;
  quote?: {
    last: number;
    change_pct: number;
    volume: number;
    prev_close: number;
    high: number;
    low: number;
  };
}

export interface StockPoolResult {
  pool_size: number;
  unique_symbols: string[];
  stocks: StockPoolStock[];
  generated_at: string;
}

export interface StockSignal {
  symbol: string;
  signal_type: SignalType;
  strength: number;
  source: string;
  reason: string;
  source_url?: string;
  agent_id: string;
}

// ===== Config =====

export interface AppConfig {
  totalAsset: number;
  maxPositionPct: number;
  minCashReserve: number;
  maxDailyTrades: number;
  maxLossPerTrade: number;
  maxDrawdownDaily: number;
  minVoters: number;
  holdRatioMax: number;
  directionThreshold: number;
  scanIntervalSec: number;
  voteCooldownSec: number;
  commission: number;
}
