/**
 * Advertising Templates — 通知文案模板
 *
 * 广告部门 ADV-001 自行设计排版，不依赖外部决策。
 * 每个模板函数接收原始数据，返回 NotificationPayload（标题、颜色、正文 Markdown）。
 *
 * 设计原则：
 *   绿色 = 做多/盈利     蓝色 = 日常/持仓     橙色 = 警告/影子期
 *   红色 = 离场/熔断     紫色 = 选举/投票     灰色 = 中性/信息
 */

import type {
  TurtleAnalysisResult,
  QuoteSnapshot,
  NotificationPayload,
  NotificationType,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════
//  工具函数
// ═══════════════════════════════════════════════════════════════════

/** 价格格式化（保留 2 位小数，带 $ 前缀） */
function $(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** 百分比格式化（保留 2 位，带符号） */
function pct(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${(n * 100).toFixed(2)}%`;
}

/** 纯数字百分比（不带符号判断，直接 "X.XX%"） */
function pctPlain(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

/** 现在时间 ISO 截断 */
function now(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

/** 错误模板 — 当上游数据不完整时 */
function errorPayload(
  symbol: string,
  reason: string,
  type: NotificationType,
): NotificationPayload {
  return {
    type,
    title: `⚠️ 数据异常`,
    source: '📢 广告部门 ADV-001',
    color: 'orange',
    body: [
      `**股票**: ${symbol}`,
      `**时间**: ${now()}`,
      `**原因**: ${reason}`,
      '',
      `> 上游分析模块返回数据不完整，请检查数据源。`,
    ].join('\n'),
    symbol,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  信号级别辅助
// ═══════════════════════════════════════════════════════════════════

function signalBadge(strength: number, signal: string): string {
  const bars = ['▁', '▂', '▃', '▄', '▅', '▆', '█'];
  const n = Math.min(strength, bars.length - 1);

  if (signal === 'BULLISH') return `🟢 做多 | 强度 ${bars[n]}`;
  if (signal === 'BEARISH') return `🔴 做空 | 强度 ${bars[n]}`;
  return `⚪ 中性 | 强度 ${bars[n]}`;
}

// ═══════════════════════════════════════════════════════════════════
//  模板 1：海龟交易信号（TURTLE_SIGNAL）
// ═══════════════════════════════════════════════════════════════════

export function renderTurtleSignal(r: TurtleAnalysisResult): NotificationPayload {
  const { symbol, signal, signalStrength } = r;

  if (
    typeof r.currentPrice !== 'number' ||
    typeof r.entry20High !== 'number' ||
    typeof r.atr !== 'number'
  ) {
    return errorPayload(symbol, '缺少价格/入场/ATR 数据', 'TURTLE_SIGNAL');
  }

  const isBuy = signal === 'BULLISH';
  const color = isBuy ? 'green' : signal === 'BEARISH' ? 'red' : 'blue';
  const titleEmoji = isBuy ? '🐢🔔' : signal === 'BEARISH' ? '🐢🔻' : '🐢';

  // 突破距离
  const dist20 = ((r.currentPrice - r.entry20High) / r.entry20High * 100);
  const dist55 = r.entry55High
    ? ((r.currentPrice - r.entry55High) / r.entry55High * 100)
    : null;

  const body = [
    `**${signalBadge(signalStrength, signal)}**`,
    '',
    '| 指标 | 数值 |',
    '|------|------|',
    `| 当前价格 | ${$(r.currentPrice)} |`,
    `| 20日高点 | ${$(r.entry20High)} (${pctPlain(dist20 / 100)}) |`,
    ...(dist55 !== null
      ? [`| 55日高点 | ${$(r.entry55High)} (${pctPlain(dist55 / 100)}) |`]
      : []),
    `| 10日低点 | ${$(r.exit10Low)} |`,
    `| 20日低点 | ${$(r.exit20Low)} |`,
    '',
    `| 风险指标 | 数值 |`,
    '|----------|------|',
    `| ATR(14) | ${$(r.atr)} |`,
    `| N 值 | ${$(r.nValue)} |`,
    `| 建议单位 | ${r.suggestedUnits}/4 |`,
    `| 美元波动 | ${$(r.dollarVolatility)} |`,
    '',
    ...(r.trendDirection
      ? [`> 📈 趋势: **${r.trendDirection}** ${r.isBullMarket ? '(多头市场)' : ''}`]
      : []),
    ...(r.notes ? [`> 📝 ${r.notes}`] : []),
    '',
    `⏰ 分析时间: ${r.timestamp.replace('T', ' ').slice(0, 19)}`,
  ].join('\n');

  return {
    type: 'TURTLE_SIGNAL',
    title: `${titleEmoji} ${isBuy ? '海龟入场信号' : signal === 'BEARISH' ? '海龟离场信号' : '海龟盯盘'} | ${symbol}`,
    source: '📢 广告部门 ADV-001',
    color,
    body,
    priority: isBuy ? 8 : signal === 'BEARISH' ? 9 : 5,
    symbol,
    _raw: r,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  模板 2：海龟详细分析卡（TURTLE_DETAIL）
// ═══════════════════════════════════════════════════════════════════

export function renderTurtleDetail(r: TurtleAnalysisResult): NotificationPayload {
  const { symbol } = r;

  if (typeof r.currentPrice !== 'number') {
    return errorPayload(symbol, '缺少当前价格', 'TURTLE_DETAIL');
  }

  const color = r.signal === 'BULLISH' ? 'green'
    : r.signal === 'BEARISH' ? 'red'
    : 'blue';

  const entryStatus = [
    r.isAboveEntry20 ? '✅ 突破 20 日高点' : '⏳ 未突破 20 日高点',
    r.isAboveEntry55 ? '✅ 突破 55 日高点' : '⏳ 未突破 55 日高点',
  ];

  const exitStatus = [
    r.isBelowExit10 ? '⚠️ 跌破 10 日低点（离场信号）' : '✔️ 站稳 10 日低点',
    r.isBelowExit20 ? '⚠️ 跌破 20 日低点' : '✔️ 站稳 20 日低点',
  ];

  const body = [
    `## 📋 ${symbol} 海龟交易分析`,
    '',
    '### 💰 价格与趋势',
    `| 指标 | 数值 |`,
    '|------|------|',
    `| 当前价 | ${$(r.currentPrice)} |`,
    `| 趋势 | ${r.trendDirection ?? '—'} |`,
    `| 市场状态 | ${r.isBullMarket ? '🐂 多头' : '🐻 非多头'} |`,
    '',
    '### 🚪 入场信号',
    `| 条件 | 状态 |`,
    '|------|------|',
    `| 20日突破 | ${entryStatus[0]} |`,
    `| 55日突破 | ${entryStatus[1]} |`,
    '',
    '### 🏃 离场信号',
    `| 条件 | 状态 |`,
    '|------|------|',
    `| 10日低点 | ${exitStatus[0]} |`,
    `| 20日低点 | ${exitStatus[1]} |`,
    '',
    '### 📐 头寸管理',
    `| 参数 | 数值 |`,
    '|------|------|',
    `| ATR(14) | ${$(r.atr)} |`,
    `| N 值 | ${$(r.nValue)} |`,
    `| 建议单位 | ${r.suggestedUnits}/4 |`,
    `| $波动 | ${$(r.dollarVolatility)}/单位 |`,
    '',
    ...(r.notes ? [`> 📝 ${r.notes}`, ''] : []),
    `⏰ ${r.timestamp.replace('T', ' ').slice(0, 19)}`,
  ].join('\n');

  return {
    type: 'TURTLE_DETAIL',
    title: `🐢📊 海龟分析详情 | ${symbol}`,
    source: '📢 广告部门 ADV-001',
    color,
    body,
    priority: 4,
    symbol,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  模板 3：持仓汇总（PORTFOLIO_SUMMARY）
// ═══════════════════════════════════════════════════════════════════

export interface PortfolioItem {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  signal?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  signalStrength?: number;
  suggestedUnits?: number;
}

export interface PortfolioSummary {
  items: PortfolioItem[];
  totalValue: number;
  dailyPnl: number;
  dailyPnlPct: number;
}

export function renderPortfolioSummary(s: PortfolioSummary): NotificationPayload {
  const color = s.dailyPnl >= 0 ? 'green' : 'red';
  const emoji = s.dailyPnl >= 0 ? '📈' : '📉';

  const rows = s.items.map((item) => {
    const sign = item.change >= 0 ? '+' : '';
    const sigIcon = item.signal === 'BULLISH' ? '🟢' : item.signal === 'BEARISH' ? '🔴' : '⚪';
    return `| ${item.symbol} | ${$(item.price)} | ${sign}${pct(item.changePct)} | ${sigIcon} ${item.signal ?? '—'} |`;
  });

  const body = [
    `## 💼 持仓快照`,
    '',
    `| 总市值 | 日盈亏 | 日盈亏% |`,
    '|--------|--------|---------|',
    `| ${$(s.totalValue)} | ${s.dailyPnl >= 0 ? '+' : ''}${$(s.dailyPnl)} | ${s.dailyPnl >= 0 ? '+' : ''}${pctPlain(s.dailyPnlPct)} |`,
    '',
    '### 📋 持仓明细',
    '| 代码 | 现价 | 涨跌 | 信号 |',
    '|------|------|------|------|',
    ...rows,
    '',
    `⏰ ${now()}`,
  ].join('\n');

  return {
    type: 'PORTFOLIO_SUMMARY',
    title: `${emoji} 持仓汇总 | ${s.items.length} 只`,
    source: '📢 广告部门 ADV-001',
    color,
    body,
    priority: 5,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  模板 4：批量扫描结果（BATCH_SCAN）
// ═══════════════════════════════════════════════════════════════════

export interface BatchScanItem {
  symbol: string;
  price: number;
  changePct: number;
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  signalStrength: number;
  note?: string;
}

export function renderBatchScan(
  items: BatchScanItem[],
  totalScanned: number,
): NotificationPayload {
  const signals = items.filter((i) => i.signal !== 'NEUTRAL');
  const buyCount = signals.filter((i) => i.signal === 'BULLISH').length;
  const sellCount = signals.filter((i) => i.signal === 'BEARISH').length;

  const hasSignals = buyCount > 0 || sellCount > 0;
  const color = hasSignals ? (buyCount > sellCount ? 'green' : 'orange') : 'blue';
  const emoji = hasSignals ? '🔍' : '✅';

  const rows = items.map((item) => {
    const sign = item.changePct >= 0 ? '+' : '';
    const sigIcon = item.signal === 'BULLISH' ? '🟢 BUY'
      : item.signal === 'BEARISH' ? '🔴 SELL'
      : '⚪ HOLD';
    const note = item.note ? ` ${item.note}` : '';
    return `| ${item.symbol} | ${$(item.price)} | ${sign}${pctPlain(item.changePct)} | ${sigIcon} (${item.signalStrength}/5) |${note}`;
  });

  const body = [
    `## 🔍 批量扫描结果`,
    '',
    `| 扫描总数 | 🟢 做多 | 🔴 做空 | ⚪ 中性 |`,
    '|----------|---------|---------|---------|',
    `| ${totalScanned} | ${buyCount} | ${sellCount} | ${totalScanned - buyCount - sellCount} |`,
    '',
    '### 📊 信号详情',
    '| 代码 | 现价 | 涨跌 | 信号 |',
    '|------|------|------|------|',
    ...rows,
    '',
    `⏰ ${now()} — 下次扫描 5 分钟后`,
  ].join('\n');

  return {
    type: 'BATCH_SCAN',
    title: `${emoji} 批量扫描 | ${totalScanned} 只 | ${signals.length} 个信号`,
    source: '📢 广告部门 ADV-001',
    color,
    body,
    priority: 5,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  模板 5：价格异动提醒（QUOTE_ALERT）
// ═══════════════════════════════════════════════════════════════════

export function renderQuoteAlert(
  q: QuoteSnapshot,
  threshold: number = 0.03,
): NotificationPayload {
  const isSurge = q.changePct > threshold;
  const isPlunge = q.changePct < -threshold;

  if (!isSurge && !isPlunge) {
    // No alert needed
    return {
      type: 'QUOTE_ALERT',
      title: `📊 ${q.symbol}`,
      source: '📢 广告部门 ADV-001',
      color: 'grey',
      body: `价格平稳: ${$(q.price)} (${pctPlain(q.changePct)})`,
      priority: 1,
    };
  }

  const color = isSurge ? 'green' : 'red';
  const emoji = isSurge ? '🚀' : '📉';
  const label = isSurge ? '急涨' : '急跌';

  const body = [
    `## ${emoji} ${label}警报`,
    '',
    '| 指标 | 数值 |',
    '|------|------|',
    `| 代码 | ${q.symbol} |`,
    `| 现价 | ${$(q.price)} |`,
    `| 涨跌 | ${pctPlain(q.changePct)} |`,
    `| 最高 | ${q.high ? $(q.high) : '—'} |`,
    `| 最低 | ${q.low ? $(q.low) : '—'} |`,
    `| 成交量 | ${q.volume?.toLocaleString() ?? '—'} |`,
    '',
    `⏰ ${q.timestamp.replace('T', ' ').slice(0, 19)}`,
  ].join('\n');

  return {
    type: 'QUOTE_ALERT',
    title: `${emoji} ${label} | ${q.symbol} ${pctPlain(q.changePct)}`,
    source: '📢 广告部门 ADV-001',
    color,
    body,
    priority: 7,
    symbol: q.symbol,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  模板 6：系统状态（SYSTEM_STATUS）
// ═══════════════════════════════════════════════════════════════════

export interface SystemStatusEvent {
  event: string;
  detail: string;
  level: 'info' | 'warning' | 'critical';
}

export function renderSystemStatus(events: SystemStatusEvent[]): NotificationPayload {
  const hasCritical = events.some((e) => e.level === 'critical');
  const color = hasCritical ? 'red'
    : events.some((e) => e.level === 'warning') ? 'orange'
    : 'blue';

  const items = events.map((e) => {
    const icon = e.level === 'critical' ? '🚨'
      : e.level === 'warning' ? '⚠️'
      : 'ℹ️';
    return `| ${icon} | ${e.event} | ${e.detail} |`;
  });

  const body = [
    '## 📡 系统状态',
    '',
    '| ⚡ | 事件 | 详情 |',
    '|-----|------|------|',
    ...items,
    '',
    `⏰ ${now()}`,
  ].join('\n');

  return {
    type: 'SYSTEM_STATUS',
    title: `📡 系统状态更新 | ${events.length} 个事件`,
    source: '📢 广告部门 ADV-001',
    color,
    body,
    priority: hasCritical ? 10 : 5,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  模板 7：通用通知（GENERIC）
// ═══════════════════════════════════════════════════════════════════

export function renderGeneric(
  title: string,
  body: string,
  color: 'green' | 'blue' | 'orange' | 'red' | 'purple' | 'grey' = 'blue',
  priority: number = 3,
): NotificationPayload {
  return {
    type: 'GENERIC',
    title,
    source: '📢 广告部门 ADV-001',
    color,
    body: `${body}\n\n⏰ ${now()}`,
    priority,
  };
}
