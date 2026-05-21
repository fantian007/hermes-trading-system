/**
 * 账户查询 — 基于 longbridge CLI
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

export async function getAccountBalance(): Promise<any> { return lb('assets'); }
export async function getPositions(): Promise<any> { return lb('positions'); }
export async function getTodayOrders(): Promise<any> { return lb('order list'); }
export async function getPortfolio(): Promise<any> { return lb('portfolio'); }
