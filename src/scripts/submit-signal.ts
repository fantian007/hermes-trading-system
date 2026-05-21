/**
 * 选股脚本 — 提交价格异动信号到候选股池
 *
 * 用法：
 *   npx tsx src/scripts/submit-signal.ts \
 *     --symbol NVDA.US \
 *     --type BULLISH \
 *     --strength 4 \
 *     --source PRICE_BREAKOUT \
 *     --reason "价格突破布林带上轨 $125，5分钟涨幅 2.3%"
 *
 * 由选股 Agent（价格异动）调用。
 */

import { addSignal, type StockSignal } from '../pool/stock-pool.js';

function parseArgs(): StockSignal {
  const args = process.argv.slice(2);
  const get = (key: string) => {
    const idx = args.indexOf(`--${key}`);
    return idx >= 0 ? args[idx + 1] : '';
  };

  return {
    symbol:       get('symbol'),
    signal_type:  (get('type') || 'BULLISH') as 'BULLISH' | 'BEARISH',
    strength:     parseInt(get('strength') || '3', 10),
    source:       get('source') || 'PRICE_BREAKOUT',
    reason:       get('reason') || '',
    agent_id:     get('agent-id') || 'AGT-SEL-01',
    source_url:   get('url') || undefined,
  };
}

const signal = parseArgs();

if (!signal.symbol || !signal.reason) {
  console.error('Usage: submit-signal.ts --symbol <SYM> --type BULLISH|BEARISH --strength 1-5 --source <SRC> --reason "..." [--agent-id AGT-XXX]');
  process.exit(1);
}

addSignal(signal);
console.log(JSON.stringify({ status: 'ok', signal }));
