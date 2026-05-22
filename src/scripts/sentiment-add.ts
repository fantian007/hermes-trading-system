/**
 * 舆情部门 — 添加股池信号
 *
 * 职责（仅此一项）：
 *   将 Agent 提供的股票信号写入 stock_pool 表，状态 ACTIVE。
 *   不做任何业务判断——Agent 自己决定加什么、为什么加。
 *
 * 用法：
 *   npx tsx src/scripts/sentiment-add.ts \
 *     --symbol NVDA.US \
 *     --signal-type BULLISH \
 *     --strength 4 \
 *     --source "财报分析" \
 *     --reason "Q1营收超预期，AI业务增长强劲"
 */

import { addSignal } from '../pool/stock-pool.js';

interface Args {
  symbol: string;
  signalType: string;
  strength: number;
  source: string;
  reason: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const get = (key: string) => {
    const idx = args.indexOf(`--${key}`);
    return idx >= 0 ? args[idx + 1] : '';
  };
  return {
    symbol:     get('symbol'),
    signalType: (get('signal-type') || '').toUpperCase(),
    strength:   parseInt(get('strength') || '1', 10),
    source:     get('source'),
    reason:     get('reason'),
  };
}

function main() {
  const { symbol, signalType, strength, source, reason } = parseArgs();

  if (!symbol || !signalType || !['BULLISH', 'BEARISH'].includes(signalType)) {
    console.error('Usage: sentiment-add.ts --symbol <SYM> --signal-type BULLISH|BEARISH --strength <1-5> --source <SRC> --reason <REASON>');
    process.exit(1);
  }

  addSignal({
    symbol,
    signal_type: signalType as 'BULLISH' | 'BEARISH',
    strength: Math.max(1, Math.min(5, strength)),
    source,
    reason,
    source_url: undefined,
    agent_id: 'SENT-001',
  });

  console.log(JSON.stringify({
    status: 'added',
    symbol,
    signal_type: signalType,
    strength,
    source,
    reason,
  }));
}

main();
