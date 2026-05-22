/**
 * 24H 交易守护进程
 *
 * 定时执行完整交易周期：
 *   1. 提交价格异动信号
 *   2. 盯盘扫描 → 触发投票
 *   3. 审计周期（每 30 分钟）
 *
 * 用法：
 *   npx tsx src/scripts/daemon.ts
 *
 * 可通过 cron 或 systemd 启动，实现 24H 无人值守运行。
 */

import { execSync } from 'node:child_process';

const WORKDIR = '/Users/zys/workspace/hermes-trading-system';
const SCAN_INTERVAL_MS = 5 * 60 * 1000; // 5 分钟
const AUDIT_INTERVAL_MS = 30 * 60 * 1000; // 30 分钟

let lastScan = 0;
let lastAudit = 0;

function run(script: string, args: string = ''): string {
  try {
    const result = execSync(`npx tsx src/scripts/${script}.ts ${args}`, {
      cwd: WORKDIR,
      timeout: 60_000,
      maxBuffer: 1024 * 1024,
    }).toString().trim();
    return result;
  } catch (e: any) {
    return `ERROR: ${e.stderr?.toString()?.slice(0, 200) ?? e.message}`;
  }
}

function log(msg: string) {
  const ts = new Date().toISOString().slice(0, 19).replace('T', ' ');
  console.log(`[${ts}] ${msg}`);
}

async function main() {
  log('🚀 Hermes Trading Daemon started');
  log(`   Scan interval: ${SCAN_INTERVAL_MS / 1000}s`);
  log(`   Audit interval: ${AUDIT_INTERVAL_MS / 1000}s`);

  // 立即执行首次扫描
  await scanCycle();
  await auditCycle();

  // 主循环
  setInterval(async () => {
    const now = Date.now();
    if (now - lastScan >= SCAN_INTERVAL_MS) {
      await scanCycle();
    }
    if (now - lastAudit >= AUDIT_INTERVAL_MS) {
      await auditCycle();
    }
  }, 30_000); // 每 30 秒检查一次

  // 保持进程运行
  process.on('SIGINT', () => { log('Shutting down...'); process.exit(0); });
  process.on('SIGTERM', () => { log('Shutting down...'); process.exit(0); });
}

async function scanCycle() {
  lastScan = Date.now();
  log('🔍 Scan cycle...');

  // 1. 提交价格异动信号（检查关注标的）
  const symbols = ['NVDA.US', 'AAPL.US', 'TSLA.US', 'MSFT.US', 'GOOGL.US', 'AMZN.US', 'META.US'];
  for (const sym of symbols) {
    try {
      const quoteOut = execSync(`longbridge quote ${sym} --format json`, { timeout: 10_000 }).toString();
      const quote = JSON.parse(quoteOut)[0];
      if (!quote) continue;

      const price = quote.last;
      const changePct = parseFloat(quote.change_percentage);
      const prevClose = quote.prev_close || price;

      // 异动检测：涨跌超过 2% 或价格突破关键位
      if (Math.abs(changePct) >= 2) {
        const type = changePct > 0 ? 'BULLISH' : 'BEARISH';
        const strength = Math.abs(changePct) >= 5 ? 5 : Math.abs(changePct) >= 3 ? 4 : 3;
        run('submit-signal',
          `--symbol ${sym} --type ${type} --strength ${strength} --source PRICE_BREAKOUT ` +
          `--reason "异动检测: ${sym} ${changePct > 0 ? '+' : ''}${changePct}% @ $${price}" ` +
          `--agent-id AGT-SEL-01`);
        log(`Signal: ${sym} ${type} strength=${strength} (${changePct}%)`);
      }
    } catch { /* skip failed symbols */ }
  }

  // 2. 盯盘扫描 → 触发投票
  const watchOut = run('trigger-vote');
  if (watchOut.includes('created')) {
    const match = watchOut.match(/created (\S+)/);
    if (match) log(`Election created: ${match[1]}`);
  }
}

async function auditCycle() {
  lastAudit = Date.now();
  log('📊 Audit cycle...');
  const out = run('audit-cycle');
  // 只输出关键行
  const lines = out.split('\n').filter(l => l.includes('SHADOW') || l.includes('ACTIVE') || l.includes('TERMINATED'));
  for (const line of lines) log(`  ${line.trim()}`);
}

main().catch(console.error);
