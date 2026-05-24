/**
 * 入职登记 — PURE DATA TOOL
 *
 * HR Agent 通过此脚本完成新 Agent 入职。
 * 流程：
 *   1. HR 对话确认新 Agent 信息
 *   2. 运行 --assign-id 分配工号、写入 DB、生成 profile YAML 模板
 *   3. 组长直接编辑 profile YAML 的 system_prompt 填入职责
 *
 * 所有决策由 Agent 自然语言完成——脚本只做 DB 写入和文件生成。
 */

import { getDb, closeDb } from '../core/db.js';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROFILES_DIR = resolve(__dirname, '../../profiles');

// ── Help ──────────────────────────────────────────────────────────
function printHelp(): void {
  console.log(`用法:
  npx tsx src/scripts/onboard-agent.ts --assign-id <JSON>
  npx tsx src/scripts/onboard-agent.ts --list
  npx tsx src/scripts/onboard-agent.ts --help

--assign-id
  分配工号 + 写入 DB + 生成 profile YAML 模板。
  JSON 字段：
  {
    "agent_name": "均值回归-布林带增强",
    "profile_name": "strategy-01",
    "profile_model": "deepseek/deepseek-chat",   // 可选，默认 deepseek/deepseek-chat
    "dept_name": "选股部门",
    "role_title": "布林带增强策略官",              // 岗位名称
    "responsibilities": "独立扫描市场，将布林带增强信号写入候选股池",  // 具体职责
    "strategy_source": "《股市趋势技术分析》",
    "strategy_summary": "融合布林带和均值回归的信号增强策略",
    "indicators": ["bollinger", "mean-reversion"],
    "assigned_by": "HR-001"
  }

--list
  列出当前所有在职 Agent（含工号、部门、组长、状态、胜率）。

--help
  显示本帮助`);

  const db = getDb();
  try {
    const rows = db.prepare(`
      SELECT agent_id, agent_name, profile_name, status,
             win_count, total_trades, joined_at
      FROM agents
      ORDER BY agent_id
    `).all() as Array<Record<string, unknown>>;

    if (rows.length === 0) { console.log('当前在职 Agent：无'); return; }

    console.log(`\n当前在职 Agent (${rows.length} 人)：`);
    console.log('工号\t\t名称\t\t\tProfile\t\t状态\t\t胜率\t\t交易数');
    console.log('-'.repeat(80));
    for (const r of rows) {
      const wr = (r.win_count as number) > 0 && (r.total_trades as number) > 0
        ? ((r.win_count as number) / (r.total_trades as number) * 100).toFixed(1) + '%'
        : '-';
      console.log([
        r.agent_id,
        (r.agent_name as string).padEnd(16),
        (r.profile_name as string).padEnd(16),
        (r.status as string).padEnd(8),
        wr.padEnd(8),
        String(r.total_trades),
      ].join('\t'));
    }

    // 部门信息独立展示
    console.log('\n--- 组织架构 ---');
    const depts = db.prepare('SELECT dept_name, dept_id, leader_agent_id FROM departments ORDER BY dept_name').all() as Array<{ dept_name: string; dept_id: string; leader_agent_id: string }>;
    for (const d of depts) {
      console.log(`  ${d.dept_name.padEnd(12)} (${d.dept_id})  组长: ${d.leader_agent_id}`);
    }

  } finally { closeDb(); }
}

// ── 工号前缀映射 ──────────────────────────────────────────────────
const PREFIX_MAP: Record<string, string> = {
  '数据部门': 'DAT', '数据': 'DAT',
  '选股部门': 'AGT', '选股': 'AGT',
  '盯盘部门': 'WAT', '盯盘': 'WAT',
  '选举委员会': 'ELC', '选委会': 'ELC',
  '审核部门': 'RAG', '审核': 'RAG',
  '执行部门': 'EXE', '执行': 'EXE',
  'HR部门': 'HR', '人力资源': 'HR',
  '广告部门': 'ADV', '广告': 'ADV',
  '策略部门': 'AGT', '策略': 'AGT',
};

function getPrefix(deptName: string): string {
  for (const [k, v] of Object.entries(PREFIX_MAP)) {
    if (deptName.includes(k)) return v;
  }
  return 'GEN';
}

function generateAgentId(prefix: string): string {
  const db = getDb();
  const last = db.prepare('SELECT agent_id FROM agents WHERE agent_id LIKE ? ORDER BY agent_id DESC LIMIT 1')
    .get(`${prefix}-%`) as { agent_id: string } | undefined;
  if (!last) return `${prefix}-001`;
  const n = parseInt(last.agent_id.split('-')[1], 10) + 1;
  return `${prefix}-${String(n).padStart(3, '0')}`;
}

// ── Profile YAML 模板生成 ────────────────────────────────────────
interface AssignIdParams {
  agent_name: string;
  profile_name: string;
  profile_model?: string;
  dept_name: string;
  role_title: string;
  responsibilities: string;
  strategy_source?: string;
  strategy_summary?: string;
  indicators?: string[];
  assigned_by: string;
}

function generateProfileYaml(p: AssignIdParams, agentId: string, deptLeader: string): string {
  const model = p.profile_model ?? 'deepseek/deepseek-chat';
  const indicators = p.indicators ? p.indicators.join(', ') : '';
  const strategyDesc = p.strategy_source
    ? `\n  策略来源：${p.strategy_source}\n  核心概念：${p.strategy_summary ?? ''}`
    : '';

  return `# Hermes Agent Profile — ${p.agent_name}
# 工号: ${agentId}  |  部门: ${p.dept_name}  |  组长: ${deptLeader}
name: ${p.profile_name}
model:
  provider: deepseek
  model: ${model}
system_prompt: |
  你是 ${p.dept_name} 的 ${p.role_title}（${agentId}）。

  你的岗位职责：
  ${p.responsibilities}${strategyDesc}

  ${indicators ? `你使用的指标：${indicators}` : ''}

  你的部门组长是 ${deptLeader}，部门内的工作分配通过组长进行。
toolsets:
  - terminal
  - file
`;
}

function writeProfileYaml(agentId: string, content: string): string {
  if (!existsSync(PROFILES_DIR)) mkdirSync(PROFILES_DIR, { recursive: true });

  // 查找已有的 profile 文件（dept_name 匹配）
  const existingFiles = []; // We'll use the profile_name from params directly
  const filePath = resolve(PROFILES_DIR, `${agentId.toLowerCase()}.yaml`);

  writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

// ── Assign ID ─────────────────────────────────────────────────────
async function assignId(raw: string): Promise<void> {
  const p: AssignIdParams = JSON.parse(raw);
  if (!p.agent_name || !p.profile_name || !p.dept_name || !p.role_title || !p.responsibilities || !p.assigned_by) {
    console.error('缺少必填字段：agent_name, profile_name, dept_name, role_title, responsibilities, assigned_by');
    process.exit(1);
  }

  const db = getDb();

  // 1) 查找部门
  const dept = db.prepare('SELECT * FROM departments WHERE dept_name = ?').get(p.dept_name) as {
    dept_id: string; dept_name: string; leader_agent_id: string;
  } | undefined;
  if (!dept) {
    console.error(`部门 "${p.dept_name}" 不存在。`);
    console.error('可用部门：');
    const allDepts = db.prepare('SELECT dept_name, leader_agent_id FROM departments ORDER BY dept_name').all() as Array<{ dept_name: string; leader_agent_id: string }>;
    for (const d of allDepts) console.error(`  ${d.dept_name} (组长: ${d.leader_agent_id})`);
    closeDb();
    process.exit(1);
  }

  // 2) 生成工号
  const agentId = generateAgentId(getPrefix(p.dept_name));

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
  `).run(agentId, `新入职 ${p.dept_name} - ${p.agent_name} - ${p.role_title}`, p.assigned_by);

  // 5) 生成 profile YAML
  const yamlContent = generateProfileYaml(p, agentId, dept.leader_agent_id);
  const profilePath = writeProfileYaml(agentId, yamlContent);

  closeDb();

  console.log(`\n✅ 入职登记完成`);
  console.log(`   工号:           ${agentId}`);
  console.log(`   名称:           ${p.agent_name}`);
  console.log(`   部门:           ${p.dept_name}`);
  console.log(`   组长:           ${dept.leader_agent_id}`);
  console.log(`   岗位:           ${p.role_title}`);
  console.log(`   职责:           ${p.responsibilities}`);
  console.log(`   Profile:        ${p.profile_name}`);
  console.log(`   Profile 文件:   ${profilePath}`);
  console.log(`   登记人:         ${p.assigned_by}`);
  console.log(`\n📝 下一步：组长 ${dept.leader_agent_id} 请编辑 profile 文件完善 system_prompt`);
  console.log(`   可运行：hermes profile create -f ${profilePath}`);
}

// ── List ──────────────────────────────────────────────────────────
async function listAll(): Promise<void> {
  const db = getDb();
  try {
    const rows = db.prepare(`
      SELECT agent_id, agent_name, profile_name, status,
             win_count, total_trades, joined_at
      FROM agents
      ORDER BY agent_id
    `).all() as Array<Record<string, unknown>>;

    if (rows.length === 0) { console.log('当前在职 Agent：无'); return; }

    console.log(`\n当前在职 Agent (${rows.length} 人)：`);
    console.log('工号\t\t名称\t\t\tProfile\t\t状态\t\t胜率\t\t交易数');
    console.log('-'.repeat(80));
    for (const r of rows) {
      const wr = (r.win_count as number) > 0 && (r.total_trades as number) > 0
        ? ((r.win_count as number) / (r.total_trades as number) * 100).toFixed(1) + '%'
        : '-';
      console.log([
        r.agent_id,
        (r.agent_name as string).padEnd(16),
        (r.profile_name as string).padEnd(16),
        (r.status as string).padEnd(8),
        wr.padEnd(8),
        String(r.total_trades),
      ].join('\t'));
    }

    // 部门信息独立展示
    console.log('\n--- 组织架构 ---');
    const depts = db.prepare('SELECT dept_name, dept_id, leader_agent_id FROM departments ORDER BY dept_name').all() as Array<{ dept_name: string; dept_id: string; leader_agent_id: string }>;
    for (const d of depts) {
      console.log(`  ${d.dept_name.padEnd(12)} (${d.dept_id})  组长: ${d.leader_agent_id}`);
    }
  } finally { closeDb(); }
}

// ── Main ──────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help')) { printHelp(); return; }
  if (args.includes('--list')) { await listAll(); return; }

  const idIdx = args.indexOf('--assign-id');
  if (idIdx !== -1 && args[idIdx + 1]) { await assignId(args[idIdx + 1]); return; }

  console.error('未知参数，使用 --help 查看用法');
  process.exit(1);
}

main().catch((err) => {
  console.error('onboard-agent.ts 出错:', err);
  process.exit(1);
});
