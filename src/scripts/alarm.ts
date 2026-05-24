#!/usr/bin/env node
/**
 * Agent 工作日志 — 记录/查询/清理
 *
 * 用法:
 *   npx tsx src/scripts/alarm.ts log --agent strategy-director --task "MACD分析完成"
 *   npx tsx src/scripts/alarm.ts list                    # 查看所有
 *   npx tsx src/scripts/alarm.ts last --agent strategy-director  # 上次工作时间
 *   npx tsx src/scripts/alarm.ts clean                   # 清理已完成
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const LOG = '/tmp/hermes_worklog.json';

interface Entry {
  agent: string;
  task: string;
  time: string;
}

function load(): Entry[] {
  if (!existsSync(LOG)) return [];
  return JSON.parse(readFileSync(LOG, 'utf-8'));
}
function save(entries: Entry[]) {
  writeFileSync(LOG, JSON.stringify(entries, null, 2));
}

const args = process.argv.slice(2);
const cmd = args[0];
const get = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i+1] : ''; };

if (cmd === 'log') {
  const agent = get('agent');
  const task = get('task') || '完成一轮工作';
  if (!agent) { console.error('Usage: alarm.ts log --agent <name>'); process.exit(1); }
  
  const entries = load();
  entries.push({ agent, task, time: new Date().toISOString() });
  // Keep last 100 entries
  if (entries.length > 100) entries.splice(0, entries.length - 100);
  save(entries);
  console.log(JSON.stringify({ status: 'ok', agent, task }));

} else if (cmd === 'list') {
  console.log(JSON.stringify(load()));

} else if (cmd === 'last') {
  const agent = get('agent');
  const entries = load().filter(e => e.agent === agent);
  const last = entries[entries.length - 1];
  console.log(JSON.stringify(last || { agent, task: null, time: null }));

} else if (cmd === 'since') {
  // How long since agent last worked (in minutes)
  const agent = get('agent');
  const entries = load().filter(e => e.agent === agent);
  const last = entries[entries.length - 1];
  if (!last) { console.log(JSON.stringify({ minutes: Infinity })); }
  else {
    const min = Math.round((Date.now() - new Date(last.time).getTime()) / 60000);
    console.log(JSON.stringify({ agent, minutes: min, last_task: last.task }));
  }

} else if (cmd === 'clean') {
  const entries = load();
  // Remove entries older than 24h
  const cutoff = Date.now() - 86400000;
  const kept = entries.filter(e => new Date(e.time).getTime() > cutoff);
  save(kept);
  console.log(JSON.stringify({ cleaned: entries.length - kept.length, kept: kept.length }));

} else {
  console.log(JSON.stringify(load()));
}
