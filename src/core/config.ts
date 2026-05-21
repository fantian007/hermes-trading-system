/**
 * 全局配置模块
 *
 * 所有参数通过环境变量注入，提供类型安全的 getter。
 * 风控、选举、盯盘等参数均在此集中管理。
 */

import type { AppConfig } from './types.js';

/** 从环境变量解析数值，带默认值 */
function num(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return defaultValue;
  const parsed = parseFloat(raw);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * 应用配置单例
 *
 * 使用方式：
 *   import { config } from './config.js';
 *   const maxPos = config.maxPositionPct;
 */
export const config: AppConfig = {
  totalAsset:       num('TOTAL_ASSET', 88_000),
  maxPositionPct:   num('MAX_POSITION_PCT', 0.20),
  minCashReserve:   num('MIN_CASH_RESERVE', 0.10),
  maxDailyTrades:   num('MAX_DAILY_TRADES', 10),
  maxLossPerTrade:  num('MAX_LOSS_PER_TRADE', 0.05),
  maxDrawdownDaily: num('MAX_DRAWDOWN_DAILY', 0.08),
  minVoters:        num('MIN_VOTERS', 3),
  holdRatioMax:     num('HOLD_RATIO_MAX', 0.50),
  directionThreshold: num('DIRECTION_THRESHOLD', 0.55),
  scanIntervalSec:  num('SCAN_INTERVAL_SEC', 300),
  voteCooldownSec:  num('VOTE_COOLDOWN_SEC', 1800),
  commission:       num('COMMISSION', 2.00),
};

/** 飞书配置 */
export const feishu = {
  appId:     process.env.FEISHU_APP_ID     ?? '',
  appSecret: process.env.FEISHU_APP_SECRET ?? '',
  chatId:    process.env.FEISHU_CHAT_ID    ?? '',
};

/** 长桥配置 */
export const longbridge = {
  appKey:      process.env.LONGBRIDGE_APP_KEY      ?? '',
  appSecret:   process.env.LONGBRIDGE_APP_SECRET   ?? '',
  accessToken: process.env.LONGBRIDGE_ACCESS_TOKEN ?? '',
};

/** 数据库路径 */
export const DB_PATH = process.env.DB_PATH ?? './data/trading.db';
