/**
 * 24H 调度守护进程
 *
 * 职责：仅做任务调度，零业务逻辑。
 * 实际的信号检测、投票、审计由各 Agent 通过自然语言交互完成。
 *
 * 用法：
 *   node --import tsx src/scripts/daemon.ts
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
 * 使用 node --import tsx 代替 npx tsx，避免 npm 解析开销。
 */
function runScript(script: string, args: string[] = []): Promise<string> {
  return new Promise((resolvePromise) => {
    const proc = spawn('node', ['--import', 'tsx', `src/scripts/${script}.ts`, ...args], {
      cwd: WORKDIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) resolvePromise(`ERROR: exit ${code}\n${stderr.slice(0, 500)}`);
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
  log('🔍 Scan cycle — notifying selector agent');
  const result = await runScript('send-notify', ['--message', '🔍 选股扫描周期']);
  if (result) log(`   send-notify: ${result.slice(0, 200)}`);
}

async function auditCycle() {
  lastAudit = Date.now();
  log('📊 Audit cycle — notifying auditor agent');
  const result = await runScript('send-notify', ['--message', '📊 审计周期启动']);
  if (result) log(`   send-notify: ${result.slice(0, 200)}`);
}

async function main() {
  log('🚀 Hermes Trading Daemon started');
  log(`   Scan interval: ${SCAN_INTERVAL_MS / 1000}s | Audit interval: ${AUDIT_INTERVAL_MS / 1000}s`);

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

main().catch((err) => { process.stderr.write(`Daemon fatal: ${err.message}\n`); process.exit(1); });
