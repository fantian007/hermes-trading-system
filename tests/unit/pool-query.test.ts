/**
 * 股池查询服务单元测试
 *
 * 测试聚合逻辑、空池处理、覆盖率目标 90%+。
 *
 * 运行：
 *   npx jest tests/unit/pool-query.test.ts
 */

import { describe, it, expect } from '@jest/globals';
import { aggregateSignals } from '../../src/pool/query.js';
import type { StockPoolItem } from '../../src/core/types.js';

// ============================================================================
// Helpers
// ============================================================================

function makeSignal(overrides: Partial<StockPoolItem> = {}): StockPoolItem {
  return {
    symbol: 'NVDA.US',
    signal_type: 'BULLISH',
    strength: 4,
    source: 'PRICE_BREAKOUT',
    reason: 'test signal',
    source_url: null,
    agent_id: 'AGT-TEST-01',
    status: 'ACTIVE',
    added_at: '2026-05-22T10:00:00.000Z',
    removed_at: null,
    ...overrides,
  };
}

// ============================================================================
// aggregateSignals
// ============================================================================

describe('aggregateSignals', () => {
  // --- Empty pool ---
  it('returns empty map for empty input', () => {
    const result = aggregateSignals([]);
    expect(result.size).toBe(0);
  });

  // --- Single signal ---
  it('groups single signal correctly', () => {
    const result = aggregateSignals([makeSignal()]);
    expect(result.size).toBe(1);

    const stock = result.get('NVDA.US')!;
    expect(stock.symbol).toBe('NVDA.US');
    expect(stock.name).toBeNull();
    expect(stock.signal_count).toBe(1);
    expect(stock.aggregate.bullish_signals).toBe(1);
    expect(stock.aggregate.bearish_signals).toBe(0);
    expect(stock.aggregate.total_strength).toBe(4);
    expect(stock.aggregate.avg_strength).toBe(4);
    expect(stock.signals).toHaveLength(1);
    expect(stock.signals[0].agent_id).toBe('AGT-TEST-01');
  });

  // --- Multiple signals, same symbol ---
  it('merges multiple signals for same symbol', () => {
    const items: StockPoolItem[] = [
      makeSignal({ agent_id: 'AGT-01', strength: 5 }),
      makeSignal({ agent_id: 'AGT-02', strength: 3 }),
      makeSignal({ agent_id: 'AGT-03', signal_type: 'BEARISH', strength: 2 }),
    ];

    const result = aggregateSignals(items);
    expect(result.size).toBe(1);

    const stock = result.get('NVDA.US')!;
    expect(stock.signal_count).toBe(3);
    expect(stock.aggregate.bullish_signals).toBe(2);
    expect(stock.aggregate.bearish_signals).toBe(1);
    expect(stock.aggregate.total_strength).toBe(10);
    expect(stock.aggregate.avg_strength).toBe(3.33);
    expect(stock.signals).toHaveLength(3);
  });

  // --- Multiple symbols ---
  it('groups signals by symbol', () => {
    const items: StockPoolItem[] = [
      makeSignal({ symbol: 'NVDA.US', agent_id: 'AGT-01' }),
      makeSignal({ symbol: 'AAPL.US', agent_id: 'AGT-02' }),
      makeSignal({ symbol: 'NVDA.US', agent_id: 'AGT-03' }),
      makeSignal({ symbol: 'TSLA.US', agent_id: 'AGT-04' }),
    ];

    const result = aggregateSignals(items);
    expect(result.size).toBe(3);

    expect(result.get('NVDA.US')!.signal_count).toBe(2);
    expect(result.get('AAPL.US')!.signal_count).toBe(1);
    expect(result.get('TSLA.US')!.signal_count).toBe(1);
  });

  // --- All bearish ---
  it('handles all bearish signals', () => {
    const items: StockPoolItem[] = [
      makeSignal({ signal_type: 'BEARISH', agent_id: 'AGT-01', strength: 1 }),
      makeSignal({ signal_type: 'BEARISH', agent_id: 'AGT-02', strength: 2 }),
    ];

    const result = aggregateSignals(items);
    const stock = result.get('NVDA.US')!;

    expect(stock.aggregate.bullish_signals).toBe(0);
    expect(stock.aggregate.bearish_signals).toBe(2);
    expect(stock.aggregate.avg_strength).toBe(1.5);
  });

  // --- Strength edge cases ---
  it('handles strength boundary values', () => {
    const items: StockPoolItem[] = [
      makeSignal({ agent_id: 'AGT-01', strength: 1 }),
      makeSignal({ agent_id: 'AGT-02', strength: 5 }),
    ];

    const result = aggregateSignals(items);
    const stock = result.get('NVDA.US')!;

    expect(stock.aggregate.total_strength).toBe(6);
    expect(stock.aggregate.avg_strength).toBe(3);
  });

  // --- Signal details preserved ---
  it('preserves all signal fields', () => {
    const items: StockPoolItem[] = [
      makeSignal({
        agent_id: 'AGT-SENT-01',
        source: 'MARKET_SCAN',
        reason: 'AI 芯片需求爆发',
        source_url: 'https://example.com/news',
        added_at: '2026-05-22T15:30:00.000Z',
      }),
    ];

    const result = aggregateSignals(items);
    const signal = result.get('NVDA.US')!.signals[0];

    expect(signal.agent_id).toBe('AGT-SENT-01');
    expect(signal.source).toBe('MARKET_SCAN');
    expect(signal.reason).toBe('AI 芯片需求爆发');
    expect(signal.added_at).toBe('2026-05-22T15:30:00.000Z');
    expect(signal.strength).toBe(4);
    expect(signal.signal_type).toBe('BULLISH');
  });

  // --- Large pool (10 signals for same symbol) ---
  it('handles large signal counts correctly', () => {
    const items: StockPoolItem[] = Array.from({ length: 10 }, (_, i) =>
      makeSignal({ agent_id: `AGT-${String(i).padStart(2, '0')}`, strength: 3 }),
    );

    const result = aggregateSignals(items);
    const stock = result.get('NVDA.US')!;

    expect(stock.signal_count).toBe(10);
    expect(stock.signals).toHaveLength(10);
    expect(stock.aggregate.total_strength).toBe(30);
    expect(stock.aggregate.avg_strength).toBe(3);
  });
});

// ============================================================================
// fetchStockPool — integration (requires db)
// ============================================================================

describe('fetchStockPool', () => {
  it('exports as a callable function', async () => {
    const { fetchStockPool } = await import('../../src/pool/query.js');
    expect(typeof fetchStockPool).toBe('function');
  });

  it('returns valid shape with real data (skipQuotes)', async () => {
    const { fetchStockPool } = await import('../../src/pool/query.js');
    const result = fetchStockPool({ skipQuotes: true });

    expect(result).toHaveProperty('pool_size');
    expect(result).toHaveProperty('unique_symbols');
    expect(result).toHaveProperty('stocks');
    expect(result).toHaveProperty('generated_at');
    expect(typeof result.pool_size).toBe('number');
    expect(Array.isArray(result.unique_symbols)).toBe(true);
    expect(Array.isArray(result.stocks)).toBe(true);
    expect(typeof result.generated_at).toBe('string');

    // generated_at should be valid ISO
    expect(new Date(result.generated_at).toISOString()).toBe(result.generated_at);

    // each stock should have required fields
    for (const stock of result.stocks) {
      expect(typeof stock.symbol).toBe('string');
      expect(typeof stock.signal_count).toBe('number');
      expect(stock.signal_count).toBeGreaterThan(0);
      expect(stock.aggregate).toHaveProperty('bullish_signals');
      expect(stock.aggregate).toHaveProperty('bearish_signals');
      expect(stock.aggregate).toHaveProperty('total_strength');
      expect(stock.aggregate).toHaveProperty('avg_strength');
      expect(Array.isArray(stock.signals)).toBe(true);
      expect(stock.signals.length).toBe(stock.signal_count);
    }

    // unique_symbols should match stocks
    expect(result.unique_symbols).toEqual(
      result.stocks.map(s => s.symbol).sort(),
    );
  });
});
