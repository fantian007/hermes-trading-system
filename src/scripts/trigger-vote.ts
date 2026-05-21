/**
 * 盯盘脚本 — 检测候选股池并触发投票
 *
 * 用法：
 *   npx tsx src/scripts/trigger-vote.ts
 *
 * 由盯盘 Agent 定时调用（如 cron 每 5 分钟）。
 * 检查候选股池 + 价格异动，对符合条件的标的发起选举轮次。
 * 同一只票 30 分钟内不重复投票（止损/止盈除外）。
 */

import { getActivePool } from '../pool/stock-pool.js';
import { getQuote } from '../market/quote.js';
import { createElectionRound } from '../voting/orchestrator.js';
import { getDb } from '../core/db.js';
import { config } from '../core/config.js';
import { sendMessage } from '../notify/feishu.js';

async function main() {
  const pool = getActivePool();
  console.log(`[watch] Active pool size: ${pool.length}`);

  // 按强度排序，优先处理高强度信号
  const sorted = pool.sort((a, b) => b.strength - a.strength);

  for (const item of sorted) {
    // 冷却检查：30 分钟内是否已对该票发起过投票
    const recent = getDb().prepare(`
      SELECT round_id FROM election_rounds
      WHERE symbol = ?
        AND created_at > datetime('now', ?)
      ORDER BY created_at DESC LIMIT 1
    `).get(item.symbol, `-${Math.ceil(config.voteCooldownSec / 60)} minutes`);

    if (recent) {
      console.log(`[watch] ${item.symbol} — skipped (cooldown)`);
      continue;
    }

    // 拉最新行情
    const quoteResult = await getQuote([item.symbol]);
    if ('error' in quoteResult) {
      console.log(`[watch] ${item.symbol} — quote error: ${quoteResult.error}`);
      continue;
    }

    const quotes = quoteResult;
    if (!quotes || quotes.length === 0) continue;

    const q = quotes[0];
    const currentPrice = q.lastDone || q.last_done || 0;
    if (!currentPrice) continue;

    // 根据信号类型决定投票节点
    const voteNode = item.signal_type === 'BULLISH' ? 'BUY' : 'SELL';

    const roundId = createElectionRound(
      item.symbol,
      'PRICE_BREAKOUT',
      item.reason,
      currentPrice,
      voteNode,
      item.strength
    );

    console.log(`[watch] ${item.symbol} — created ${roundId} | price=${currentPrice} | node=${voteNode}`);
    await sendMessage(`🔔 盯盘触发投票\n${item.symbol} @ $${currentPrice}\n信号: ${item.reason}\n轮次: ${roundId}`);
  }

  console.log('[watch] Scan complete');
}

main().catch(console.error);
