/**
 * 交易广播 — PURE DATA TOOL
 *
 * 职责（仅此一项）：
 *   从 DB 读取交易记录，输出完整 JSON（含参与投票的 Agent 列表）。
 *   不发送任何通知 — Agent 之间通过自然语言沟通。
 *
 * 用法：
 *   npx tsx src/scripts/broadcast-trade.ts --trade-id TRD-20260521-001
 */

import { getDb } from '../core/db.js';
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

  // Get agents who voted on this trade
  const votes = getDb().prepare('SELECT DISTINCT agent_id, vote_direction FROM agent_votes WHERE trade_id = ?').all(tradeId) as any[];
  const agentVotes = votes.map((v: any) => ({ agent_id: v.agent_id, vote_direction: v.vote_direction }));

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

  // Output pure JSON — Agent does the natural language communication
  console.log(JSON.stringify({
    type: 'trade_broadcast',
    trade: broadcast,
    participating_agents: agentVotes,
    direction: trade.direction,
    quantity: trade.quantity,
  }));
}

main().catch(console.error);
