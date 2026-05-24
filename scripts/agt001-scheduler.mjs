#!/usr/bin/env node
/**
 * AGT-001 调度守护
 * 
 * 持续循环: 每3分钟检查看板状态
 * - 看所有Agent状态
 * - 对空闲Agent派发任务
 * - 检查投票/执行/审核流水线
 * - 报告给广告部门
 * 
 * 不退出，不调kanban_complete，永远running。
 */

import { execSync } from 'child_process';
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORK_DIR = '/Users/zys/workspace/hermes-trading-system';
const LOG_DIR = join(WORK_DIR, 'logs');
const LOG_FILE = join(LOG_DIR, 'scheduler.log');

if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });

function log(msg) {
  const ts = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try { appendFileSync(LOG_FILE, line + '\n'); } catch(e) {}
}

function runCmd(cmd, opts = {}) {
  try {
    const out = execSync(cmd, { 
      cwd: WORK_DIR, 
      timeout: opts.timeout || 30000, 
      encoding: 'utf-8',
      ...opts
    });
    return { ok: true, output: out.trim() };
  } catch (e) {
    return { ok: false, error: e.message, output: e.stdout?.trim() || '' };
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseKanbanList(output) {
  // Try JSON format first
  try {
    return JSON.parse(output);
  } catch {
    return null;
  }
}

async function scheduleCycle(round) {
  log(`=== 第${round}轮调度循环 ===`);
  
  // Step 1: Get kanban list
  const listResult = runCmd('hermes kanban list --json 2>/dev/null');
  if (!listResult.ok) {
    log(`ERROR: kanban list failed: ${listResult.error}`);
    return;
  }
  
  const tasks = parseKanbanList(listResult.output);
  if (!tasks || !Array.isArray(tasks)) {
    log(`ERROR: Failed to parse kanban list output`);
    return;
  }
  
  // Step 2: Check all agent status
  const agentStatus = {};
  const strategyAgents = ['strategy-director'];
  const otherAgents = ['sentiment-agent', 'election-committee', 'execution-agent', 'data-agent', 
                       'review-auditor', 'backtest-agent', 'hr-agent', 'advertising-agent', 'ceo-agent'];
  
  for (const agent of [...strategyAgents, ...otherAgents]) {
    const agentTasks = tasks.filter(t => t.assignee === agent);
    const runningTasks = agentTasks.filter(t => t.status === 'running');
    const doneTasks = agentTasks.filter(t => t.status === 'done');
    const todoTasks = agentTasks.filter(t => t.status === 'todo');
    const idle = runningTasks.length === 0 && todoTasks.length === 0;
    
    agentStatus[agent] = {
      running: runningTasks.length,
      done: doneTasks.length,
      todo: todoTasks.length,
      idle,
      runningIds: runningTasks.map(t => t.id)
    };
  }
  
  // Step 3: Report status
  const idleAgents = Object.entries(agentStatus).filter(([_, s]) => s.idle).map(([name]) => name);
  const runningCount = Object.entries(agentStatus).filter(([_, s]) => s.running > 0).length;
  
  if (idleAgents.length > 0) {
    log(`IDLE agents need dispatch: ${idleAgents.join(', ')}`);
    // TODO: dispatch tasks to idle agents
  } else {
    log(`All agents running: ${runningCount}/${strategyAgents.length + otherAgents.length}`);
  }
  
  // Step 4: Check pipeline for strategy done -> election -> execution -> review
  const strategyDoneTasks = tasks.filter(t => 
    strategyAgents.includes(t.assignee) && t.status === 'done'
  );
  
  // Check if any strategy output needs election
  for (const task of strategyDoneTasks) {
    const body = task.body || '';
    if (body.includes('BUY') || body.includes('SELL')) {
      log(`PENDING ELECTION: ${task.title} (${task.id}) - contains BUY/SELL signal`);
    }
  }
  
  // Check if any ELC done task needs execution
  const elcDoneTasks = tasks.filter(t => 
    t.assignee === 'election-committee' && t.status === 'done'
  );
  for (const task of elcDoneTasks) {
    if (task.body && !task.body.includes('HOLD')) {
      log(`PENDING EXECUTION: ${task.title} (${task.id}) - election passed`);
    }
  }
  
  // Step 5: Log current state
  log(`Round ${round} summary: ${runningCount} agents active, ${idleAgents.length} idle`);
  log(`--- 第${round}轮调度循环结束 ---`);
}

async function main() {
  log('AGT-001 调度守护启动');
  log(`工作目录: ${WORK_DIR}`);
  log(`日志文件: ${LOG_FILE}`);
  log('');
  
  let round = 1;
  while (true) {
    try {
      await scheduleCycle(round);
    } catch (e) {
      log(`FATAL error in round ${round}: ${e.message}`);
    }
    round++;
    log(`等待3分钟...`);
    await sleep(180000); // 3 minutes
  }
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
