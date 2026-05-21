/**
 * 行情数据层 — 基于 longbridge CLI
 *
 * 使用 longbridge CLI 的 --format json 模式获取行情数据。
 * 直接使用本地 OAuth 缓存的 token 认证。
 */

import { execSync } from 'node:child_process';

function lb(args: string): any {
  try {
    const out = execSync(`longbridge ${args} --format json`, {
      timeout: 15_000,
      maxBuffer: 1024 * 1024,
    }).toString().trim();
    if (!out) return [];
    return JSON.parse(out);
  } catch (e: any) {
    return { error: e.stderr?.toString()?.slice(0, 200) ?? e.message };
  }
}

/** 获取实时报价 */
export async function getQuote(symbols: string[]): Promise<any> {
  return lb(`quote ${symbols.join(' ')}`);
}

/** 获取日 K 线历史 */
export async function getKline(symbol: string, start: string, end: string, period: string = 'day'): Promise<any> {
  const startArg = start ? `--start ${start}` : '--count 50';
  const endArg = end ? `--end ${end}` : '';
  return lb(`kline history ${symbol} ${startArg} ${endArg} --period ${period}`);
}

/** 获取股票基本信息 */
export async function getStaticInfo(symbol: string): Promise<any> {
  return lb(`security static-info ${symbol}`);
}

/** 获取分时数据 */
export async function getIntraday(symbol: string): Promise<any> {
  return lb(`intraday ${symbol}`);
}
