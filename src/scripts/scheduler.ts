#!/usr/bin/env node
/**
 * Hermes Trading System — Central Scheduler Daemon (SCH-001)
 *
 * 中心调度器。独立常驻进程，永不退出。
 * 唯一职责：定时查询股池 → 逐只海龟分析 → 广告通知。
 * 不投票、不交易、不做策略决策。
 *
 * 用法：
 *   node --import tsx src/scripts/scheduler.ts              # 常驻模式（默认 5 分钟）
 *   node --import tsx src/scripts/scheduler.ts --once       # 单次运行
 *   node --import tsx src/scripts/scheduler.ts --interval 3 # 3 分钟间隔
 *   node --import tsx src/scripts/scheduler.ts --account 88000
 *
 * 特性：
 *   - 异常隔离：单只股票分析失败不影响其余
 *   - 优雅启停：SIGTERM/SIGINT 排空当前周期再退出
 *   - 守护模式：致命错误自动重启（最多 5 次/小时）
 *   - 结构化日志：[ISO] LEVEL message
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

// ============================================================================
// Constants
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKDIR = resolve(__dirname, '..', '..');

const DEFAULT_INTERVAL_MIN = 5;
const DEFAULT_ACCOUNT_SIZE = 88_000;
const SCRIPT_TIMEOUT_MS = 90_000;    // 单个脚本超时 90s
const MAX_RESTARTS_PER_HOUR = 5;
const RESTART_WINDOW_MS = 60 * 60 * 1000;
const GUARDIAN_RESTART_DELAY_MS = 10_000;

// ============================================================================
// Config
// ============================================================================

interface SchedulerConfig {
  intervalMs: number;
  accountSize: number;
  runOnce: boolean;
  /** 分析用的数据源: 'data-agent' | 'direct' */
  dataSource: 'data-agent' | 'direct';
}

function parseArgs(argv: string[]): SchedulerConfig {
  let interval = DEFAULT_INTERVAL_MIN;
  let accountSize = DEFAULT_ACCOUNT_SIZE;
  let runOnce = false;
  let dataSource: 'data-agent' | 'direct' = 'data-agent';

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--once':
        runOnce = true;
        break;
      case '--interval':
        interval = parseInt(argv[++i] ?? String(DEFAULT_INTERVAL_MIN), 10);
        if (isNaN(interval) || interval < 1) interval = DEFAULT_INTERVAL_MIN;
        break;
      case '--account':
        accountSize = parseInt(argv[++i] ?? String(DEFAULT_ACCOUNT_SIZE), 10);
        if (isNaN(accountSize) || accountSize <= 0) accountSize = DEFAULT_ACCOUNT_SIZE;
        break;
      case '--direct':
        dataSource = 'direct';
        break;
      case '--help':
      case '-h':
        console.log(`
Hermes Trading Scheduler — SCH-001

用法:
  node --import tsx src/scripts/scheduler.ts [选项]

选项:
  --once           单次运行后退出
  --interval <N>   扫描间隔分钟数 (默认 5)
  --account <N>    账户规模美元 (默认 88000)
  --direct         直接调用 longbridge CLI (默认走 data-agent)
  --help, -h       显示帮助
`);
        process.exit(0);
    }
  }

  return {
    intervalMs: interval * 60 * 1000,
    accountSize,
    runOnce,
    dataSource,
  };
}

// ============================================================================
// Logging
// ============================================================================

const LOG_DIR = resolve(WORKDIR, 'logs');
if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}

function ts(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function log(level: string, msg: string) {
  const line = `[${ts()}] ${level.padEnd(5)} ${msg}`;
  // Always write to stdout for immediate visibility
  process.stdout.write(line + '\n');
}

// ============================================================================
// Process spawning
// ============================================================================

interface SpawnResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  error?: string;
  durationMs: number;
}

/**
 * 运行一个子进程，返回 stdout 字符串。
 * timeout 后 SIGKILL 子进程。
 */
function runProcess(
  args: string[],
  opts: { timeoutMs?: number; input?: string } = {}
): Promise<SpawnResult> {
  const { timeoutMs = SCRIPT_TIMEOUT_MS, input } = opts;
  const start = Date.now();

  return new Promise((resolvePromise) => {
    const proc = spawn('node', ['--import', 'tsx', ...args], {
      cwd: WORKDIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: timeoutMs,
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    // Pipe input if provided (for ad-notify stdin)
    if (input !== undefined && proc.stdin) {
      proc.stdin.write(input);
      proc.stdin.end();
    }

    proc.on('close', (code: number | null) => {
      resolvePromise({
        success: code === 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code,
        durationMs: Date.now() - start,
      });
    });

    proc.on('error', (err: Error) => {
      resolvePromise({
        success: false,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: null,
        error: err.message,
        durationMs: Date.now() - start,
      });
    });
  });
}

// ============================================================================
// Step 1: Query stock pool
// ============================================================================

interface PoolStock {
  symbol: string;
  name: string | null;
  signal_count: number;
  aggregate: {
    bullish_signals: number;
    bearish_signals: number;
    avg_strength: number;
  };
}

interface PoolResult {
  pool_size: number;
  unique_symbols: string[];
  stocks: PoolStock[];
}

async function queryStockPool(minSignals: number = 1): Promise<PoolResult | null> {
  log('INFO', `📊 查询股池 (min-signals=${minSignals})...`);
  const args = ['src/scripts/pool-query.ts', '--json', '--min-signals', String(minSignals)];

  const result = await runProcess(args, { timeoutMs: 30_000 });
  if (!result.success) {
    log('ERROR', `股池查询失败: exit=${result.exitCode} err=${result.stderr.slice(0, 200)}`);
    return null;
  }

  try {
    // pool-query writes JSON to stdout, but may also have stderr status lines
    const parsed: PoolResult = JSON.parse(result.stdout);
    log('INFO', `股池查询完成: ${parsed.pool_size} 信号, ${parsed.unique_symbols.length} 只股票`);
    return parsed;
  } catch (e: any) {
    log('ERROR', `股池 JSON 解析失败: ${e.message} raw=${result.stdout.slice(0, 200)}`);
    return null;
  }
}

// ============================================================================
// Step 2: Analyze one stock
// ============================================================================

async function analyzeStock(
  symbol: string,
  accountSize: number,
  dataSource: 'data-agent' | 'direct'
): Promise<string | null> {
  const args = [
    'src/scripts/turtle-analyze.ts',
    '--symbol', symbol,
    '--account', String(accountSize),
    '--days', '120',
  ];

  if (dataSource === 'data-agent') {
    args.push('--via', 'data-agent');
  }

  const result = await runProcess(args, { timeoutMs: 60_000 });

  if (!result.success) {
    log('WARN', `  ${symbol}: 分析失败 exit=${result.exitCode} ${result.stderr.slice(0, 150)}`);
    return null;
  }

  // Verify it's valid JSON
  try {
    JSON.parse(result.stdout);
    return result.stdout;
  } catch {
    log('WARN', `  ${symbol}: 输出非 JSON: ${result.stdout.slice(0, 100)}`);
    return null;
  }
}

// ============================================================================
// Step 3: Send notification
// ============================================================================

async function sendAdNotify(analysisJson: string): Promise<boolean> {
  const result = await runProcess(
    ['src/scripts/ad-notify.ts'],
    { input: analysisJson, timeoutMs: 30_000 }
  );

  if (!result.success) {
    log('WARN', `  通知发送失败: ${result.stderr.slice(0, 150)}`);
    return false;
  }
  return true;
}

// ============================================================================
// Step 4: Summary notification
// ============================================================================

async function sendCycleSummary(
  analyzed: number,
  success: number,
  failed: number,
  signals: Array<{ symbol: string; signal: string; strength: number }>
): Promise<void> {
  const signalLines = signals.length > 0
    ? signals.map(s => `  ${s.signal === 'BULLISH' ? '🟢' : s.signal === 'BEARISH' ? '🔴' : '⚪'} ${s.symbol} 强度${s.strength}`).join('\n')
    : '  无信号';

  const title = '📋 调度周期摘要';
  const body = [
    `分析: ${analyzed} 只  |  成功: ${success}  |  失败: ${failed}`,
    `信号:`,
    signalLines,
    `时间: ${ts()}`,
  ].join('\n');

  log('INFO', title);
  log('INFO', `  分析 ${analyzed} / 成功 ${success} / 失败 ${failed}`);

  // Send via feishu
  const args = ['src/scripts/send-notify.ts', '--message', `${title}\n\n${body}`];
  const result = await runProcess(args, { timeoutMs: 20_000 });
  if (!result.success) {
    log('WARN', `摘要通知发送失败: ${result.stderr.slice(0, 100)}`);
  }
}

// ============================================================================
// Main cycle
// ============================================================================

interface CycleResult {
  poolSize: number;
  stocksAnalyzed: number;
  successCount: number;
  failCount: number;
  signals: Array<{ symbol: string; signal: string; strength: number }>;
}

async function runCycle(config: SchedulerConfig): Promise<CycleResult> {
  const startTime = Date.now();
  log('INFO', '══════════════════════════════════════');
  log('INFO', '🔄 调度周期开始');

  const result: CycleResult = {
    poolSize: 0,
    stocksAnalyzed: 0,
    successCount: 0,
    failCount: 0,
    signals: [],
  };

  // Step 1: Query stock pool
  const pool = await queryStockPool(1);
  if (!pool || pool.stocks.length === 0) {
    log('INFO', '股池为空或无信号股票，跳过分析');
    await sendCycleSummary(0, 0, 0, []);
    log('INFO', `调度周期结束 (${((Date.now() - startTime) / 1000).toFixed(1)}s)`);
    return result;
  }

  result.poolSize = pool.stocks.length;
  log('INFO', `共有 ${pool.stocks.length} 只股票待分析`);

  // Step 2+3: Analyze each stock and notify
  const ANALYZE_DELAY_MS = 2000; // 2s gap between stocks to avoid rate limiting

  for (let i = 0; i < pool.stocks.length; i++) {
    const stock = pool.stocks[i];
    const symbol = stock.symbol;
    log('INFO', `[${i + 1}/${pool.stocks.length}] 分析 ${symbol} (${stock.name ?? '?'}, ${stock.signal_count}信号)`);

    result.stocksAnalyzed++;

    // Exception isolation: one stock failure doesn't affect others
    try {
      const analysisJson = await analyzeStock(symbol, config.accountSize, config.dataSource);
      if (analysisJson) {
        // Extract signal info for summary
        try {
          const analysis = JSON.parse(analysisJson);
          result.signals.push({
            symbol,
            signal: analysis.signal || analysis.recommendation || 'NEUTRAL',
            strength: analysis.signalStrength ?? 0,
          });
        } catch {
          result.signals.push({ symbol, signal: '?', strength: 0 });
        }

        // Send to advertising
        const notifyOk = await sendAdNotify(analysisJson);
        if (notifyOk) {
          result.successCount++;
          log('INFO', `  ${symbol}: ✅ 分析+通知完成`);
        } else {
          result.failCount++;
          log('WARN', `  ${symbol}: ⚠️ 分析完成但通知失败`);
        }
      } else {
        result.failCount++;
        log('WARN', `  ${symbol}: ❌ 分析失败 (已隔离)`);
      }
    } catch (e: any) {
      result.failCount++;
      log('ERROR', `  ${symbol}: 💥 未捕获异常: ${e.message} (已隔离)`);
    }

    // Gap between stocks
    if (i < pool.stocks.length - 1) {
      await new Promise(r => setTimeout(r, ANALYZE_DELAY_MS));
    }
  }

  // Step 4: Cycle summary
  await sendCycleSummary(
    result.stocksAnalyzed,
    result.successCount,
    result.failCount,
    result.signals
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log('INFO', `调度周期结束: ${result.successCount} 成功 / ${result.failCount} 失败 (${elapsed}s)`);

  return result;
}

// ============================================================================
// Guardian: restart on fatal errors
// ============================================================================

class Guardian {
  private restarts: number[] = [];

  /** Record a restart. Returns false if rate limit exceeded. */
  recordRestart(): boolean {
    const now = Date.now();
    // Prune old entries
    this.restarts = this.restarts.filter(t => now - t < RESTART_WINDOW_MS);

    if (this.restarts.length >= MAX_RESTARTS_PER_HOUR) {
      log('FATAL', `守护进程: 1小时内重启 ${this.restarts.length} 次，已达上限。退出。`);
      return false;
    }

    this.restarts.push(now);
    return true;
  }
}

// ============================================================================
// Main entry
// ============================================================================

async function main() {
  const config = parseArgs(process.argv);
  const guardian = new Guardian();

  log('INFO', '══════════════════════════════════════════════');
  log('INFO', '🚀 Hermes Trading Scheduler SCH-001');
  log('INFO', `   间隔: ${config.intervalMs / 1000}s | 账户: $${config.accountSize.toLocaleString()} | 数据源: ${config.dataSource}`);
  log('INFO', `   模式: ${config.runOnce ? '单次运行' : '常驻守护'}`);
  log('INFO', '══════════════════════════════════════════════');

  // Graceful shutdown
  let shuttingDown = false;
  const onSignal = (sig: string) => {
    if (shuttingDown) {
      log('WARN', `收到二次 ${sig}，强制退出`);
      process.exit(1);
    }
    shuttingDown = true;
    log('INFO', `收到 ${sig}，等待当前周期完成...`);
  };
  process.on('SIGINT', () => onSignal('SIGINT'));
  process.on('SIGTERM', () => onSignal('SIGTERM'));

  // =========================================================================
  // Core loop
  // =========================================================================
  async function runLoop(): Promise<void> {
    try {
      await runCycle(config);
    } catch (fatalError: any) {
      log('FATAL', `调度周期崩溃: ${fatalError.message}`);
      log('FATAL', fatalError.stack?.split('\n').slice(0, 5).join('\n') ?? '');

      if (guardian.recordRestart()) {
        log('WARN', `守护进程: ${GUARDIAN_RESTART_DELAY_MS / 1000}s 后重启...`);
        await new Promise(r => setTimeout(r, GUARDIAN_RESTART_DELAY_MS));
        await runLoop();
      }
      // If recordRestart returns false, we exit
      return;
    }

    if (shuttingDown) {
      log('INFO', '🛑 优雅退出完成');
      process.exit(0);
    }

    if (config.runOnce) {
      log('INFO', '单次运行完成，退出');
      process.exit(0);
    }

    // Wait for next interval
    log('INFO', `⏳ 等待 ${config.intervalMs / 1000}s 进行下一轮...`);
    await new Promise<void>((resolvePromise) => {
      const timer = setInterval(() => {
        if (shuttingDown) {
          clearInterval(timer);
          log('INFO', '🛑 等待期间收到退出信号');
          process.exit(0);
        }
        clearInterval(timer);
        resolvePromise();
      }, config.intervalMs);
    });

    await runLoop();
  }

  await runLoop();
}

// Top-level catch for truly unexpected errors
main().catch((err) => {
  process.stderr.write(`[${ts()}] FATAL 未捕获顶层异常: ${err.message}\n`);
  process.stderr.write(err.stack?.slice(0, 500) ?? '');
  process.exit(1);
});
