/**
 * 交易广播脚本
 *
 * 用法：
 *   npx tsx src/scripts/broadcast-trade.ts --trade-id TRD-20260521-001
 *
 * 执行 Agent 在交易关闭后调用，通知所有策略 Agent 自判胜负。
 */

import { getDb } from '../core/db.js';
import { sendMessage } from '../notify/feishu.js';
import type { TradeBroadcast } from '../core/types.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (key: string) => {
    const idx = args.indexOf(`--${key}`);
    return idx >= 0 ? args[idx + 1] : '';
  };
  return { tradeId: get('trade-id') };
}

async function main() {
  const { tradeId } = parseArgs();

  if (!tradeId) {
    console.error('Usage: broadcast-trade.ts --trade-id <ID>');
    process.exit(1);
  }

  const trade = getDb().prepare('SELECT * FROM trades WHERE trade_id = ?').get(tradeId) as any;
  if (!trade) {
    console.log(JSON.stringify({ error: `Trade ${tradeId} not found` }));
    process.exit(1);
  }

  // 获取参与此轮投票的所有 agent
  const votes = getDb().prepare('SELECT DISTINCT agent_id FROM agent_votes WHERE trade_id = ?').all(tradeId) as any[];
  const agentIds = votes.map((v: any) => v.agent_id);

  const broadcast: TradeBroadcast = {
    trade_id: trade.trade_id,
    symbol: trade.symbol,
    buy_price: trade.buy_price,
    sell_price: trade.sell_price ?? 0,
    pnl: trade.pnl ?? 0,
    pnl_pct: trade.pnl_pct ?? 0,
    buy_time: trade.buy_time,
    sell_time: trade.sell_time ?? '',
    approved_by: trade.approved_by,
  };

  // 飞书通知
  const emoji = (trade.pnl ?? 0) >= 0 ? '🟢' : '🔴';
  await sendMessage(
    `${emoji} 交易关闭\n` +
    `${trade.symbol} | ${trade.direction}\n` +
    `买入 $${trade.buy_price} → 卖出 $${trade.sell_price}\n` +
    `盈亏 ${trade.pnl_pct?.toFixed?.(2) ?? '?'}% ($${trade.pnl?.toFixed?.(2) ?? '?'})\n` +
    `轮次: ${trade.approved_by}\n` +
    `参与投票: ${agentIds.length} 个 Agent`
  );

  const output = {
    status: 'broadcast',
    trade_id: tradeId,
    agent_count: agentIds.length,
    agent_ids: agentIds,
  };

  console.log(JSON.stringify(output));
}

main().catch(console.error);
