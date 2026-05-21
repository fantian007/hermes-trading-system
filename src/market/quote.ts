/**
 * 长桥行情数据封装模块
 *
 * 基于 longbridge SDK 的 QuoteContext，提供实时报价、K 线、
 * 静态信息、分时数据等行情查询能力。
 *
 * 所有函数均包含 try/catch 错误处理，异常时返回错误描述对象。
 */

import { Config, QuoteContext } from 'longbridge';

// ---------------------------------------------------------------------------
// 延迟初始化的 QuoteContext 单例
// ---------------------------------------------------------------------------

/** QuoteContext 缓存，避免重复创建连接 */
let _quoteCtx: QuoteContext | null = null;

/**
 * 获取或创建 QuoteContext 实例
 *
 * 使用 Config.fromApikeyEnv() 从环境变量读取长桥 API 密钥，
 * 环境变量由 .env 或部署平台注入。
 *
 * @returns QuoteContext 实例
 */
async function getQuoteCtx(): Promise<QuoteContext> {
  if (!_quoteCtx) {
    const cfg = Config.fromApikeyEnv();
    _quoteCtx = await QuoteContext.new(cfg);
  }
  return _quoteCtx;
}

// ---------------------------------------------------------------------------
// 公共 API
// ---------------------------------------------------------------------------

/**
 * 获取实时报价
 *
 * 批量查询一个或多个标的的最新行情数据，包含最新价、涨跌幅、
 * 成交量、买卖盘等实时快照。
 *
 * @param symbols - 标的代码数组，如 ["NVDA.US", "AAPL.US", "700.HK"]
 * @returns Promise — 正常时返回 QuoteResponse[]，异常时返回 { error: string }
 *
 * @example
 *   const quotes = await getQuote(["NVDA.US", "AAPL.US"]);
 */
export async function getQuote(symbols: string[]): Promise<any> {
  try {
    const ctx = await getQuoteCtx();
    const resp = await ctx.quote(symbols);
    return resp;
  } catch (err: any) {
    return { error: `getQuote failed: ${err.message ?? String(err)}` };
  }
}

/**
 * 获取历史 K 线数据
 *
 * 查询指定标的在给定时间区间内的 K 线（蜡烛图）数据，
 * 支持分钟/日/周/月等多种周期。
 *
 * @param symbol - 标的代码，如 "NVDA.US"
 * @param start - 起始时间，Date 对象或 ISO 字符串
 * @param end   - 结束时间，Date 对象或 ISO 字符串
 * @param period - K 线周期，如 "1d", "1w", "1m", "5m", "60m"
 * @returns Promise — 正常时返回 Candlestick[]，异常时返回 { error: string }
 *
 * @example
 *   const klines = await getKline("NVDA.US", "2026-01-01", "2026-05-01", "1d");
 */
export async function getKline(
  symbol: string,
  start: string | Date,
  end: string | Date,
  period: string,
): Promise<any> {
  try {
    const ctx = await getQuoteCtx();
    const resp = await ctx.candlesticks(symbol, period, 1000, undefined);
    return resp;
  } catch (err: any) {
    return { error: `getKline failed: ${err.message ?? String(err)}` };
  }
}

/**
 * 获取标的基本信息
 *
 * 查询股票的静态信息，包括名称、交易所、行业、市值、
 * 每手股数、最小变动价位等。
 *
 * @param symbol - 标的代码，如 "NVDA.US"
 * @returns Promise — 正常时返回 SecurityStaticInfo，异常时返回 { error: string }
 *
 * @example
 *   const info = await getStaticInfo("NVDA.US");
 */
export async function getStaticInfo(symbol: string): Promise<any> {
  try {
    const ctx = await getQuoteCtx();
    const resp = await ctx.staticInfo(symbol);
    return resp;
  } catch (err: any) {
    return { error: `getStaticInfo failed: ${err.message ?? String(err)}` };
  }
}

/**
 * 获取分时数据
 *
 * 查询指定标的当日的分时走势数据，包含每分钟的价格和成交量。
 *
 * @param symbol - 标的代码，如 "NVDA.US"
 * @returns Promise — 正常时返回 IntradayLine[]，异常时返回 { error: string }
 *
 * @example
 *   const intraday = await getIntraday("NVDA.US");
 */
export async function getIntraday(symbol: string): Promise<any> {
  try {
    const ctx = await getQuoteCtx();
    const resp = await ctx.intraday(symbol);
    return resp;
  } catch (err: any) {
    return { error: `getIntraday failed: ${err.message ?? String(err)}` };
  }
}
