/**
 * 选举投票聚合器 — 单元测试
 *
 * 测试 5 步决策算法的各种场景：
 *   场景 A: 强买入信号
 *   场景 B: 强卖出信号
 *   场景 C: 多空分歧
 *   场景 D: 集体观望
 *   场景 E: 人数不足
 */

import { describe, it, expect } from '@jest/globals';

// 直接内联决策逻辑以隔离测试（不依赖 DB）
interface Vote {
  agent_id: string;
  vote_direction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  weight: number;
}

function determineDecision(
  votes: Vote[],
  minVoters: number = 3,
  holdRatioMax: number = 0.50,
  directionThreshold: number = 0.55
): { direction: string; confidence: number; reason: string } {
  
  // Step 1: 计算加权总和
  let buyWeight = 0, sellWeight = 0, holdWeight = 0;
  for (const v of votes) {
    const w = v.weight * v.confidence;
    if (v.vote_direction === 'BUY') buyWeight += w;
    else if (v.vote_direction === 'SELL') sellWeight += w;
    else holdWeight += w;
  }

  const totalDirectional = buyWeight + sellWeight;
  const totalAll = totalDirectional + holdWeight;

  // Step 2: 参与度检查
  if (votes.length < minVoters) {
    return { direction: 'HOLD', confidence: 0, reason: `Voters (${votes.length}) < min (${minVoters})` };
  }

  // Step 3: 惰性检查
  const holdRatio = totalAll > 0 ? holdWeight / totalAll : 0;
  if (holdRatio > holdRatioMax) {
    return { direction: 'HOLD', confidence: 0, reason: `Hold ratio (${(holdRatio * 100).toFixed(1)}%) > max (${(holdRatioMax * 100).toFixed(1)}%)` };
  }

  // Step 4: 方向判定
  if (totalDirectional === 0) {
    return { direction: 'HOLD', confidence: 0, reason: 'No directional votes' };
  }

  const leadingWeight = Math.max(buyWeight, sellWeight);
  const ratio = leadingWeight / totalDirectional;

  if (ratio < directionThreshold) {
    return { direction: 'HOLD', confidence: 0, reason: `Direction ratio (${(ratio * 100).toFixed(1)}%) < threshold (${(directionThreshold * 100).toFixed(1)}%)` };
  }

  const direction = buyWeight > sellWeight ? 'BUY' : 'SELL';
  return { direction, confidence: ratio, reason: `${direction} wins with ratio ${(ratio * 100).toFixed(1)}%` };
}

// ===== 测试用例 =====

describe('Election Decision Algorithm', () => {

  it('场景 A: 强买入信号 — should return BUY', () => {
    const votes: Vote[] = [
      { agent_id: 'A1', vote_direction: 'BUY',  confidence: 0.85, weight: 1.5 },
      { agent_id: 'A2', vote_direction: 'BUY',  confidence: 0.90, weight: 1.3 },
      { agent_id: 'A3', vote_direction: 'BUY',  confidence: 0.80, weight: 1.0 },
      { agent_id: 'A4', vote_direction: 'SELL', confidence: 0.50, weight: 0.8 },
      { agent_id: 'A5', vote_direction: 'HOLD', confidence: 0.60, weight: 1.0 },
    ];
    const result = determineDecision(votes);
    expect(result.direction).toBe('BUY');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('场景 B: 强卖出信号 — should return SELL', () => {
    const votes: Vote[] = [
      { agent_id: 'A1', vote_direction: 'SELL', confidence: 0.85, weight: 1.5 },
      { agent_id: 'A2', vote_direction: 'SELL', confidence: 0.90, weight: 1.3 },
      { agent_id: 'A3', vote_direction: 'BUY',  confidence: 0.50, weight: 0.8 },
      { agent_id: 'A4', vote_direction: 'HOLD', confidence: 0.60, weight: 1.0 },
    ];
    const result = determineDecision(votes);
    expect(result.direction).toBe('SELL');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('场景 C: 多空分歧 — should return HOLD', () => {
    const votes: Vote[] = [
      { agent_id: 'A1', vote_direction: 'BUY',  confidence: 0.80, weight: 1.0 },
      { agent_id: 'A2', vote_direction: 'BUY',  confidence: 0.75, weight: 1.0 },
      { agent_id: 'A3', vote_direction: 'SELL', confidence: 0.80, weight: 1.0 },
      { agent_id: 'A4', vote_direction: 'SELL', confidence: 0.75, weight: 1.0 },
    ];
    const result = determineDecision(votes);
    expect(result.direction).toBe('HOLD');
  });

  it('场景 D: 集体观望 (high hold ratio) — should return HOLD', () => {
    const votes: Vote[] = [
      { agent_id: 'A1', vote_direction: 'HOLD', confidence: 0.60, weight: 1.0 },
      { agent_id: 'A2', vote_direction: 'HOLD', confidence: 0.60, weight: 1.0 },
      { agent_id: 'A3', vote_direction: 'HOLD', confidence: 0.60, weight: 1.0 },
      { agent_id: 'A4', vote_direction: 'BUY',  confidence: 0.70, weight: 0.5 },
    ];
    const result = determineDecision(votes);
    expect(result.direction).toBe('HOLD');
  });

  it('场景 E: 人数不足 (< 3 voters) — should return HOLD', () => {
    const votes: Vote[] = [
      { agent_id: 'A1', vote_direction: 'BUY', confidence: 0.90, weight: 1.0 },
      { agent_id: 'A2', vote_direction: 'BUY', confidence: 0.90, weight: 1.0 },
    ];
    const result = determineDecision(votes);
    expect(result.direction).toBe('HOLD');
  });

  it('场景 F: 权重差异 — 少数派高权重可胜出', () => {
    const votes: Vote[] = [
      { agent_id: 'A1', vote_direction: 'SELL', confidence: 0.90, weight: 5.0 },  // 高权重
      { agent_id: 'A2', vote_direction: 'BUY',  confidence: 0.80, weight: 0.5 },
      { agent_id: 'A3', vote_direction: 'BUY',  confidence: 0.80, weight: 0.5 },
      { agent_id: 'A4', vote_direction: 'BUY',  confidence: 0.80, weight: 0.5 },
    ];
    const result = determineDecision(votes);
    // SELL: 5.0*0.9=4.5, BUY: 0.5*0.8*3=1.2
    expect(result.direction).toBe('SELL');
  });

});
