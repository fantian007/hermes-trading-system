/**
 * 选股 Agent — 止损/止盈监控
 *
 * 与其他选股 Agent 不同，此 Agent 只关注已持仓股票的风险管理。
 * 止损/止盈触发不受冷却限制，强制提交信号到股池。
 *
 * 用法：
 *   npx tsx src/scripts/selector-risk.ts
 */

import { execSync } from 'node:child_process';

function lb(args: string): any {
  try {
    const out = execSync(`longbridge ${args} --format json`, { timeout: 10000, maxBuffer: 1024 * 1024 }).toString().trim();
    return out ? JSON.parse(out) : [];
  } catch { return []; }
}

function submit(symbol: string, type: string, strength: number, source: string, reason: string) {
  execSync(`npx tsx src/scripts/submit-signal.ts --symbol ${symbol} --type ${type} --strength ${strength} --source ${source} --reason "${reason}" --agent-id AGT-SEL-03`, { timeout: 10000 });
}

async function main() {
  console.log('[selector-risk] Scanning positions...');

  const positions = lb('positions');
  const posList = Array.isArray(positions) ? positions : (positions?.channels?.[0]?.positions || []);
  
  if (posList.length === 0) {
    console.log('[selector-risk] No positions');
    return;
  }

  for (const pos of posList) {
    if (!pos.cost_price || !pos.quantity || pos.quantity <= 0) continue;

    const quote = lb(`quote ${pos.symbol}`)[0];
    if (!quote) continue;

    const currentPrice = quote.last;
    const pnlPct = ((currentPrice - pos.cost_price) / pos.cost_price) * 100;

    // 止损: 浮亏 ≥ 5%
    if (pnlPct <= -5) {
      submit(pos.symbol, 'BULLISH', 5, 'STOP_LOSS',
        `止损: ${pos.symbol} 浮亏 ${pnlPct.toFixed(1)}% (成本 $${pos.cost_price} → 现价 $${currentPrice})`);
      console.log(`[selector-risk] ${pos.symbol} STOP_LOSS (${pnlPct.toFixed(1)}%)`);
    }
    // 止盈: 浮盈 ≥ 10%
    else if (pnlPct >= 10) {
      submit(pos.symbol, 'BULLISH', 5, 'TAKE_PROFIT',
        `止盈: ${pos.symbol} 浮盈 ${pnlPct.toFixed(1)}% (成本 $${pos.cost_price} → 现价 $${currentPrice})`);
      console.log(`[selector-risk] ${pos.symbol} TAKE_PROFIT (${pnlPct.toFixed(1)}%)`);
    }
  }
  console.log('[selector-risk] Done');
}

main().catch(console.error);
