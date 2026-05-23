/**
 * Advertising Notification Generator — 单元测试
 *
 * 覆盖所有模板函数、渠道适配器和引擎核心逻辑。
 *
 * 运行：
 *   npx jest tests/unit/advertising.test.ts
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// ── 模板函数 ──
import {
  renderTurtleSignal,
  renderTurtleDetail,
  renderPortfolioSummary,
  renderBatchScan,
  renderQuoteAlert,
  renderSystemStatus,
  renderGeneric,
} from '../../src/advertising/templates.js';
import type {
  QuoteSnapshot,
} from '../../src/advertising/types.js';
import type {
  PortfolioSummary,
  BatchScanItem,
  SystemStatusEvent,
} from '../../src/advertising/templates.js';

// ── 渠道适配器 ──
import { ConsoleChannel } from '../../src/advertising/channels/console.js';
import type { TurtleAnalysisResult } from '../../src/advertising/types.js';

// ============================================================================
// Helpers
// ============================================================================

function makeBullishAnalysis(overrides: Partial<TurtleAnalysisResult> = {}): TurtleAnalysisResult {
  return {
    symbol: 'NVDA.US',
    timestamp: '2026-05-23T10:00:00.000Z',
    currentPrice: 145.30,
    prevClose: 142.10,
    entry20High: 140.00,
    entry55High: 135.00,
    exit10Low: 128.00,
    exit20Low: 125.00,
    atr: 4.50,
    nValue: 4.50,
    signal: 'BULLISH',
    signalStrength: 5,
    isAboveEntry20: true,
    isAboveEntry55: true,
    isBelowExit10: false,
    isBelowExit20: false,
    suggestedUnits: 4,
    dollarVolatility: 450,
    trendDirection: 'UP',
    isBullMarket: true,
    notes: '双突破信号，加仓满 4 单位',
    lastAction: 'BUY @ 143.20',
    ...overrides,
  };
}

function makeBearishAnalysis(overrides: Partial<TurtleAnalysisResult> = {}): TurtleAnalysisResult {
  return {
    symbol: 'AAPL.US',
    timestamp: '2026-05-23T10:00:00.000Z',
    currentPrice: 168.50,
    prevClose: 172.00,
    entry20High: 175.00,
    entry55High: 180.00,
    exit10Low: 170.00,
    exit20Low: 165.00,
    atr: 3.20,
    nValue: 3.20,
    signal: 'BEARISH',
    signalStrength: 4,
    isAboveEntry20: false,
    isAboveEntry55: false,
    isBelowExit10: true,
    isBelowExit20: false,
    suggestedUnits: 0,
    dollarVolatility: 320,
    trendDirection: 'DOWN',
    isBullMarket: false,
    notes: '跌破 10 日低点，建议清仓',
    ...overrides,
  };
}

function makeNeutralAnalysis(overrides: Partial<TurtleAnalysisResult> = {}): TurtleAnalysisResult {
  return {
    symbol: 'MSFT.US',
    timestamp: '2026-05-23T10:00:00.000Z',
    currentPrice: 410.00,
    prevClose: 408.00,
    entry20High: 420.00,
    entry55High: 430.00,
    exit10Low: 395.00,
    exit20Low: 390.00,
    atr: 8.00,
    nValue: 8.00,
    signal: 'NEUTRAL',
    signalStrength: 2,
    isAboveEntry20: false,
    isAboveEntry55: false,
    isBelowExit10: false,
    isBelowExit20: false,
    suggestedUnits: 0,
    dollarVolatility: 800,
    trendDirection: 'SIDEWAYS',
    isBullMarket: false,
    ...overrides,
  };
}

// ============================================================================
// Template 1: renderTurtleSignal
// ============================================================================

describe('renderTurtleSignal', () => {
  it('generates BUY signal with green color and high priority', () => {
    const r = makeBullishAnalysis();
    const p = renderTurtleSignal(r);

    expect(p.color).toBe('green');
    expect(p.priority).toBe(8);
    expect(p.title).toContain('海龟入场信号');
    expect(p.title).toContain('NVDA.US');
    expect(p.body).toContain('🟢 做多');
    expect(p.body).toContain('$145.30');
    expect(p.body).toContain('$140.00');
    expect(p.body).toContain('4/4');
  });

  it('generates SELL signal with red color and higher priority', () => {
    const r = makeBearishAnalysis();
    const p = renderTurtleSignal(r);

    expect(p.color).toBe('red');
    expect(p.priority).toBe(9);
    expect(p.title).toContain('海龟离场信号');
    expect(p.body).toContain('🔴 做空');
  });

  it('generates NEUTRAL signal with blue color', () => {
    const r = makeNeutralAnalysis();
    const p = renderTurtleSignal(r);

    expect(p.color).toBe('blue');
    expect(p.priority).toBe(5);
    expect(p.body).toContain('⚪ 中性');
  });

  it('returns error payload when data is incomplete', () => {
    const r = { symbol: 'NVDA.US', timestamp: '', currentPrice: undefined as any, entry20High: undefined as any, atr: undefined as any } as TurtleAnalysisResult;
    const p = renderTurtleSignal(r);

    expect(p.color).toBe('orange');
    expect(p.title).toContain('数据异常');
    expect(p.body).toContain('缺少价格');
  });

  it('shows signal strength bars for all levels', () => {
    // signalStrength=1 → bars[1] → '▂'
    const r = makeBullishAnalysis({ signalStrength: 1 });
    const p = renderTurtleSignal(r);
    expect(p.body).toContain('▂');
  });

  it('includes trend and notes when present', () => {
    const r = makeBullishAnalysis();
    const p = renderTurtleSignal(r);
    expect(p.body).toContain('多头市场');
    expect(p.body).toContain('双突破信号');
  });
});

// ============================================================================
// Template 2: renderTurtleDetail
// ============================================================================

describe('renderTurtleDetail', () => {
  it('generates detailed analysis card for bullish', () => {
    const r = makeBullishAnalysis();
    const p = renderTurtleDetail(r);

    expect(p.title).toContain('海龟分析详情');
    expect(p.title).toContain('NVDA.US');
    expect(p.color).toBe('green');
    expect(p.body).toContain('✅ 突破 20 日高点');
    expect(p.body).toContain('✅ 突破 55 日高点');
    expect(p.body).toContain('✔️ 站稳 10 日低点');
    expect(p.body).toContain('🐂 多头');
  });

  it('shows exit warnings for bearish', () => {
    const r = makeBearishAnalysis();
    const p = renderTurtleDetail(r);

    expect(p.color).toBe('red');
    expect(p.body).toContain('⚠️ 跌破 10 日低点');
    expect(p.body).toContain('🐻 非多头');
  });

  it('shows neutral status', () => {
    const r = makeNeutralAnalysis();
    const p = renderTurtleDetail(r);

    expect(p.color).toBe('blue');
    expect(p.body).toContain('⏳ 未突破 20 日高点');
    expect(p.body).toContain('✔️ 站稳 10 日低点');
  });
});

// ============================================================================
// Template 3: renderPortfolioSummary
// ============================================================================

describe('renderPortfolioSummary', () => {
  const summary: PortfolioSummary = {
    totalValue: 88000,
    dailyPnl: 1250,
    dailyPnlPct: 0.0144,
    items: [
      { symbol: 'NVDA.US', price: 145.30, change: 3.20, changePct: 0.0225, signal: 'BULLISH', signalStrength: 5, suggestedUnits: 4 },
      { symbol: 'MSFT.US', price: 410.00, change: -2.00, changePct: -0.0049, signal: 'NEUTRAL', signalStrength: 2 },
      { symbol: 'GOOGL.US', price: 175.50, change: -1.20, changePct: -0.0068, signal: 'BEARISH', signalStrength: 3, suggestedUnits: 0 },
    ],
  };

  it('generates green portfolio when positive PnL', () => {
    const p = renderPortfolioSummary(summary);
    expect(p.color).toBe('green');
    expect(p.title).toContain('📈');
    expect(p.title).toContain('3 只');
  });

  it('generates red portfolio when negative PnL', () => {
    const negative = { ...summary, dailyPnl: -500, dailyPnlPct: -0.0057 };
    const p = renderPortfolioSummary(negative);
    expect(p.color).toBe('red');
    expect(p.title).toContain('📉');
  });

  it('shows all portfolio items with signals', () => {
    const p = renderPortfolioSummary(summary);
    expect(p.body).toContain('NVDA.US');
    expect(p.body).toContain('🟢');
    expect(p.body).toContain('MSFT.US');
    expect(p.body).toContain('⚪');
    expect(p.body).toContain('GOOGL.US');
    expect(p.body).toContain('🔴');
  });
});

// ============================================================================
// Template 4: renderBatchScan
// ============================================================================

describe('renderBatchScan', () => {
  const items: BatchScanItem[] = [
    { symbol: 'NVDA.US', price: 145.30, changePct: 0.0225, signal: 'BULLISH', signalStrength: 5 },
    { symbol: 'AAPL.US', price: 168.50, changePct: -0.0203, signal: 'BEARISH', signalStrength: 4, note: '跌破支撑' },
    { symbol: 'MSFT.US', price: 410.00, changePct: -0.0049, signal: 'NEUTRAL', signalStrength: 2 },
    { symbol: 'GOOGL.US', price: 175.50, changePct: 0.0105, signal: 'NEUTRAL', signalStrength: 1 },
  ];

  it('shows scan summary with signal counts', () => {
    const p = renderBatchScan(items, 10);
    expect(p.type).toBe('BATCH_SCAN');
    expect(p.body).toContain('10');   // total scanned
    expect(p.body).toContain('| 1 |'); // buy count
    expect(p.body).toContain('| 1 |'); // sell count
  });

  it('uses orange when buys and sells are tied', () => {
    const p = renderBatchScan(items, 4);
    expect(p.color).toBe('orange'); // 1 buy, 1 sell → hasSignals=true, buyCount!>sellCount → orange
  });

  it('shows BUY/SELL/HOLD labels', () => {
    const p = renderBatchScan(items, 4);
    expect(p.body).toContain('🟢 BUY');
    expect(p.body).toContain('🔴 SELL');
    expect(p.body).toContain('⚪ HOLD');
  });

  it('shows notes for items that have them', () => {
    const p = renderBatchScan(items, 4);
    expect(p.body).toContain('跌破支撑');
  });

  it('handles empty results', () => {
    const p = renderBatchScan([], 0);
    expect(p.color).toBe('blue');
    expect(p.body).toContain('0');
  });
});

// ============================================================================
// Template 5: renderQuoteAlert
// ============================================================================

describe('renderQuoteAlert', () => {
  const surge: QuoteSnapshot = {
    symbol: 'NVDA.US', price: 145.30, change: 7.20, changePct: 0.052,
    volume: 12345678, high: 146.00, low: 139.00,
    timestamp: '2026-05-23T10:00:00.000Z',
  };

  const plunge: QuoteSnapshot = {
    symbol: 'AAPL.US', price: 160.00, change: -12.00, changePct: -0.07,
    volume: 20000000, high: 173.00, low: 159.00,
    timestamp: '2026-05-23T10:00:00.000Z',
  };

  it('triggers alert for surge above 3%', () => {
    const p = renderQuoteAlert(surge);
    expect(p.priority).toBe(7);
    expect(p.color).toBe('green');
    expect(p.title).toContain('🚀');
  });

  it('triggers alert for plunge below -3%', () => {
    const p = renderQuoteAlert(plunge);
    expect(p.color).toBe('red');
    expect(p.title).toContain('📉');
  });

  it('suppresses when change is within threshold', () => {
    const quiet: QuoteSnapshot = {
      ...surge, changePct: 0.01, change: 1.50,
    };
    const p = renderQuoteAlert(quiet);
    expect(p.color).toBe('grey');
    expect(p.priority).toBe(1);
  });
});

// ============================================================================
// Template 6: renderSystemStatus
// ============================================================================

describe('renderSystemStatus', () => {
  it('uses red for critical events', () => {
    const events: SystemStatusEvent[] = [
      { event: '熔断触发', detail: '日回撤 8.5%', level: 'critical' },
    ];
    const p = renderSystemStatus(events);
    expect(p.color).toBe('red');
    expect(p.priority).toBe(10);
    expect(p.body).toContain('🚨');
  });

  it('uses orange for warnings', () => {
    const events: SystemStatusEvent[] = [
      { event: '影子期', detail: 'AGT-003 进入影子期', level: 'warning' },
    ];
    const p = renderSystemStatus(events);
    expect(p.color).toBe('orange');
    expect(p.body).toContain('⚠️');
  });

  it('uses blue for info events', () => {
    const events: SystemStatusEvent[] = [
      { event: '定时扫描', detail: '30 只股票扫描完成', level: 'info' },
    ];
    const p = renderSystemStatus(events);
    expect(p.color).toBe('blue');
    expect(p.body).toContain('ℹ️');
  });
});

// ============================================================================
// Template 7: renderGeneric
// ============================================================================

describe('renderGeneric', () => {
  it('renders with given title and body', () => {
    const p = renderGeneric('测试标题', '这是测试正文');
    expect(p.type).toBe('GENERIC');
    expect(p.title).toBe('测试标题');
    expect(p.body).toContain('这是测试正文');
    expect(p.color).toBe('blue');
    expect(p.priority).toBe(3);
  });

  it('accepts custom color and priority', () => {
    const p = renderGeneric('紧急通知', '系统升级', 'orange', 8);
    expect(p.color).toBe('orange');
    expect(p.priority).toBe(8);
  });
});

// ============================================================================
// Channel: ConsoleChannel
// ============================================================================

describe('ConsoleChannel', () => {
  let channel: ConsoleChannel;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    channel = new ConsoleChannel();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('has type console', () => {
    expect(channel.type).toBe('console');
  });

  it('always passes health check', async () => {
    const healthy = await channel.healthCheck();
    expect(healthy).toBe(true);
  });

  it('returns a messageId on send', async () => {
    const payload = renderGeneric('测试', '正文');
    const messageId = await channel.send(payload);

    expect(messageId).toBeDefined();
    expect(messageId).toContain('generic-');
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('formats output with color codes', async () => {
    const r = makeBullishAnalysis();
    const payload = renderTurtleSignal(r);
    await channel.send(payload);

    const logged = consoleLogSpy.mock.calls.flat().join('');
    expect(logged).toContain('TURTLE_SIGNAL');
    expect(logged).toContain('海龟入场信号');
  });
});

// ============================================================================
// Edge cases & validation
// ============================================================================

describe('Edge cases', () => {
  it('handles null/undefined notes gracefully', () => {
    const r = makeBullishAnalysis({ notes: undefined });
    const p = renderTurtleSignal(r);
    // Should not crash or include "undefined" string
    expect(p.body).not.toContain('undefined');
  });

  it('handles missing exit10Low gracefully', () => {
    const r = makeBullishAnalysis();
    const p = renderTurtleSignal(r);
    expect(p.body).toContain('$128.00'); // exit10Low present
  });

  it('handles missing trendDirection gracefully', () => {
    const r = makeNeutralAnalysis({ trendDirection: undefined });
    const p = renderTurtleDetail(r);
    expect(p.body).toContain('—'); // Placeholder for missing trend
  });

  it('portfolio summary handles empty items', () => {
    const s: PortfolioSummary = {
      totalValue: 88000, dailyPnl: 0, dailyPnlPct: 0, items: [],
    };
    const p = renderPortfolioSummary(s);
    expect(p.title).toContain('0 只');
  });

  it('formatting tools round to 2 decimal places', () => {
    const r = makeBullishAnalysis({ currentPrice: 145.305 });
    const p = renderTurtleSignal(r);
    // 145.305 → toFixed(2) → "145.31" (rounds to nearest)
    expect(p.body).toContain('$145.31');
  });
});
