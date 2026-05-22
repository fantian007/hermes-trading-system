/**
 * 离职登记 — PURE DATA TOOL
 *
 * Agent 离职/剔除流程的数据层工具。
 * 流程（自然语言对话）：
 *   1. 触发离职（三种场景：绩效淘汰 / 组长剔除 / 自行离职）
 *   2. 通知组长和 HR 确认
 *   3. HR 运行此脚本执行离职操作
 *   4. 广告部门广播离职公告
 *
 * 脚本只做 DB 写入和文件清理，不做决策。
 */

import { getDb, closeDb } from '../core/db.js';
import { unlinkSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROFILES_DIR = resolve(__dirname, '../../profiles');

function printHelp(): void {
  console.log(`用法:
  npx tsx src/scripts/terminate-agent.ts --fire <JSON>
  npx tsx src/scripts/terminate-agent.ts --list-fired
  npx tsx src/scripts/terminate-agent.ts --help

--fire
  执行 Agent 离职/剔除操作。
  JSON 字段：
  {
    "agent_id": "AGT-005",
    "reason": "胜率持续低于40%，经HR审计决定淘汰",
    "triggered_by": "HR-001",
    "notify_leader": "AGT-001",       // 通知哪位组长
    "notify_hr": "HR-001"             // 通知哪位HR
  }

--list-fired
  查看已离职 Agent 列表。

--help
  显示本帮助

流程说明（由 Agent 自然语言对话完成，脚本只执行数据操作）：
  场景1: 绩效淘汰 — HR 审计发现某 Agent 胜率过低，执行淘汰
  场景2: 组长剔除 — 组长觉得组员不行，找 HR 确认后剔除
  场景3: 自行离职 — Agent 自己提出离职，HR 确认后执行

  无论哪种场景，HR 运行此脚本后将结果告知广告部门广播。`);

  // 顺便列出已离职的
  listFired();
}

function listFired(): void {
  const db = getDb();
  try {
    const rows = db.prepare(`
      SELECT agent_id, agent_name, profile_name, status, terminated_at,
             win_count, total_trades
      FROM agents
      WHERE status = 'TERMINATED'
      ORDER BY terminated_at DESC
    `).all() as Array<Record<string, unknown>>;

    if (rows.length === 0) {
      console.log('\n已离职 Agent：无');
      return;
    }

    console.log(`\n已离职 Agent (${rows.length} 人)：`);
    console.log('工号\t\t名称\t\t\tProfile\t\t离职时间\t\t胜场\t\t总交易');
    console.log('-'.repeat(90));
    for (const r of rows) {
      console.log([
        r.agent_id,
        (r.agent_name as string).padEnd(16),
        (r.profile_name as string).padEnd(16),
        (r.terminated_at as string ?? '-').padEnd(16),
        String(r.win_count).padEnd(8),
        String(r.total_trades),
      ].join('\t'));
    }
  } finally { closeDb(); }
}

interface FireParams {
  agent_id: string;
  reason: string;
  triggered_by: string;
  notify_leader: string;
  notify_hr: string;
}

async function fire(raw: string): Promise<void> {
  const p: FireParams = JSON.parse(raw);
  if (!p.agent_id || !p.reason || !p.triggered_by || !p.notify_leader || !p.notify_hr) {
    console.error('缺少必填字段：agent_id, reason, triggered_by, notify_leader, notify_hr');
    process.exit(1);
  }

  const db = getDb();

  // 1) 查 Agent 当前状态
  const agent = db.prepare('SELECT agent_id, agent_name, profile_name, status FROM agents WHERE agent_id = ?')
    .get(p.agent_id) as { agent_id: string; agent_name: string; profile_name: string; status: string } | undefined;

  if (!agent) {
    console.error(`Agent ${p.agent_id} 不存在`);
    process.exit(1);
  }

  if (agent.status === 'TERMINATED') {
    console.error(`Agent ${p.agent_id} 已处于 TERMINATED 状态`);
    process.exit(1);
  }

  // 2) 更新 agents 表状态
  db.prepare(`
    UPDATE agents SET status = 'TERMINATED', terminated_at = datetime('now')
    WHERE agent_id = ?
  `).run(p.agent_id);

  // 3) 记录人事变动流水
  db.prepare(`
    INSERT INTO agent_status_log (agent_id, from_status, to_status, reason, triggered_by)
    VALUES (?, ?, 'TERMINATED', ?, ?)
  `).run(p.agent_id, agent.status, p.reason, p.triggered_by);

  // 4) 删除 profile YAML 文件（如果存在）
  const profileFilename = `${p.agent_id.toLowerCase()}.yaml`;
  const profilePath = resolve(PROFILES_DIR, profileFilename);
  let profileDeleted = false;
  if (existsSync(profilePath)) {
    unlinkSync(profilePath);
    profileDeleted = true;
  } else {
    // 也试试用 profile_name 找
    const altPath = resolve(PROFILES_DIR, `${agent.profile_name}.yaml`);
    if (existsSync(altPath)) {
      unlinkSync(altPath);
      profileDeleted = true;
    }
  }

  closeDb();

  // 5) 输出结果
  console.log(`\n✅ 离职操作完成`);
  console.log(`   工号:       ${p.agent_id}`);
  console.log(`   名称:       ${agent.agent_name}`);
  console.log(`   原状态:     ${agent.status} → TERMINATED`);
  console.log(`   原因:       ${p.reason}`);
  console.log(`   执行人:     ${p.triggered_by}`);
  console.log(`   通知组长:   ${p.notify_leader}`);
  console.log(`   通知 HR:    ${p.notify_hr}`);
  if (profileDeleted) console.log(`   Profile:    已删除`);
  else console.log(`   Profile:    未找到文件（可能已手动删除）`);
  console.log(`\n📢 请通知广告部门（advertising-agent）广播离职公告`);
  console.log(`   示例：\"广播一下：${agent.agent_name}（${p.agent_id}）已离职，原因：${p.reason}\"`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help')) {
    printHelp();
    return;
  }
  if (args.includes('--list-fired')) {
    listFired();
    return;
  }

  const fireIdx = args.indexOf('--fire');
  if (fireIdx !== -1 && args[fireIdx + 1]) {
    await fire(args[fireIdx + 1]);
    return;
  }

  console.error('未知参数，使用 --help 查看用法');
  process.exit(1);
}

main().catch((err) => {
  console.error('terminate-agent.ts 出错:', err);
  process.exit(1);
});
