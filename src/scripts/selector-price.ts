/**
 * 选股 Agent — 价格异动信号提交工具
 *
 * 职责（仅此一项）：
 *   接受 Agent 自然语言决策后的结果，提交一个信号到候选股池。
 *   不做任何行情获取 — 那是 data-agent 的工作。
 *
 * 典型流程：
 *   1. Agent 向 data-agent 请求报价和 K 线数据
 *   2. Agent 分析后决定："NVDA 突破布林带上轨，涨幅 2.3%，应该提交信号"
 *   3. Agent 运行此脚本提交信号
 *
 * 用法：
 *   npx tsx src/scripts/selector-price.ts \
 *     --symbol NVDA.US \
 *     --price 125.50 \
 *     --change 2.3
 *
 * 参数：
 *   --symbol    股票代码（必填）
 *   --price     当前价格（选填，仅用于记录）
 *   --change    涨跌幅百分比（选填，仅用于记录）
 *   --type      信号类型 BULLISH|BEARISH（默认 BULLISH）
 *   --strength  信号强度 1-5（默认 3）
 *   --reason    触发原因描述（选填，自动拼接）
 *   --agent-id  Agent ID（默认 AGT-SEL-01）
 */

import { addSignal } from '../pool/stock-pool.js';

function parseArgs(): {
  symbol: string;
  price: number;
  change: number;
  type: 'BULLISH' | 'BEARISH';
  strength: number;
  reason: string;
  agentId: string;
} {
  const args = process.argv.slice(2);
  const get = (key: string) => {
    const idx = args.indexOf(`--${key}`);
    return idx >= 0 ? args[idx + 1] : '';
  };

  const symbol = get('symbol');
  const price = parseFloat(get('price') || '0');
  const change = parseFloat(get('change') || '0');
  const type = (get('type') || 'BULLISH') as 'BULLISH' | 'BEARISH';

  // Build reason automatically from provided data
  let reason = get('reason');
  if (!reason && price > 0) {
    const direction = change >= 0 ? '上涨' : '下跌';
    reason = `${symbol} 价格异动: $${price} (${direction} ${Math.abs(change)}%)`;
  }

  return {
    symbol,
    price,
    change,
    type,
    strength: parseInt(get('strength') || '3', 10),
    reason: reason || `${symbol} 价格异动信号`,
    agentId: get('agent-id') || 'AGT-SEL-01',
  };
}

async function main() {
  const { symbol, price, change, type, strength, reason, agentId } = parseArgs();

  if (!symbol) {
    console.error('Usage: selector-price.ts --symbol <SYM> [--price <N>] [--change <N>] [--type BULLISH|BEARISH] [--strength 1-5] [--reason "..."] [--agent-id AGT-XXX]');
    process.exit(1);
  }

  // Submit signal to stock pool (pure data action)
  addSignal({
    symbol,
    signal_type: type,
    strength,
    source: 'PRICE_BREAKOUT',
    reason,
    agent_id: agentId,
  });

  console.log(JSON.stringify({
    type: 'signal_submitted',
    status: 'ok',
    symbol,
    signal_type: type,
    strength,
    reason,
    price,
    change_pct: change,
  }));
}

main().catch(console.error);
