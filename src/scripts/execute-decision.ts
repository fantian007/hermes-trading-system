/**
 * 执行决策脚本 — 下单 + 风控
 *
 * 用法：
 *   npx tsx src/scripts/execute-decision.ts \
 *     --round-id ELEC-20260521-1430 \
 *     --symbol NVDA.US \
 *     --action BUY \
 *     --confidence 0.72
 *
 * 执行 Agent 调用：
 *   1. (可选) 向 data-agent 请求当前价格 → data-service --type quote --symbol <SYM>
 *   2. 风控检查
 *   3. 计算下单量
 *   4. 提交订单（Longbridge 模拟盘）
 *   5. 输出交易 ID
 *
 * 注意：在自然语言对话流程中，执行 Agent 应先问 data-agent "当前 NVDA.US 价格是多少？"
 *       data-agent 返回价格后再运行此脚本。脚本内部也保留了 getQuote 调用作为兜底。
 */

import { submitBuyOrder, submitSellOrder } from '../trading/order.js';
import { getPositions } from '../trading/account.js';
import { runAllChecks } from '../trading/risk.js';
import { getDb } from '../core/db.js';
import { config } from '../core/config.js';
import { sendMessage, notifyTradeExecution } from '../notify/feishu.js';

interface Args {
  roundId: string;
  symbol: string;
  action: string;
  confidence: number;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const get = (key: string) => {
    const idx = args.indexOf(`--${key}`);
    return idx >= 0 ? args[idx + 1] : '';
  };
  return {
    roundId:    get('round-id'),
    symbol:     get('symbol'),
    action:     get('action') || 'HOLD',
    confidence: parseFloat(get('confidence') || '0'),
  };
}

async function main() {
  const { roundId, symbol, action, confidence } = parseArgs();

  if (!roundId || !symbol) {
    console.error('Usage: execute-decision.ts --round-id <ID> --symbol <SYM> --action BUY|SELL');
    process.exit(1);
  }

  if (action === 'HOLD') {
    console.log(JSON.stringify({ status: 'skipped', reason: 'HOLD decision — no action' }));
    process.exit(0);
  }

  // 1. 获取当前持仓
  const posResult = await getPositions();
  if ('error' in posResult) {
    console.log(JSON.stringify({ error: posResult.error }));
    process.exit(1);
  }

  const positions = posResult?.channels?.[0]?.positions ?? [];
  const existingPos = positions.find((p: any) => p.symbol === symbol);

  // 获取当前价格
  const { getQuote } = await import('../market/quote.js');
  const quoteResult = await getQuote([symbol]);
  if ('error' in quoteResult || !quoteResult?.[0]) {
    console.log(JSON.stringify({ error: 'Failed to get quote' }));
    process.exit(1);
  }
  const currentPrice = quoteResult[0].last || 0;

  // 2. 风控检查
  const existingQty = existingPos?.quantity ?? 0;
  const entryPrice = existingPos?.costPrice ?? 0;

  const riskCheck = runAllChecks(symbol, currentPrice, existingQty, entryPrice);

  if (!riskCheck.passed) {
    console.log(JSON.stringify({
      status: 'rejected',
      reason: 'Risk check failed',
      failures: riskCheck.failures,
    }));
    await sendMessage(`🛑 风控拒绝\n${symbol} ${action}\n原因: ${riskCheck.failures.join(', ')}`);
    process.exit(1);
  }

  // 3. 计算下单量
  const maxPositionValue = config.totalAsset * config.maxPositionPct;
  let quantity: number;

  if (action === 'BUY') {
    const maxQty = Math.floor(maxPositionValue / currentPrice);
    quantity = maxQty;
  } else {
    // SELL: 卖出全部持仓
    quantity = existingPos?.availableQuantity ?? existingPos?.quantity ?? 0;
    if (quantity <= 0) {
      console.log(JSON.stringify({ status: 'skipped', reason: 'No position to sell' }));
      process.exit(0);
    }
  }

  // 4. 下单
  let orderResult: any;
  if (action === 'BUY') {
    orderResult = await submitBuyOrder(symbol, quantity);
  } else {
    orderResult = await submitSellOrder(symbol, quantity);
  }

  if ('error' in orderResult) {
    console.log(JSON.stringify({ error: `Order failed: ${orderResult.error}` }));
    process.exit(1);
  }

  const orderId = orderResult.order_id;
  const tradeId = `TRD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`;

  // 5. 记录交易
  getDb().prepare(`
    INSERT INTO trades (trade_id, symbol, direction, buy_price, quantity, approved_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(tradeId, symbol, 'LONG', currentPrice, quantity, roundId);

  // 更新选举轮次
  getDb().prepare(`
    UPDATE election_rounds SET resulted_trade_id = ?, executed_at = datetime('now') WHERE round_id = ?
  `).run(tradeId, roundId);

  // 6. 通知
  await notifyTradeExecution({
    trade_id: tradeId,
    symbol,
    buy_price: currentPrice,
    sell_price: 0,  // 将在平仓时更新
    pnl: 0,
    pnl_pct: 0,
    buy_time: new Date().toISOString(),
    sell_time: '',
    approved_by: roundId,
  });

  const output = {
    status: 'executed',
    trade_id: tradeId,
    order_id: orderId,
    symbol,
    action,
    quantity,
    price: currentPrice,
    confidence,
  };

  console.log(JSON.stringify(output));
}

main().catch(console.error);
