/**
 * 选股 Agent — 技术指标
 *
 * 基于均线、MACD、RSI、布林带等指标独立判断。
 * 每个信号独立提交到股池。
 *
 * 用法：
 *   npx tsx src/scripts/selector-technical.ts
 */

import { execSync } from 'node:child_process';

const SYMBOLS = ['NVDA.US', 'AAPL.US', 'TSLA.US', 'MSFT.US', 'GOOGL.US', 'AMZN.US', 'META.US'];

function lb(args: string): any {
  try {
    const out = execSync(`longbridge ${args} --format json`, { timeout: 10000, maxBuffer: 2 * 1024 * 1024 }).toString().trim();
    return out ? JSON.parse(out) : [];
  } catch { return []; }
}

function submit(symbol: string, type: string, strength: number, source: string, reason: string) {
  execSync(`npx tsx src/scripts/submit-signal.ts --symbol ${symbol} --type ${type} --strength ${strength} --source ${source} --reason "${reason}" --agent-id AGT-SEL-02`, { timeout: 10000 });
}

function ma(values: number[], period: number, idx: number): number {
  if (idx < period - 1) return 0;
  return values.slice(idx - period + 1, idx + 1).reduce((s, v) => s + v, 0) / period;
}

function rsi(values: number[], period: number = 14): number {
  if (values.length < period + 1) return 50;
  const deltas = values.slice(-period - 1).map((v, i, arr) => i > 0 ? v - arr[i - 1] : 0).slice(1);
  const gains = deltas.map(d => d > 0 ? d : 0);
  const losses = deltas.map(d => d < 0 ? -d : 0);
  const avgGain = gains.reduce((s, v) => s + v, 0) / period;
  const avgLoss = losses.reduce((s, v) => s + v, 0) / period;
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

function bollinger(values: number[], period: number = 20, stdDev: number = 2) {
  if (values.length < period) return { upper: 0, lower: 0, middle: 0 };
  const slice = values.slice(-period);
  const mid = slice.reduce((s, v) => s + v, 0) / period;
  const std = Math.sqrt(slice.reduce((s, v) => s + (v - mid) ** 2, 0) / period);
  return { upper: mid + stdDev * std, lower: mid - stdDev * std, middle: mid };
}

async function main() {
  console.log('[selector-technical] Scanning...');

  for (const sym of SYMBOLS) {
    const quote = lb(`quote ${sym}`)[0];
    const klines = lb(`kline history ${sym} --count 60 --period day`);
    if (!quote || klines.length < 30) continue;

    const price = quote.last;
    const closes: number[] = klines.map((k: any) => k.close);

    // === MA 金叉 (MA5 上穿 MA20) ===
    const ma5Cur = ma(closes, 5, closes.length - 1);
    const ma5Prev = ma(closes, 5, closes.length - 2);
    const ma20Cur = ma(closes, 20, closes.length - 1);
    const ma20Prev = ma(closes, 20, closes.length - 2);
    if (ma5Prev <= ma20Prev && ma5Cur > ma20Cur) {
      submit(sym, 'BULLISH', 4, 'MA_GOLDEN_CROSS', `${sym} MA5(${ma5Cur.toFixed(1)}) 上穿 MA20(${ma20Cur.toFixed(1)}) @ $${price}`);
      console.log(`[selector-technical] ${sym} MA_GOLDEN_CROSS`);
    }

    // === RSI 超卖 (<30) ===
    const rsiVal = rsi(closes);
    if (rsiVal < 30) {
      submit(sym, 'BULLISH', 3, 'RSI_OVERSOLD', `${sym} RSI ${rsiVal.toFixed(0)} 超卖 @ $${price}`);
      console.log(`[selector-technical] ${sym} RSI_OVERSOLD (${rsiVal.toFixed(0)})`);
    } else if (rsiVal > 70) {
      submit(sym, 'BEARISH', 3, 'RSI_OVERBOUGHT', `${sym} RSI ${rsiVal.toFixed(0)} 超买 @ $${price}`);
      console.log(`[selector-technical] ${sym} RSI_OVERBOUGHT (${rsiVal.toFixed(0)})`);
    }

    // === 布林带下轨触及 ===
    const bb = bollinger(closes);
    if (bb.lower > 0 && price <= bb.lower * 1.01) {
      submit(sym, 'BULLISH', 4, 'BOLLINGER_LOWER', `${sym} 触及布林下轨 $${bb.lower.toFixed(1)} @ $${price}`);
      console.log(`[selector-technical] ${sym} BOLLINGER_LOWER`);
    } else if (bb.upper > 0 && price >= bb.upper * 0.99) {
      submit(sym, 'BEARISH', 4, 'BOLLINGER_UPPER', `${sym} 触及布林上轨 $${bb.upper.toFixed(1)} @ $${price}`);
      console.log(`[selector-technical] ${sym} BOLLINGER_UPPER`);
    }
  }
  console.log('[selector-technical] Done');
}

main().catch(console.error);
