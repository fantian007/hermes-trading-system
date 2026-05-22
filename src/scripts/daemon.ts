/**
 * 24H 调度守护进程
 *
 * 职责：仅做任务调度，零业务逻辑。
 * 实际的信号检测、投票、审计由各 Agent 通过自然语言交互完成。
 *
 * 用法：
 *   npx tsx src/scripts/daemon.ts
 *
 * 调度计划：
 *   - 每 5 分钟：通知 selector Agent 检查市场
 *   - 每 30 分钟：通知 auditor Agent 执行审计
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKDIR = resolve(__dirname, '..', '..');

const SCAN_INTERVAL_MS = 5 * 60 * 1000;   // 5 分钟
const AUDIT_INTERVAL_MS = 30 * 60 * 1000;  // 30 分钟

let lastScan = 0;
let lastAudit = 0;

/**
 * 异步执行一个脚本，返回 stdout 字符串。
 * 使用 spawn 而非 execSync，避免阻塞事件循环。
 */
function runScript(script: string, args: string[] = []): Promise<string> {
  return new Promise((resolvePromise) => {
    const proc = spawn('npx', ['tsx', `src/scripts/${script}.ts`, ...args], {
      cwd: WORKDIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
    });

    let stdout = '';
    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) resolvePromise(`ERROR: exit code ${code}`);
      else resolvePromise(stdout.trim());
    });

    proc.on('error', (err) => {
      resolvePromise(`ERROR: ${err.message}`);
    });
  });
}

function log(msg: string) {
  const ts = new Date().toISOString().slice(0, 19).replace('T', ' ');
  console.log(`[${ts}] ${msg}`);
}

async function scanCycle() {
  lastScan = Date.now();
  log('🔍 Scan cycle — notifying selector agent (via natural language)');
  // Business logic removed: selector Agent handles market scanning via NL.
  // This daemon only exists to trigger the cadence. The Agent itself
  // decides what to watch, how to detect signals, and when to vote.
}

async function auditCycle() {
  lastAudit = Date.now();
  log('📊 Audit cycle — notifying auditor agent (via natural language)');
  // Business logic removed: auditor Agent handles all audit tasks via NL.
}

async function main() {
  log('🚀 Hermes Trading Daemon started — scheduling only, no business logic');
  log(`   Scan interval: ${SCAN_INTERVAL_MS / 1000}s`);
  log(`   Audit interval: ${AUDIT_INTERVAL_MS / 1000}s`);

  // Run both cycles immediately on startup
  await scanCycle();
  await auditCycle();

  // Poll at 30s intervals to decide if a cycle is due
  setInterval(async () => {
    const now = Date.now();
    if (now - lastScan >= SCAN_INTERVAL_MS) {
      await scanCycle();
    }
    if (now - lastAudit >= AUDIT_INTERVAL_MS) {
      await auditCycle();
    }
  }, 30_000);

  process.on('SIGINT', () => { log('Shutting down...'); process.exit(0); });
  process.on('SIGTERM', () => { log('Shutting down...'); process.exit(0); });
}

main().catch(console.error);
