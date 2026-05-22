/**
 * 选股 Agent — 价格异动
 *
 * 独立监控价格涨跌幅，发现异常波动 → 自主提交信号到股池。
 * 每个 Agent 独立运行，不依赖其他 Agent。
 *
 * 用法：
 *   npx tsx src/scripts/selector-price.ts
 */

import { execSync } from 'node:child_process';

const SYMBOLS = ['NVDA.US', 'AAPL.US', 'TSLA.US', 'MSFT.US', 'GOOGL.US', 'AMZN.US', 'META.US'];

function lb(args: string): any {
  try {
    const out = execSync(`longbridge ${args} --format json`, { timeout: 10000, maxBuffer: 1024 * 1024 }).toString().trim();
    return out ? JSON.parse(out) : [];
  } catch { return []; }
}

function submit(symbol: string, type: string, strength: number, source: string, reason: string) {
  execSync(`npx tsx src/scripts/submit-signal.ts --symbol ${symbol} --type ${type} --strength ${strength} --source ${source} --reason "${reason}" --agent-id AGT-SEL-01`, { timeout: 10000 });
}

async function main() {
  console.log('[selector-price] Scanning...');

  for (const sym of SYMBOLS) {
    const quote = lb(`quote ${sym}`)[0];
    if (!quote) continue;

    const price = quote.last;
    const change = parseFloat(quote.change_percentage || '0');
    const volume = quote.volume || 0;

    // 急涨 ≥3% → 买入信号
    if (change >= 3) {
      const strength = change >= 5 ? 5 : 4;
      submit(sym, 'BULLISH', strength, 'PRICE_BREAKOUT', `${sym} 急涨 ${change}% @ $${price}`);
      console.log(`[selector-price] ${sym} BULLISH strength=${strength} (${change}%)`);
    }
    // 急跌 ≥3% → 也可能是买入机会（抄底）
    else if (change <= -3) {
      const strength = change <= -5 ? 5 : 4;
      submit(sym, 'BULLISH', strength, 'PRICE_DIP', `${sym} 急跌 ${change}% @ $${price}，可能是抄底机会`);
      console.log(`[selector-price] ${sym} DIP strength=${strength} (${change}%)`);
    }
    // 持仓股暴涨 ≥5% → 考虑卖出
    else if (change >= 5) {
      submit(sym, 'BEARISH', 4, 'PRICE_SURGE_SELL', `${sym} 暴涨 ${change}% @ $${price}，考虑止盈`);
    }

    // 放量（当日量 > 20日均量 3 倍）
    const klines = lb(`kline history ${sym} --count 25 --period day`);
    if (klines.length >= 21) {
      const avgVol = klines.slice(-21, -1).reduce((s: number, k: any) => s + (k.volume || 0), 0) / 20;
      if (avgVol > 0 && volume > avgVol * 3) {
        submit(sym, 'BULLISH', 3, 'VOLUME_SPIKE', `${sym} 放量 ${(volume / avgVol).toFixed(1)}x @ $${price}`);
        console.log(`[selector-price] ${sym} VOLUME_SPIKE (${(volume / avgVol).toFixed(1)}x)`);
      }
    }
  }
  console.log('[selector-price] Done');
}

main().catch(console.error);
