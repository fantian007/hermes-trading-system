/**
 * Agent 人格持久化工具 — Agent Persona Manager
 *
 * 让每个 Agent 能：
 *   1. 读取自己的完整人格档案（persona profile）
 *   2. 更新自己的 traits（自我学习进化）
 *   3. 导出所有人格数据用于迁移
 *   4. 从导出数据导入恢复
 *
 * 用法（Agent 通过终端调用）：
 *   npx tsx src/scripts/persona.ts --agent-id RAG-0001 --action show
 *   npx tsx src/scripts/persona.ts --agent-id RAG-0001 --action update --trait-key preferred_sectors --trait-value '["AI","Semiconductor"]' --trait-type CATEGORY --confidence 0.8
 *   npx tsx src/scripts/persona.ts --agent-id all --action export --output ./export/agents.json
 *   npx tsx src/scripts/persona.ts --agent-id all --action import --input ./export/agents.json
 */

import { getDb, prepare, runInTransaction } from '../core/db.js';
import type { Agent } from '../core/types.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// ===== CLI Args =====
const args = process.argv.slice(2);
const getArg = (key: string, defaultVal?: string) => {
  const idx = args.indexOf(`--${key}`);
  return idx >= 0 ? args[idx + 1] : (defaultVal ?? '');
};
const hasFlag = (key: string) => args.includes(`--${key}`);
const getArgMulti = (key: string): string[] => {
  const idx = args.indexOf(`--${key}`);
  if (idx < 0) return [];
  const vals: string[] = [];
  for (let i = idx + 1; i < args.length; i++) {
    if (args[i].startsWith('--')) break;
    vals.push(args[i]);
  }
  return vals;
};

const AGENT_ID = getArg('agent-id');
const ACTION = getArg('action', 'show');
const TRAIT_KEY = getArg('trait-key');
const TRAIT_VALUE = getArg('trait-value');
const TRAIT_TYPE = getArg('trait-type', 'PATTERN');
const CONFIDENCE = parseFloat(getArg('confidence', '0.7'));
const OUTPUT = getArg('output', './export/agents.json');
const INPUT = getArg('input');

// ===== 人格 Schema =====
const DEFAULT_TRAITS: Record<string, { value: string; type: string; confidence: number; description: string }> = {
  // === 基础属性 ===
  'personality':       { value: '理性严谨',  type: 'CATEGORY', confidence: 1.0, description: '人格特征描述' },
  'communication_style':{ value: '简洁直接', type: 'CATEGORY', confidence: 1.0, description: '沟通风格' },
  'risk_preference':  { value: '中等',      type: 'CATEGORY', confidence: 0.7, description: '风险偏好: 保守/中等/激进' },

  // === 交易相关 ===
  'preferred_sectors': { value: '[]',        type: 'HISTORY',  confidence: 0.5, description: '偏好行业列表' },
  'best_market_condition': { value: 'trending', type: 'CATEGORY', confidence: 0.5, description: '最佳市场环境: trending/sideways/volatile' },
  'worst_market_condition': { value: 'sideways', type: 'CATEGORY', confidence: 0.5, description: '最差市场环境' },
  'avg_hold_duration': { value: '0',         type: 'NUMBER',   confidence: 0.3, description: '平均持仓时长(小时)' },
  'typical_confidence': { value: '0.7',      type: 'NUMBER',   confidence: 0.5, description: '典型投票置信度' },
  'contrarian_score': { value: '0.3',        type: 'NUMBER',   confidence: 0.3, description: '逆势倾向 0~1' },
  'stop_loss_pct':    { value: '5',          type: 'NUMBER',   confidence: 0.5, description: '止损百分比' },
  'take_profit_pct':  { value: '15',         type: 'NUMBER',   confidence: 0.4, description: '止盈百分比' },

  // === 学习成果 ===
  'learned_pitfall':  { value: '',           type: 'PATTERN',  confidence: 0.3, description: '学到的常见错误' },
  'strength':         { value: '',           type: 'PATTERN',  confidence: 0.5, description: '自我认知的优势' },
  'weakness':         { value: '',           type: 'PATTERN',  confidence: 0.5, description: '自我认知的劣势' },
  'self_adjustments': { value: '[]',         type: 'HISTORY',  confidence: 0.4, description: '自我调整记录' },
};

// ===== Agent 部门预设人格 =====
const DEPARTMENT_PERSONAS: Record<string, Record<string, string>> = {
  // 选举委员会
  'AST-0001': {
    personality: '公正裁决者',
    communication_style: '算法驱动，理性客观',
    risk_preference: '严格依规',
    typical_confidence: '0.95',
    strength: '严格执行加权聚合算法，不受情绪影响',
    weakness: '不能处理规则外的特殊情况',
    learned_pitfall: '不能仅凭少数人意见做决策',
  },
  // 选股
  'AGT-SEL-01': {
    personality: '机会发掘者',
    communication_style: '热情但有依据',
    risk_preference: '积极',
    typical_confidence: '0.6',
    strength: '对价格异动敏感，擅长发现早期信号',
    weakness: '信号噪音较多，需要盯盘筛选',
    learned_pitfall: '不是每个异常波动都值得交易',
  },
  // 审核部门 5 人
  'RAG-0001': {
    personality: '均线交叉法官',
    communication_style: '技术导向，用数据说话',
    risk_preference: '中等',
    typical_confidence: '0.8',
    strength: '对入场出场时机的判断精准',
    weakness: '震荡市中容易误判',
    learned_pitfall: '金叉后需要等量能确认，不能立即入场',
  },
  'RAG-0002': {
    personality: 'MACD 分析官',
    communication_style: '关注趋势强度',
    risk_preference: '中等偏保守',
    typical_confidence: '0.75',
    strength: '擅长判断趋势延续性',
    weakness: '滞后性明显，不适用于短线',
    learned_pitfall: '零轴下的金叉需要确认趋势反转',
  },
  'RAG-0003': {
    personality: 'RSI 警戒官',
    communication_style: '超买超卖警戒',
    risk_preference: '保守',
    typical_confidence: '0.7',
    strength: '对极端行情的警示非常有效',
    weakness: '趋势市中会过早离场',
    learned_pitfall: '强趋势下 RSI 可以在超买区持续很久',
  },
  'RAG-0004': {
    personality: '布林带观察员',
    communication_style: '区间思维',
    risk_preference: '中等偏保守',
    typical_confidence: '0.75',
    strength: '对价格极值点的判断准确',
    weakness: '单边突破行情容易踏空',
    learned_pitfall: '价格突破上轨不代表见顶',
  },
  'RAG-0005': {
    personality: '海龟趋势跟踪官',
    communication_style: '趋势跟踪，果断执行',
    risk_preference: '激进',
    typical_confidence: '0.85',
    strength: '趋势市场中收益最大',
    weakness: '震荡市中频繁假突破',
    learned_pitfall: '不加仓等于浪费趋势',
  },
  // 盯盘
  'AGT-WATCH-01': {
    personality: '警觉的哨兵',
    communication_style: '简洁，及时',
    risk_preference: '保守',
    typical_confidence: '0.9',
    strength: '冷却检查防止重复投票',
    weakness: '无法判断信号质量',
  },
  // 数据部门
  'AGT-DATA-01': {
    personality: '数据管道',
    communication_style: '精确，纯信息',
    risk_preference: 'N/A',
    typical_confidence: '1.0',
    strength: '提供原始数据，不掺杂分析',
    weakness: '不分析，只传递',
  },
  // 执行
  'AGT-EXE-01': {
    personality: '可靠的操作员',
    communication_style: '程序化，安全第一',
    risk_preference: '保守',
    typical_confidence: '0.95',
    strength: '严格执行风控检查',
    weakness: '无自主判断',
    learned_pitfall: '滑点不可预测，挂限价单',
  },
  // 审计
  'AGT-AUD-01': {
    personality: '铁面审计官',
    communication_style: '数据驱动，不留情面',
    risk_preference: '严格',
    typical_confidence: '0.9',
    strength: '精确统计胜率，公平执行淘汰',
    weakness: '不能评估策略的未来潜力',
    learned_pitfall: '样本量小的时候不能做结论',
  },
};

// ===== 工具函数 =====

/** 获取 Agent 基本档案 */
function getAgentInfo(agentId: string): any {
  return getDb().prepare(
    'SELECT agent_id, agent_name, profile_name, status, win_count, total_trades, win_rate, joined_at FROM agents WHERE agent_id = ?'
  ).get(agentId);
}

/** 获取 Agent 所有 traits */
function getAgentTraits(agentId: string): any[] {
  return getDb().prepare(
    'SELECT trait_key, trait_value, trait_type, confidence, sample_count, last_updated FROM agent_traits WHERE agent_id = ?'
  ).all(agentId);
}

/** 更新或插入一个 trait */
function upsertTrait(agentId: string, key: string, value: string, type: string, confidence: number): void {
  const existing = getDb().prepare(
    'SELECT sample_count, confidence FROM agent_traits WHERE agent_id = ? AND trait_key = ?'
  ).get(agentId, key) as any;

  const newSampleCount = (existing?.sample_count ?? 0) + 1;
  const newConfidence = existing
    ? Math.min(1.0, (existing.confidence * 0.5 + confidence * 0.5))
    : confidence;

  getDb().prepare(`
    INSERT INTO agent_traits (agent_id, trait_key, trait_value, trait_type, confidence, last_updated, sample_count)
    VALUES (?, ?, ?, ?, ?, datetime('now'), ?)
    ON CONFLICT(agent_id, trait_key) DO UPDATE SET
      trait_value = excluded.trait_value,
      trait_type = excluded.trait_type,
      confidence = excluded.confidence,
      last_updated = excluded.last_updated,
      sample_count = excluded.sample_count
  `).run(agentId, key, value, type, Math.min(1.0, Math.max(0.0, newConfidence)), newSampleCount);
}

// ===== Actions =====

/** 显示 Agent 完整人格档案 */
function actionShow(agentId: string): void {
  const info = getAgentInfo(agentId);
  if (!info) {
    console.log(JSON.stringify({ error: `Agent ${agentId} not found` }));
    return;
  }

  const traits = getAgentTraits(agentId);
  const traitMap: Record<string, any> = {};
  for (const t of traits) {
    traitMap[t.trait_key] = t;
  }

  const persona = {
    agent_id: info.agent_id,
    agent_name: info.agent_name,
    profile: info.profile_name,
    status: info.status,
    stats: {
      win_count: info.win_count,
      total_trades: info.total_trades,
      win_rate: info.win_rate,
      joined_at: info.joined_at,
    },
    persona: traitMap,
  };

  console.log(JSON.stringify(persona, null, 2));
}

/** 初始化 Agent 的默认人格（首次运行时调用） */
function actionInit(agentId: string): void {
  const info = getAgentInfo(agentId);
  if (!info) {
    console.log(JSON.stringify({ error: `Agent ${agentId} not found` }));
    return;
  }

  const departmentTraits = DEPARTMENT_PERSONAS[agentId];
  if (!departmentTraits) {
    console.log(JSON.stringify({ warning: `No preset persona for ${agentId}, using defaults` }));
  }

  runInTransaction(() => {
    for (const [key, def] of Object.entries(DEFAULT_TRAITS)) {
      const presetValue = departmentTraits?.[key];
      const value = presetValue !== undefined ? presetValue : def.value;
      upsertTrait(agentId, key, value, def.type, def.confidence);
    }
    // 额外更新统计类 traits 从 agents 表
    const existing = getAgentTraits(agentId);
    console.log(`[persona] Initialized ${agentId} with ${Object.keys(DEFAULT_TRAITS).length} traits`);
  });
  actionShow(agentId);
}

/** 更新单个 trait（自我学习） */
function actionUpdate(agentId: string, key: string, value: string, type: string, confidence: number): void {
  const info = getAgentInfo(agentId);
  if (!info) {
    console.log(JSON.stringify({ error: `Agent ${agentId} not found` }));
    return;
  }
  upsertTrait(agentId, key, value, type, confidence);
  console.log(JSON.stringify({
    status: 'updated',
    agent_id: agentId,
    trait_key: key,
    trait_value: value,
    trait_type: type,
    confidence: Math.min(1.0, confidence),
  }));
}

/** 导出所有 Agent 人格（用于迁移） */
function actionExport(agentId: string, outputPath: string): void {
  const db = getDb();
  let agents: any[];
  if (agentId === 'all') {
    agents = db.prepare('SELECT agent_id, agent_name, profile_name, status FROM agents').all() as any[];
  } else {
    const a = db.prepare('SELECT agent_id, agent_name, profile_name, status FROM agents WHERE agent_id = ?').get(agentId) as any;
    if (!a) { console.log(JSON.stringify({ error: `Agent ${agentId} not found` })); return; }
    agents = [a];
  }

  const exportData: any[] = [];
  for (const agent of agents) {
    const traits = getAgentTraits(agent.agent_id);
    exportData.push({
      agent_id: agent.agent_id,
      agent_name: agent.agent_name,
      profile_name: agent.profile_name,
      status: agent.status,
      traits: traits.map(t => ({
        key: t.trait_key,
        value: t.trait_value,
        type: t.trait_type,
        confidence: t.confidence,
        sample_count: t.sample_count,
      })),
    });
  }

  const json = JSON.stringify(exportData, null, 2);
  const dir = dirname(outputPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(outputPath, json, 'utf-8');

  console.log(JSON.stringify({
    status: 'exported',
    path: outputPath,
    agent_count: exportData.length,
    traits_count: exportData.reduce((s, a) => s + a.traits.length, 0),
  }));
}

/** 导入 Agent 人格（从迁移恢复） */
function actionImport(agentId: string, inputPath: string): void {
  if (!existsSync(inputPath)) {
    console.log(JSON.stringify({ error: `File not found: ${inputPath}` }));
    return;
  }

  const raw = readFileSync(inputPath, 'utf-8');
  let data: any[];
  try {
    data = JSON.parse(raw);
  } catch {
    console.log(JSON.stringify({ error: 'Invalid JSON in import file' }));
    return;
  }

  if (!Array.isArray(data)) data = [data];

  let importedCount = 0;
  runInTransaction(() => {
    for (const agent of data) {
      if (agentId !== 'all' && agent.agent_id !== agentId) continue;
      for (const trait of (agent.traits || [])) {
        upsertTrait(
          agent.agent_id,
          trait.key || trait.trait_key,
          trait.value || trait.trait_value,
          trait.type || trait.trait_type || 'PATTERN',
          trait.confidence ?? 0.7,
        );
        importedCount++;
      }
    }
  });

  console.log(JSON.stringify({
    status: 'imported',
    source: inputPath,
    agents_processed: agentId === 'all' ? data.length : 1,
    traits_imported: importedCount,
  }));
}

/** 更新统计类 trait（自动从 agents 表同步） */
function actionSync(agentId: string): void {
  const info = getAgentInfo(agentId);
  if (!info) {
    console.log(JSON.stringify({ error: `Agent ${agentId} not found` }));
    return;
  }

  runInTransaction(() => {
    upsertTrait(agentId, 'win_rate', String(info.win_rate), 'NUMBER', 1.0);
    upsertTrait(agentId, 'total_trades', String(info.total_trades), 'NUMBER', 1.0);
    upsertTrait(agentId, 'win_count', String(info.win_count), 'NUMBER', 1.0);
  });

  console.log(JSON.stringify({
    status: 'synced',
    agent_id: agentId,
    win_rate: info.win_rate,
    total_trades: info.total_trades,
  }));
}

// ===== Main =====
function main(): void {
  if (hasFlag('--help') || hasFlag('-h') || ACTION === 'help') {
    console.log(`
Usage:
  npx tsx src/scripts/persona.ts --agent-id <ID> --action show
    Show full persona profile for an agent

  npx tsx src/scripts/persona.ts --agent-id <ID> --action init
    Initialize default traits for an agent (first-time setup)

  npx tsx src/scripts/persona.ts --agent-id <ID> --action update \\
    --trait-key <KEY> --trait-value "<VALUE>" [--trait-type CATEGORY] [--confidence 0.7]
    Update a single trait (self-learning)

  npx tsx src/scripts/persona.ts --agent-id all --action export --output ./export/agents.json
    Export all agent personas for migration

  npx tsx src/scripts/persona.ts --agent-id all --action import --input ./export/agents.json
    Import agent personas from migration file

  npx tsx src/scripts/persona.ts --agent-id <ID> --action sync
    Sync stats from agents table into persona traits
`);
    return;
  }

  if (!AGENT_ID) {
    console.log(JSON.stringify({ error: '--agent-id is required' }));
    process.exit(1);
  }

  switch (ACTION) {
    case 'show':
      actionShow(AGENT_ID);
      break;
    case 'init':
      actionInit(AGENT_ID);
      break;
    case 'update':
      if (!TRAIT_KEY || !TRAIT_VALUE) {
        console.log(JSON.stringify({ error: '--trait-key and --trait-value required for update' }));
        process.exit(1);
      }
      actionUpdate(AGENT_ID, TRAIT_KEY, TRAIT_VALUE, TRAIT_TYPE, CONFIDENCE);
      break;
    case 'export':
      actionExport(AGENT_ID, OUTPUT);
      break;
    case 'import':
      if (!INPUT) {
        console.log(JSON.stringify({ error: '--input required for import' }));
        process.exit(1);
      }
      actionImport(AGENT_ID, INPUT);
      break;
    case 'sync':
      actionSync(AGENT_ID);
      break;
    default:
      console.log(JSON.stringify({ error: `Unknown action: ${ACTION}. Use --help` }));
      process.exit(1);
  }
}

main();
