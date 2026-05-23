/**
 * 股池查询服务 — Stock Pool Query Service
 *
 * 数据部门核心模块，供所有其他部门查询当前候选股池。
 *
 * 职责：
 *   1. 从 SQLite stock_pool 读取 ACTIVE 信号
 *   2. 按 symbol 分组聚合（多 Agent 对同一股票的信号叠加）
 *   3. 批量查询长桥实时行情（含股票名称）
 *   4. 处理连接失败重试、长桥认证失败降级
 *   5. 输出标准化 StockPoolResult 结构
 *
 * 导出：
 *   fetchStockPool(opts?) — 完整股池查询（可选跳过实时行情）
 *   aggregateSignals()   — 纯函数：信号按 symbol 分组（方便单元测试）
 *
 * 用法：
 *   import { fetchStockPool } from '../pool/query.js';
 *   const result = fetchStockPool();
 *
 *   // 跳过行情查询（离线/长桥不可用时）
 *   const result = fetchStockPool({ skipQuotes: true });
 */

import { execSync } from 'node:child_process';
import { getActivePool } from './stock-pool.js';
import type { StockPoolItem, StockPoolStock, StockPoolResult } from '../core/types.js';

// ============================================================================
// Types
// ============================================================================

/** fetchStockPool 可选参数 */
export interface FetchStockPoolOptions {
  /** 跳过长桥实时行情查询（离线/长桥不可用时设置） */
  skipQuotes?: boolean;
  /** 长桥 CLI 单次调用超时（ms），默认 10_000 */
  lbTimeoutMs?: number;
  /** 长桥 CLI 重试次数，默认 2 */
  lbRetries?: number;
}

// ============================================================================
// Synchronous sleep helper
// ============================================================================

/**
 * 阻塞当前线程 sleep（毫秒）
 *
 * Node.js 同步上下文中使用 child_process.execSync('sleep N')
 * 比 spin-wait 节省 CPU，在 macOS / Linux 均可工作。
 */
function sleepSync(ms: number): void {
  if (ms <= 0) return;
  const sec = Math.max(0.1, ms / 1000);
  execSync(`sleep ${sec}`, { timeout: Math.ceil(ms + 500) });
}

// ============================================================================
// Longbridge CLI helper
// ============================================================================

/**
 * 调用长桥 CLI 并解析 JSON 输出
 *
 * 处理 CLI 输出中可能包含的进度行（如 "Submitting..."），
 * 从最后一行起寻找合法的 JSON 解析。
 */
function lb(args: string, timeoutMs = 10_000): any {
  try {
    const out = execSync(`longbridge ${args} --format json`, {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
    }).toString().trim();
    if (!out) return [];
    const lines = out.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('{') || line.startsWith('[')) {
        return JSON.parse(line);
      }
    }
    return [];
  } catch (e: any) {
    // 长桥 CLI 不可用（认证过期/网络断开/超时）
    // 返回错误对象而不是抛出，调用方自行降级
    const msg = e.stderr?.toString()?.slice(0, 300) ?? e.message ?? 'Unknown error';
    return { error: msg };
  }
}

// ============================================================================
// Retry helper
// ============================================================================

/**
 * 带指数退避的重试包装器
 *
 * 对数据库读操作（SQLite 偶发 busy）和长桥 CLI（偶发网络故障）进行重试。
 * 最多重试 maxRetries 次，每次间隔翻倍（使用同步 sleep）。
 */
function withRetry<T>(fn: () => T, maxRetries = 3, baseDelayMs = 1000): T {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return fn();
    } catch (e: any) {
      lastError = e;
      if (attempt < maxRetries) {
        sleepSync(baseDelayMs * Math.pow(2, attempt - 1));
      }
    }
  }
  throw lastError;
}

// ============================================================================
// Signal aggregation (pure function — testable)
// ============================================================================

/**
 * 将原始股池记录按 symbol 聚合为标准化的股票列表
 *
 * 纯函数，不访问 I/O，不依赖长桥 CLI。输入来自 getActivePool()，输出 Map。
 * 同一股票可能有来自多个 Agent 的多条 BULLISH/BEARISH 信号，此函数负责统计。
 *
 * @param poolItems - 来自 getActivePool() 的原始记录数组
 * @returns 按 symbol 分组的 Map，每个条目含信号聚合统计
 */
export function aggregateSignals(poolItems: StockPoolItem[]): Map<string, StockPoolStock> {
  const symbolMap = new Map<string, StockPoolStock>();

  for (const item of poolItems) {
    const existing = symbolMap.get(item.symbol);

    if (existing) {
      existing.signal_count++;
      existing.signals.push({
        agent_id: item.agent_id,
        signal_type: item.signal_type,
        strength: item.strength,
        source: item.source,
        reason: item.reason,
        added_at: item.added_at,
      });
      if (item.signal_type === 'BULLISH') {
        existing.aggregate.bullish_signals++;
      } else {
        existing.aggregate.bearish_signals++;
      }
      existing.aggregate.total_strength += item.strength;
    } else {
      const isBullish = item.signal_type === 'BULLISH';
      symbolMap.set(item.symbol, {
        symbol: item.symbol,
        name: null, // filled later by quote
        signal_count: 1,
        aggregate: {
          bullish_signals: isBullish ? 1 : 0,
          bearish_signals: isBullish ? 0 : 1,
          total_strength: item.strength,
          avg_strength: 0, // computed below
        },
        signals: [{
          agent_id: item.agent_id,
          signal_type: item.signal_type,
          strength: item.strength,
          source: item.source,
          reason: item.reason,
          added_at: item.added_at,
        }],
      });
    }
  }

  // 计算平均强度
  for (const [, stock] of symbolMap) {
    stock.aggregate.avg_strength = parseFloat(
      (stock.aggregate.total_strength / stock.signal_count).toFixed(2),
    );
  }

  return symbolMap;
}

// ============================================================================
// Main: fetch stock pool with quotes
// ============================================================================

/**
 * 获取当前股池及实时行情
 *
 * 三阶段流程：
 *   Phase 1: 从 SQLite 读取 ACTIVE 信号（带重试）
 *   Phase 2: 按 symbol 聚合信号
 *   Phase 3: 批量查询长桥实时行情（含股票名称），分批处理，单批失败不影响其他
 *
 * 空池安全：poolItems 为空时返回 pool_size=0，不报错。
 * 长桥降级：quote 查询失败时 stocks 仍返回信号数据，仅 quote 字段缺失。
 * skipQuotes：跳过 Phase 3，适用于离线环境或长桥不可用时。
 *
 * @param opts - 可选参数
 * @returns StockPoolResult — 标准化股池结构
 */
export function fetchStockPool(opts: FetchStockPoolOptions = {}): StockPoolResult {
  const {
    skipQuotes = false,
    lbTimeoutMs = 10_000,
    lbRetries = 2,
  } = opts;

  // Phase 1: 读取股池（带重试，SQLite 偶发 busy）
  const poolItems = withRetry(() => getActivePool(), 3, 500);

  // Phase 2: 空池处理
  if (poolItems.length === 0) {
    return {
      pool_size: 0,
      unique_symbols: [],
      stocks: [],
      generated_at: new Date().toISOString(),
    };
  }

  // Phase 2: 按 symbol 分组聚合
  const symbolMap = aggregateSignals(poolItems);
  const symbols = [...symbolMap.keys()].sort();

  // Phase 3: 批量查询行情（可跳过）
  if (skipQuotes) {
    return {
      pool_size: poolItems.length,
      unique_symbols: symbols,
      stocks: [...symbolMap.values()],
      generated_at: new Date().toISOString(),
    };
  }

  // 每批最多 10 只，含重试 + 降级
  const BATCH_SIZE = 10;

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const quoteResult = withRetry(
      () => lb(`quote ${batch.join(' ')}`, lbTimeoutMs),
      lbRetries + 1,
      1000,
    );

    if (quoteResult && !quoteResult.error && Array.isArray(quoteResult)) {
      for (const q of quoteResult) {
        const stock = symbolMap.get(q.symbol);
        if (!stock) continue;

        // 股票名称
        stock.name = q.name || q.symbol_name || q.symbol || null;

        // 实时行情
        stock.quote = {
          last: parseFloat(q.last ?? '0'),
          change_pct: parseFloat(q.change_percentage ?? '0'),
          volume: parseFloat(q.volume ?? '0'),
          prev_close: parseFloat(q.prev_close ?? '0'),
          high: parseFloat(q.high ?? '0'),
          low: parseFloat(q.low ?? '0'),
        };
      }
    }
    // quote 失败时静默降级 — stocks 仍然返回信号数据，仅无 quote
  }

  return {
    pool_size: poolItems.length,
    unique_symbols: symbols,
    stocks: [...symbolMap.values()],
    generated_at: new Date().toISOString(),
  };
}
