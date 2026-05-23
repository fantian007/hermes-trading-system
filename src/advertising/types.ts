/**
 * Advertising Notification Generator — Types
 *
 * 广告通知生成器的所有类型定义。
 * 上游（分析模块）→ 模板渲染 → 渠道适配器 → 飞书/邮件/推送
 */

// ═══════════════════════════════════════════════════════════════════
//  分析结果输入（由 t_b43bd599 海龟分析模块产出）
// ═══════════════════════════════════════════════════════════════════

export interface TurtleAnalysisResult {
  /** 股票代码，如 "AAPL.US" */
  symbol: string;
  /** 分析时间戳 (ISO 8601) */
  timestamp: string;

  // ── 价格数据 ──
  /** 当前价格 */
  currentPrice: number;
  /** 上一交易日收盘价 */
  prevClose?: number;

  // ── 海龟入场信号 ──
  /** 20 日最高价（突破即做多） */
  entry20High: number;
  /** 55 日最高价（更强的入场信号） */
  entry55High: number;

  // ── 海龟离场信号 ──
  /** 10 日最低价（跌破即离场） */
  exit10Low: number;
  /** 20 日最低价 */
  exit20Low: number;

  // ── 风险指标 ──
  /** 14 日 ATR（平均真实波幅） */
  atr: number;
  /** N 值 = ATR，用于头寸规模计算 */
  nValue: number;

  // ── 信号评估 ──
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  /** 信号强度 1-5 */
  signalStrength: number;
  /** 当前价是否突破 20 日高点 */
  isAboveEntry20: boolean;
  /** 当前价是否突破 55 日高点 */
  isAboveEntry55: boolean;
  /** 当前价是否跌破 10 日低点 */
  isBelowExit10: boolean;
  /** 当前价是否跌破 20 日低点 */
  isBelowExit20: boolean;

  // ── 头寸规模 ──
  /** 建议加仓单位数 1-4 */
  suggestedUnits: number;
  /** 美元波动性 = N × 合约乘数 */
  dollarVolatility: number;

  // ── 趋势判断 ──
  /** 趋势方向 */
  trendDirection?: 'UP' | 'DOWN' | 'SIDEWAYS';
  /** 当前是否处于多头市场（价格 > 25 日均线） */
  isBullMarket?: boolean;

  // ── 可选备注 ──
  /** 分析备注 */
  notes?: string;
  /** 上次行动 */
  lastAction?: string;
}

/** 行情快照 — 无海龟信号的纯行情数据 */
export interface QuoteSnapshot {
  symbol: string;
  price: number;
  change: number;         // 涨跌额
  changePct: number;      // 涨跌幅 %
  volume?: number;
  high?: number;
  low?: number;
  timestamp: string;
}

// ═══════════════════════════════════════════════════════════════════
//  通知类型枚举
// ═══════════════════════════════════════════════════════════════════

export type NotificationType =
  | 'TURTLE_SIGNAL'        // 海龟交易信号（BUY/SELL 入场/离场）
  | 'TURTLE_DETAIL'        // 详细海龟分析卡
  | 'PORTFOLIO_SUMMARY'    // 持仓汇总
  | 'BATCH_SCAN'           // 批量扫描结果（多只股票）
  | 'QUOTE_ALERT'          // 价格异动提醒
  | 'SYSTEM_STATUS'        // 系统状态（Agent 变更、熔断等）
  | 'GENERIC';             // 通用文本通知

// ═══════════════════════════════════════════════════════════════════
//  渠道类型
// ═══════════════════════════════════════════════════════════════════

export type ChannelType = 'feishu_card' | 'feishu_text' | 'console';

// ═══════════════════════════════════════════════════════════════════
//  通知负载（模板渲染后、发送前的标准化格式）
// ═══════════════════════════════════════════════════════════════════

export interface NotificationPayload {
  /** 通知类型 */
  type: NotificationType;
  /** 卡片标题（emoji + 简短描述） */
  title: string;
  /** 来源标识（部门 emoji + 部门名 + 工号） */
  source: string;
  /** 卡片颜色 */
  color: 'green' | 'blue' | 'orange' | 'red' | 'purple' | 'grey';
  /** 卡片正文 Markdown */
  body: string;
  /** 优先级 0-10（10 最高，用于熔断等紧急通知） */
  priority?: number;
  /** 关联的股票代码 */
  symbol?: string;
  /** 原始分析数据（调试用，不发送） */
  _raw?: unknown;
}

// ═══════════════════════════════════════════════════════════════════
//  发送结果
// ═══════════════════════════════════════════════════════════════════

export interface SendResult {
  success: boolean;
  channel: ChannelType;
  messageId?: string;
  error?: string;
  attempts: number;
  durationMs: number;
}

// ═══════════════════════════════════════════════════════════════════
//  渠道适配器接口
// ═══════════════════════════════════════════════════════════════════

export interface ChannelAdapter {
  /** 渠道类型标识 */
  readonly type: ChannelType;
  /** 发送一条通知，返回 message_id 或 undefined */
  send(payload: NotificationPayload): Promise<string | undefined>;
  /** 健康检查 */
  healthCheck(): Promise<boolean>;
}

// ═══════════════════════════════════════════════════════════════════
//  重试配置
// ═══════════════════════════════════════════════════════════════════

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_RETRY: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10_000,
};

// ═══════════════════════════════════════════════════════════════════
//  广告模块配置
// ═══════════════════════════════════════════════════════════════════

export interface AdvertisingConfig {
  /** 启用的渠道列表 */
  channels: ChannelType[];
  /** 重试配置 */
  retry: RetryConfig;
  /** 默认卡片颜色 */
  defaultColor: 'green' | 'blue' | 'orange' | 'red' | 'purple' | 'grey';
}

export const DEFAULT_AD_CONFIG: AdvertisingConfig = {
  channels: ['feishu_card'],
  retry: DEFAULT_RETRY,
  defaultColor: 'blue',
};
