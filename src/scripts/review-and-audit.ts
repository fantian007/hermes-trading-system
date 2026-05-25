/**
 * 交易事后审计数据提供者
 *
 * 职责（仅此一项）：
 *   加载交易详情 + 选举委员会推理过程 + Agent 投票数据 + 标的 K 线价格序列，
 *   输出 JSON 上下文供 Review Agent 做自然语言审计。
 *
 * K 线通过 data-service.ts 子进程获取，支持审核 Agent 做 MACD/RSI/布林带等技术审核。
 *
 * 不输出任何 verdict 模板——Agent 自己决定怎么审核。
 *
 * 用法：
 *   npx tsx src/scripts/review-and-audit.ts --trade-id TRD-20260521-001
 *   npx tsx src/scripts/review-and-audit.ts --trade-id TRD-20260521-001 --kline-days 100
 */

import { execSync } from 'node:child_process';
import { getDb } from '../core/db.js';

interface Args {
  tradeId: string;
  klineDays: number;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const get = (key: string) => {
    const idx = args.indexOf(`--${key}`);
    return idx >= 0 ? args[idx + 1] : '';
  };
  return {
    tradeId: get('trade-id'),
    klineDays: parseInt(get('kline-days'), 10) || 100,
  };
}

/**
 * 通过 data-service.ts 子进程获取 K 线数据
 * 留 30s 超时 + 错误容错，网络失败时不阻断审计主流程
 */
function fetchKlines(symbol: string, days: number): any[] | null {
  try {
    const scriptPath = new URL('./data-service.ts', import.meta.url).pathname;
    const out = execSync(
      `npx tsx ${scriptPath} --type kline --symbol ${symbol} --days ${days}`,
      { timeout: 30_000, maxBuffer: 1024 * 1024 },
    ).toString().trim();
    const parsed = JSON.parse(out);
    return parsed?.klines ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const { tradeId, klineDays } = parseArgs();

  if (!tradeId) {
    console.error('Usage: review-and-audit.ts --trade-id <TRADE_ID> [--kline-days 100]');
    process.exit(1);
  }

  const db = getDb();

  // 1. 加载交易信息
  const trade = db.prepare('SELECT * FROM trades WHERE trade_id = ?').get(tradeId) as any;
  if (!trade) {
    console.log(JSON.stringify({ error: `Trade ${tradeId} not found` }));
    process.exit(1);
  }

  // 2. 加载关联的选举轮次
  const round = db.prepare('SELECT * FROM election_rounds WHERE round_id = ?').get(trade.approved_by) as any;

  // 3. 加载该轮次的所有 Agent 投票
  const votes = db.prepare(
    'SELECT * FROM agent_votes WHERE trade_id = ? ORDER BY voted_at'
  ).all(tradeId) as any[];

  // 4. 获取标的 K 线价格序列（用于技术指标审核）
  const klines = fetchKlines(trade.symbol, klineDays);

  // 5. 输出原始数据——Agent 自己判断
  const context: Record<string, any> = {
    trade: {
      trade_id: trade.trade_id,
      symbol: trade.symbol,
      direction: trade.direction,
      buy_price: trade.buy_price,
      sell_price: trade.sell_price,
      quantity: trade.quantity,
      pnl: trade.pnl,
      pnl_pct: trade.pnl_pct,
      buy_time: trade.buy_time,
      sell_time: trade.sell_time,
      hold_duration_s: trade.hold_duration_s,
      status: trade.status,
      created_at: trade.created_at,
      closed_at: trade.closed_at,
    },
    election_round: round ? {
      round_id: round.round_id,
      symbol: round.symbol,
      total_voters: round.total_voters,
      buy_votes: round.buy_votes,
      sell_votes: round.sell_votes,
      hold_votes: round.hold_votes,
      final_decision: round.final_decision,
      decision_confidence: round.decision_confidence,
      created_at: round.created_at,
    } : null,
    agent_votes: votes.map((v: any) => ({
      vote_id: v.vote_id,
      agent_id: v.agent_id,
      vote_node: v.vote_node,
      vote_direction: v.vote_direction,
      confidence: v.confidence,
      reasoning: v.reasoning,
      voted_at: v.voted_at,
      is_shadow: !!v.is_shadow,
    })),
  };

  // 如果成功获取到 K 线数据，按时间倒序输出（最新在前），
  // 审核 Agent 可据此计算 MACD/RSI/布林带等技术指标
  if (klines && klines.length > 0) {
    context.kline = {
      symbol: trade.symbol,
      count: klines.length,
      days_requested: klineDays,
      records: klines,
    };
  }

  console.log(JSON.stringify(context, null, 2));
}

main().catch(console.error);
