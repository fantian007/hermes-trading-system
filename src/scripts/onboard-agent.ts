/**
 * 入职登记 — PURE DATA TOOL
 *
 * HR Agent 通过调用此脚本完成新 Agent 的入职全流程。
 * 流程分两步（由 HR Agent 在自然语言对话中逐步执行）：
 *
 * 步骤一：HR Agent 向新 Agent 分配工号
 *   使用 --assign-id 创建 agents 记录
 *   输出：新工号、部门和初始状态
 *
 * 步骤二：组长向新组员分配职责
 *   使用 --assign-duty 填写 agent_duties
 *
 * 所有决策由 Agent 自然语言完成——脚本只做 DB 写入。
 */

import { createInterface } from 'node:readline';
import { getDb, closeDb } from '../core/db.js';
import type { AgentStatus } from '../core/types.js';

// ── Help ──────────────────────────────────────────────────────────
function printHelp(): void {
  console.log(`用法:
  npx tsx src/scripts/onboard-agent.ts --assign-id <参数>
  npx tsx src/scripts/onboard-agent.ts --assign-duty <参数>
  npx tsx src/scripts/onboard-agent.ts --list
  npx tsx src/scripts/onboard-agent.ts --help

--assign-id
  注册新 Agent 到 agents 表。
  参数格式 JSON:
  {
    "agent_name": "均线交叉-海龟增强",
    "profile_name": "strategy-06",
    "dept_name": "选股部门",
    "strategy_source": "《海龟交易法则》+《股市趋势技术分析》",
    "strategy_summary": "融合均线交叉和海龟通道的信号增强策略",
    "indicators": ["ma", "donchian"],
    "assigned_by": "HR-001"
  }

--assign-duty
  组长给组员分配具体职责（写入 agent_duties）。
  参数格式 JSON:
  {
    "agent_id": "AGT-006",
    "dept_name": "选股部门",
    "role_title": "均线交叉-海龟增强策略官",
    "responsibilities": "独立扫描市场，将异动信号写入候选股池",
    "assigned_by": "AGT-001"
  }

--list
  列出当前所有在职 Agent，含工号、部门、岗位、组长。

--help
  显示本帮助`);

  const db = getDb();

  try {
    // 查询所有在职 Agent，关联部门信息
    const rows = db.prepare(`
      SELECT
        a.agent_id,
        a.agent_name,
        a.status,
        a.win_count,
        a.total_trades,
        a.joined_at,
        COALESCE(d.dept_name, '未分配') AS dept_name,
        COALESCE(d.leader_agent_id, '-') AS leader_agent_id,
        COALESCE(ad.role_title, '-') AS role_title
      FROM agents a
      LEFT JOIN agent_duties ad ON a.agent_id = ad.agent_id
      LEFT JOIN departments d ON ad.dept_id = d.dept_id
      ORDER BY a.agent_id
    `).all() as Array<Record<string, unknown>>;

    if (rows.length === 0) {
      console.log('当前在职 Agent：无');
      return;
    }

    console.log(`\n当前在职 Agent (${rows.length} 人)：`);
    console.log('工号\t\t名称\t\t\t部门\t\t组长\t\t岗位\t\t状态\t\t胜率\t\t交易数');
    console.log('-'.repeat(120));
    for (const r of rows) {
      const wr = (r.win_count as number) > 0 && (r.total_trades as number) > 0
        ? ((r.win_count as number) / (r.total_trades as number) * 100).toFixed(1) + '%'
        : '-';
      console.log([
        r.agent_id,
        (r.agent_name as string).padEnd(16),
        (r.dept_name as string).padEnd(12),
        (r.leader_agent_id as string).padEnd(10),
        (r.role_title as string).padEnd(20),
        (r.status as string).padEnd(8),
        wr.padEnd(8),
        String(r.total_trades),
      ].join('\t'));
    }

    // 部门统计
    console.log('\n--- 部门统计 ---');
    const deptRows = db.prepare(`
      SELECT d.dept_name, d.leader_agent_id, COUNT(ad.agent_id) AS member_count
      FROM departments d
      LEFT JOIN agent_duties ad ON d.dept_id = ad.dept_id
      GROUP BY d.dept_id
      ORDER BY d.dept_name
    `).all() as Array<{ dept_name: string; leader_agent_id: string; member_count: number }>;
    for (const d of deptRows) {
      console.log(`  ${d.dept_name.padEnd(12)} 组长: ${(d.leader_agent_id ?? '-').padEnd(10)} 组员: ${d.member_count}人`);
    }
  } finally {
    closeDb();
  }
}

// ── 工号生成 ─────────────────────────────────────────────────────
const AGENT_PREFIXES: Record<string, string> = {
  '数据部门': 'DAT', '数据': 'DAT',
  '选股部门': 'AGT', '选股': 'AGT',
  '盯盘部门': 'WAT', '盯盘': 'WAT',
  '选举委员会': 'ELC', '选委会': 'ELC',
  '审核部门': 'RAG', '审核': 'RAG',
  '执行部门': 'EXE', '执行': 'EXE',
  'HR部门': 'HR', '人力资源': 'HR',
  '广告部门': 'ADV', '广告': 'ADV',
};

function getPrefix(deptName: string): string {
  for (const [key, val] of Object.entries(AGENT_PREFIXES)) {
    if (deptName.includes(key)) return val;
  }
  return 'GEN'; // 通用
}

function generateAgentId(prefix: string): string {
  const db = getDb();
  const existing = db.prepare(`
    SELECT agent_id FROM agents WHERE agent_id LIKE ?
    ORDER BY agent_id DESC LIMIT 1
  `).get(`${prefix}-%`) as { agent_id: string } | undefined;

  if (!existing) return `${prefix}-001`;

  const parts = existing.agent_id.split('-');
  const num = parseInt(parts[1], 10) + 1;
  return `${prefix}-${String(num).padStart(3, '0')}`;
}

// ── 分配工号（步骤一） ──────────────────────────────────────────
interface AssignIdParams {
  agent_name: string;
  profile_name: string;
  dept_name: string;
  strategy_source?: string;
  strategy_summary?: string;
  indicators?: string[];
  assigned_by: string;
}

async function assignId(raw: string): Promise<void> {
  const p: AssignIdParams = JSON.parse(raw);
  if (!p.agent_name || !p.profile_name || !p.dept_name || !p.assigned_by) {
    console.error('缺少必填字段：agent_name, profile_name, dept_name, assigned_by');
    process.exit(1);
  }

  const db = getDb();

  // 1) 确保部门存在，没有则自动创建（需要先找到或注册组长）
  let dept = db.prepare('SELECT * FROM departments WHERE dept_name = ?').get(p.dept_name) as {
    dept_id: string; dept_name: string; leader_agent_id: string;
  } | undefined;

  if (!dept) {
    console.error(`部门 "${p.dept_name}" 不存在。请先让 HR Agent 创建部门。`);
    console.error(`提示：HR Agent 可以使用以下 SQL 创建部门（通过 data-agent 执行）：`);
    console.error(`  INSERT INTO departments (dept_id, dept_name, dept_desc, leader_agent_id, created_by)`);
    console.error(`  VALUES ('DPT-XXX', '${p.dept_name}', '部门职责描述', '组长工号', 'HR-001');`);
    closeDb();
    process.exit(1);
  }

  // 2) 生成工号
  const prefix = getPrefix(p.dept_name);
  const agentId = generateAgentId(prefix);

  // 3) 写入 agents 表
  const indicators = p.indicators ? JSON.stringify(p.indicators) : '';
  db.prepare(`
    INSERT INTO agents (agent_id, agent_name, profile_name, strategy_source, strategy_summary, indicators, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
  `).run(agentId, p.agent_name, p.profile_name, p.strategy_source ?? '', p.strategy_summary ?? '', indicators, p.assigned_by);

  // 4) 记录人事变动流水
  db.prepare(`
    INSERT INTO agent_status_log (agent_id, from_status, to_status, reason, triggered_by)
    VALUES (?, 'NEW', 'ACTIVE', ?, ?)
  `).run(agentId, `新入职 ${p.dept_name} - ${p.agent_name}`, p.assigned_by);

  // 5) 自动创建空白的 agent_duties 占位记录（等待组长填写）
  db.prepare(`
    INSERT OR IGNORE INTO agent_duties (agent_id, dept_id, role_title, responsibilities, assigned_by)
    VALUES (?, ?, '待组长分配', '待组长分配', ?)
  `).run(agentId, dept.dept_id, dept.leader_agent_id);

  console.log(`\n✅ 入职登记完成`);
  console.log(`   工号:       ${agentId}`);
  console.log(`   名称:       ${p.agent_name}`);
  console.log(`   部门:       ${p.dept_name}`);
  console.log(`   部门组长:   ${dept.leader_agent_id}`);
  console.log(`   Profile:    ${p.profile_name}`);
  console.log(`   状态:       ACTIVE`);
  console.log(`   登记人:     ${p.assigned_by}`);
  console.log(`\n⏳ 下一步：组长 ${dept.leader_agent_id} 请使用 --assign-duty 分配具体职责`);

  closeDb();
}

// ── 分配职责（步骤二） ──────────────────────────────────────────
interface AssignDutyParams {
  agent_id: string;
  dept_name: string;
  role_title: string;
  responsibilities: string;
  assigned_by: string;
}

async function assignDuty(raw: string): Promise<void> {
  const p: AssignDutyParams = JSON.parse(raw);
  if (!p.agent_id || !p.dept_name || !p.role_title || !p.responsibilities || !p.assigned_by) {
    console.error('缺少必填字段：agent_id, dept_name, role_title, responsibilities, assigned_by');
    process.exit(1);
  }

  const db = getDb();

  // 验证部门存在
  const dept = db.prepare('SELECT * FROM departments WHERE dept_name = ?').get(p.dept_name) as {
    dept_id: string; leader_agent_id: string;
  } | undefined;

  if (!dept) {
    console.error(`部门 "${p.dept_name}" 不存在`);
    closeDb();
    process.exit(1);
  }

  // 验证组长身份
  if (dept.leader_agent_id !== p.assigned_by) {
    console.error(`权限错误：只有组长 ${dept.leader_agent_id} 才能给 ${p.dept_name} 的组员分配职责，但你填的是 ${p.assigned_by}`);
    closeDb();
    process.exit(1);
  }

  // 验证组员存在
  const agent = db.prepare('SELECT agent_id, status FROM agents WHERE agent_id = ?').get(p.agent_id) as {
    agent_id: string; status: string;
  } | undefined;
  if (!agent) {
    console.error(`Agent ${p.agent_id} 不存在，请先用 --assign-id 注册`);
    closeDb();
    process.exit(1);
  }

  // 写入/更新 agent_duties
  const existing = db.prepare('SELECT id FROM agent_duties WHERE agent_id = ? AND dept_id = ?').get(p.agent_id, dept.dept_id) as { id: number } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE agent_duties SET role_title = ?, responsibilities = ?, assigned_by = ?, updated_at = datetime('now')
      WHERE agent_id = ? AND dept_id = ?
    `).run(p.role_title, p.responsibilities, p.assigned_by, p.agent_id, dept.dept_id);
  } else {
    db.prepare(`
      INSERT INTO agent_duties (agent_id, dept_id, role_title, responsibilities, assigned_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(p.agent_id, dept.dept_id, p.role_title, p.responsibilities, p.assigned_by);
  }

  console.log(`\n✅ 职责分配完成`);
  console.log(`   组员:       ${p.agent_id}`);
  console.log(`   部门:       ${p.dept_name}`);
  console.log(`   岗位:       ${p.role_title}`);
  console.log(`   职责:       ${p.responsibilities}`);
  console.log(`   分配人:     ${p.assigned_by} (组长)`);

  // 通知 HR 部门更新完成
  console.log(`\n💡 通知 HR-001：${p.agent_id} 已分配到 ${p.dept_name}，岗位：${p.role_title}`);

  closeDb();
}

// ── 列出所有在职 Agent ──────────────────────────────────────────
async function listAll(): Promise<void> {
  const db = getDb();

  try {
    const rows = db.prepare(`
      SELECT
        a.agent_id,
        a.agent_name,
        a.status,
        a.win_count,
        a.total_trades,
        a.joined_at,
        COALESCE(d.dept_name, '未分配') AS dept_name,
        COALESCE(d.leader_agent_id, '-') AS leader_agent_id,
        COALESCE(ad.role_title, '-') AS role_title
      FROM agents a
      LEFT JOIN agent_duties ad ON a.agent_id = ad.agent_id
      LEFT JOIN departments d ON ad.dept_id = d.dept_id
      ORDER BY a.agent_id
    `).all() as Array<Record<string, unknown>>;

    if (rows.length === 0) {
      console.log('当前在职 Agent：无');
      return;
    }

    console.log(`\n当前在职 Agent (${rows.length} 人)：`);
    console.log('工号\t\t名称\t\t\t部门\t\t组长\t\t岗位\t\t状态\t\t胜率\t\t交易数');
    console.log('-'.repeat(120));
    for (const r of rows) {
      const wr = (r.win_count as number) > 0 && (r.total_trades as number) > 0
        ? ((r.win_count as number) / (r.total_trades as number) * 100).toFixed(1) + '%'
        : '-';
      console.log([
        r.agent_id,
        (r.agent_name as string).padEnd(16),
        (r.dept_name as string).padEnd(12),
        (r.leader_agent_id as string).padEnd(10),
        (r.role_title as string).padEnd(20),
        (r.status as string).padEnd(8),
        wr.padEnd(8),
        String(r.total_trades),
      ].join('\t'));
    }

    // 部门统计
    console.log('\n--- 部门统计 ---');
    const deptRows = db.prepare(`
      SELECT d.dept_name, d.leader_agent_id, COUNT(ad.agent_id) AS member_count
      FROM departments d
      LEFT JOIN agent_duties ad ON d.dept_id = ad.dept_id
      GROUP BY d.dept_id
      ORDER BY d.dept_name
    `).all() as Array<{ dept_name: string; leader_agent_id: string; member_count: number }>;
    for (const d of deptRows) {
      console.log(`  ${d.dept_name.padEnd(12)} 组长: ${(d.leader_agent_id ?? '-').padEnd(10)} 组员: ${d.member_count}人`);
    }
  } finally {
    closeDb();
  }
}

// ── Main ──────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    printHelp();
    return;
  }

  if (args.includes('--list')) {
    await listAll();
    return;
  }

  const idIdx = args.indexOf('--assign-id');
  if (idIdx !== -1 && args[idIdx + 1]) {
    await assignId(args[idIdx + 1]);
    return;
  }

  const dutyIdx = args.indexOf('--assign-duty');
  if (dutyIdx !== -1 && args[dutyIdx + 1]) {
    await assignDuty(args[dutyIdx + 1]);
    return;
  }

  console.error('未知参数，使用 --help 查看用法');
  process.exit(1);
}

main().catch((err) => {
  console.error('onboard-agent.ts 出错:', err);
  process.exit(1);
});
