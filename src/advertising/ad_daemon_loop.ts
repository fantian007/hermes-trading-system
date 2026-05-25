#!/usr/bin/env npx tsx
/**
 * ADV-001 广告部门常驻守护进程
 *
 * 负责：监听 Kanban ready 任务 → 去重 → send-card.ts 发送 → 标记 done
 * 运行方式：npx tsx src/advertising/ad_daemon_loop.ts
 * 永不退出，内部循环
 */

import { spawn, execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

// ─── Config ────────────────────────────────────────────────
const CARDS_DIR = '.';
const LAST_CACHE = '/tmp/hermes_ad_last.json';
const HEARTBEAT_LOG = '/tmp/hermes_ad_heartbeat.log';
const DB_PATH = '/Users/zys/.hermes/kanban/boards/trading-system/kanban.db';
const WORKSPACE = '/Users/zys/workspace/hermes-trading-system';
const BOARD = 'trading-system';

// Dedup thresholds
const MIN_INTERVAL_SEC = 600;     // 10 min same agent+symbol
const MIN_INTERVAL_SAME_TOPIC = 1800; // 30 min same notification type
const PRICE_CHANGE_THRESHOLD = 0.005; // 0.5%

interface LastNotification {
  agent: string;
  symbol: string;
  verdict: string;
  price: number;
  time: string;
  topic: string;
}

function readLastCache(): LastNotification | null {
  try {
    const d = readFileSync(LAST_CACHE, 'utf-8');
    return JSON.parse(d);
  } catch { return null; }
}

function writeLastCache(n: Partial<LastNotification>) {
  writeFileSync(LAST_CACHE, JSON.stringify({
    ...n,
    time: new Date().toISOString(),
  }));
}

function now(): string {
  return new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

function log(msg: string) {
  const line = `[${now()}] ${msg}`;
  console.log(line);
  try {
    const prev = readFileSync(HEARTBEAT_LOG, 'utf-8');
    const lines = prev.split('\n').slice(-99);
    lines.push(line);
    writeFileSync(HEARTBEAT_LOG, lines.join('\n'));
  } catch {
    writeFileSync(HEARTBEAT_LOG, line + '\n');
  }
}

// ─── Kanban helpers ────────────────────────────────────────
function getReadyTasks(): any[] {
  try {
    const out = execSync(
      `sqlite3 "${DB_PATH}" "SELECT id, title, body FROM tasks WHERE assignee='advertising-agent' AND status='ready' ORDER BY created_at ASC;"`,
      { encoding: 'utf-8', timeout: 10000 }
    );
    if (!out.trim()) return [];
    return out.trim().split('\n').map(line => {
      const [id, ...rest] = line.split('|');
      return { id, title: rest[0] || '', body: rest.slice(1).join('|') || '' };
    });
  } catch (e) {
    log(`getReadyTasks error: ${e}`);
    return [];
  }
}

function markDone(taskId: string) {
  try {
    execSync(
      `sqlite3 "${DB_PATH}" "UPDATE tasks SET status='done' WHERE id='${taskId}';"`,
      { timeout: 5000 }
    );
  } catch (e) {
    log(`markDone error for ${taskId}: ${e}`);
  }
}

// ─── Dedup check ──────────────────────────────────────────
function shouldSkip(task: any): { skip: boolean; reason?: string } {
  const last = readLastCache();
  if (!last) return { skip: false };

  const lastTime = new Date(last.time).getTime();
  const nowTime = Date.now();
  const elapsed = (nowTime - lastTime) / 1000;

  // Same agent + same stock + same verdict → skip
  if (last.agent && last.symbol && last.verdict) {
    const matches = task.title.includes(last.agent) && task.body?.includes(last.symbol);
    if (matches && elapsed < MIN_INTERVAL_SEC) {
      return { skip: true, reason: `same agent+symbol, < ${MIN_INTERVAL_SEC}s` };
    }
  }

  // Same topic within 30 min → skip (unless trading execution)
  if (last.topic && task.title.includes(last.topic) && elapsed < MIN_INTERVAL_SAME_TOPIC) {
    const isTradeExec = task.body?.includes('BUY') || task.body?.includes('SELL') || task.body?.includes('成交');
    if (!isTradeExec) {
      return { skip: true, reason: `same topic "${last.topic}", < ${MIN_INTERVAL_SAME_TOPIC}s` };
    }
  }

  return { skip: false };
}

// ─── Send card via send-card.ts ────────────────────────────
function sendCard(card: any): { message_id?: string; error?: string } {
  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', 'src/scripts/send-card.ts'], {
      cwd: WORKSPACE,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15000,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    child.on('close', (code: number | null) => {
      if (code !== 0) {
        resolve({ error: `send-card exited ${code}: ${stderr}` });
      } else {
        try {
          const parsed = JSON.parse(stdout);
          resolve(parsed);
        } catch {
          resolve({ error: `parse failed: ${stdout}` });
        }
      }
    });
    child.stdin.write(JSON.stringify(card));
    child.stdin.end();
  });
}

// ─── Process a single notification task ────────────────────
function buildCard(task: any): any {
  const body = task.body || '';
  const lowerBody = body.toLowerCase();

  // Determine color
  let color = 'blue';
  if (lowerBody.includes('buy') || lowerBody.includes('sell') || lowerBody.includes('成交') || lowerBody.includes('盈利') || lowerBody.includes('profit')) color = 'green';
  else if (lowerBody.includes('warning') || lowerBody.includes('警告') || lowerBody.includes('影子')) color = 'orange';
  else if (lowerBody.includes('fail') || lowerBody.includes('error') || lowerBody.includes('崩溃') || lowerBody.includes('熔断')) color = 'red';
  else if (lowerBody.includes('election') || lowerBody.includes('选举') || lowerBody.includes('投票')) color = 'purple';

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: task.title },
      template: color,
    },
    elements: [
      {
        tag: 'markdown',
        content: body.replace(/\n/g, '\n\n'),
      },
      {
        tag: 'hr',
      },
      {
        tag: 'note',
        elements: [
          { tag: 'plain_text', content: `ADV-001 · ${now()}` },
        ],
      },
    ],
  };
}

async function processNotification(task: any) {
  log(`→ Processing task ${task.id}: ${task.title}`);

  // Dedup check
  const dedup = shouldSkip(task);
  if (dedup.skip) {
    log(`  ↪ Dedup skipped: ${dedup.reason}`);
    markDone(task.id);
    log(`  ↪ Marked ${task.id} done (dedup)`);
    return;
  }

  // Build and send card
  const card = buildCard(task);
  log(`  Card built (color=${card.header.template})`);

  const result = await sendCard(card);

  if (result.error) {
    log(`  ✗ Send failed: ${result.error}`);
    // If send fails, block the task so someone can investigate
    log(`  ⚠ Keeping task ${task.id} ready for retry`);
    return;
  }

  log(`  ✓ Card sent: message_id=${result.message_id}`);

  // Update cache
  writeLastCache({
    agent: task.title.match(/AGT-\d+|ADV-\d+|CEO|SENT-\d+|DAT-\d+|STRAT-\d+/)?.[0] || '',
    symbol: task.body?.match(/[A-Z]{2,5}\.US/)?.[0] || '',
    verdict: task.body?.includes('BUY') ? 'BUY' : task.body?.includes('SELL') ? 'SELL' : task.body?.includes('HOLD') ? 'HOLD' : task.title,
    price: parseFloat(task.body?.match(/\$?([\d,]+\.\d{2})/)?.[1]?.replace(',', '') || '0'),
    topic: task.title.replace(/^.+?[:：]\s*/, '').substring(0, 30),
  });

  // Mark done
  markDone(task.id);
  log(`  ↪ Marked ${task.id} done`);
}

// ─── Heartbeat ─────────────────────────────────────────────
function heartbeat() {
  try {
    execSync(
      `hermes kanban heartbeat t_dde52d68 --note "ADV-001 running ✅ — $(date +'%H:%M')"`,
      { cwd: WORKSPACE, timeout: 10000 }
    );
  } catch (e) {
    // try sqlite3 directly as fallback
    try {
      execSync(
        `sqlite3 "${DB_PATH}" "INSERT INTO events(task_id, kind, payload, created_at) VALUES('t_dde52d68','heartbeat','{\\\"note\\\":\\\"ADV-001 running via direct SQL\\\"}',unixepoch());"`,
        { timeout: 5000 }
      );
    } catch (e2) {
      // ignore
    }
  }
  const runTime = Math.floor((Date.now() - startTime) / 1000);
  log(`Heartbeat sent (uptime: ${Math.floor(runTime/60)}m ${runTime%60}s)`);
}

// ─── Main loop ─────────────────────────────────────────────
const startTime = Date.now();
let cycleCount = 0;
const POLL_INTERVAL_MS = 5000; // Check every 5 seconds
const HEARTBEAT_INTERVAL_MS = 60000; // Heartbeat every 60 seconds
let lastHeartbeat = 0;

log('══════════════════════════════════════════');
log('  ADV-001 广告守护进程启动');
log('  永不退出 · 内部循环');
log('  Board: trading-system');
log('  Task: t_dde52d68');
log('══════════════════════════════════════════');

async function mainLoop() {
  while (true) {
    try {
      cycleCount++;

      // Heartbeat check
      const nowTime = Date.now();
      if (nowTime - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
        heartbeat();
        lastHeartbeat = nowTime;
      }

      // Poll for ready tasks
      const tasks = getReadyTasks();

      if (tasks.length === 0) {
        // No tasks — brief chill
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        continue;
      }

      log(`Found ${tasks.length} ready notification(s)`);

      for (const task of tasks) {
        await processNotification(task);
      }

      // After batch, brief pause unless more appeared (re-check quickly)
      await new Promise(r => setTimeout(r, 1000));
    } catch (e: any) {
      log(`Loop error: ${e?.message || e}`);
      log('Continuing loop after error...');
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

mainLoop().catch(e => {
  log(`Fatal: ${e?.message || e}`);
  process.exit(1);
});
