/**
 * 风控检查 — 单元测试
 *
 * 测试各风控函数的纯逻辑（不依赖 DB）。
 */

import { describe, it, expect } from '@jest/globals';

// === 纯函数版本（可独立测试） ===

function checkPositionLimit(
  currentPrice: number,
  existingQty: number,
  totalAsset: number,
  maxPositionPct: number
): { passed: boolean; maxQty: number; message: string } {
  const maxPositionValue = totalAsset * maxPositionPct;
  const existingValue = existingQty * currentPrice;
  const remaining = maxPositionValue - existingValue;
  const maxQty = Math.floor(Math.max(0, remaining) / currentPrice);

  return {
    passed: remaining > 0,
    maxQty,
    message: remaining > 0
      ? `Can buy up to ${maxQty} shares (remaining: $${remaining.toFixed(0)})`
      : `Position limit exceeded (current: $${existingValue.toFixed(0)}, max: $${maxPositionValue.toFixed(0)})`,
  };
}

function checkMaxLoss(
  currentPrice: number,
  entryPrice: number,
  maxLossPerTrade: number
): { passed: boolean; lossPct: number; message: string } {
  if (entryPrice <= 0) return { passed: true, lossPct: 0, message: 'No position' };
  const lossPct = (currentPrice - entryPrice) / entryPrice;
  return {
    passed: lossPct > -maxLossPerTrade,
    lossPct,
    message: lossPct <= -maxLossPerTrade
      ? `Stop-loss triggered (${(lossPct * 100).toFixed(1)}%)`
      : `Within risk tolerance (${(lossPct * 100).toFixed(1)}%)`,
  };
}

function checkDailyTradeLimit(
  todayCount: number,
  maxDailyTrades: number
): { passed: boolean; message: string } {
  return {
    passed: todayCount < maxDailyTrades,
    message: todayCount >= maxDailyTrades
      ? `Daily trade limit reached (${todayCount}/${maxDailyTrades})`
      : `${todayCount}/${maxDailyTrades} trades today`,
  };
}

// ===== 测试用例 =====

describe('Risk Checks', () => {

  describe('checkPositionLimit', () => {
    it('should allow buy when under limit', () => {
      // totalAsset=88000, maxPct=0.20, max=17600
      // NVDA @ $125, existing 10 shares = $1250
      // remaining = 17600-1250 = 16350, maxQty = floor(16350/125) = 130
      const result = checkPositionLimit(125, 10, 88000, 0.20);
      expect(result.passed).toBe(true);
      expect(result.maxQty).toBe(130);
    });

    it('should reject when over limit', () => {
      // existing 200 shares @ $100 = $20000 > max $17600
      const result = checkPositionLimit(100, 200, 88000, 0.20);
      expect(result.passed).toBe(false);
    });

    it('should allow full position when no existing', () => {
      const result = checkPositionLimit(100, 0, 88000, 0.20);
      expect(result.passed).toBe(true);
      expect(result.maxQty).toBe(176); // 17600/100
    });
  });

  describe('checkMaxLoss', () => {
    it('should pass when price above entry', () => {
      const result = checkMaxLoss(110, 100, 0.05);
      expect(result.passed).toBe(true);
      expect(result.lossPct).toBe(0.10); // 10% profit
    });

    it('should pass when small loss within limit', () => {
      const result = checkMaxLoss(97, 100, 0.05);
      expect(result.passed).toBe(true);
      expect(result.lossPct).toBe(-0.03); // -3%
    });

    it('should fail when loss exceeds limit', () => {
      const result = checkMaxLoss(92, 100, 0.05);
      expect(result.passed).toBe(false);
      expect(result.lossPct).toBe(-0.08); // -8%
    });

    it('should pass with no position (entryPrice=0)', () => {
      const result = checkMaxLoss(100, 0, 0.05);
      expect(result.passed).toBe(true);
    });
  });

  describe('checkDailyTradeLimit', () => {
    it('should pass when under limit', () => {
      const result = checkDailyTradeLimit(5, 10);
      expect(result.passed).toBe(true);
    });

    it('should fail when limit reached', () => {
      const result = checkDailyTradeLimit(10, 10);
      expect(result.passed).toBe(false);
    });

    it('should pass on first trade', () => {
      const result = checkDailyTradeLimit(0, 10);
      expect(result.passed).toBe(true);
    });
  });

});
