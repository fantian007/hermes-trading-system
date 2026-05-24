/**
 * 种子数据 — 预配部门和 Agent
 *
 * 用法: npx tsx sql/seeds/seed-departments.ts
 *
 * 先写 agents（清旧数据），再写 departments。
 * profiles 文件需要提前存在，职责写在 YAML 的 system_prompt 里。
 */
import { getDb, execSql, closeDb } from '../../src/core/db.js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

try {
  // 1) Schema
  execSql(readFileSync(resolve(__dirname, '../schema.sql'), 'utf-8'));
  console.log('[seed] Schema ready');

  // 2) 清空旧数据（需先关外键检查）
  execSql('PRAGMA foreign_keys = OFF');
  execSql('DELETE FROM departments');
  execSql('DELETE FROM review_reports');
  execSql('DELETE FROM win_reports');
  execSql('DELETE FROM agent_votes');
  execSql('DELETE FROM election_rounds');
  execSql('DELETE FROM trades');
  execSql('DELETE FROM stock_pool');
  execSql('DELETE FROM agent_traits');
  execSql('DELETE FROM strategy_signatures');
  execSql('DELETE FROM agent_status_log');
  execSql('DELETE FROM agents');
  execSql('DELETE FROM daily_ledger');
  execSql('PRAGMA foreign_keys = ON');
  console.log('[seed] Cleared old data');

  // 3) Agents — 15 人，策略部门 6 人（选股+盯盘合并）
  execSql(`
    INSERT INTO agents (agent_id, agent_name, profile_name, strategy_source, strategy_summary, indicators, status, created_by) VALUES
      ('DAT-001', '数据管家', 'data-agent', '', '统一行情接口', '[]', 'ACTIVE', 'system'),
      ('AGT-001', '均线交叉策略官', 'strategy-01', '《股市趋势技术分析》', 'MA5 上穿 MA20 买入，下穿卖出', '["ma"]', 'ACTIVE', 'system'),
      ('AGT-002', 'MACD策略官', 'strategy-01', '技术分析', 'DIF 上穿 DEA 买入，柱状图背离确认', '["macd"]', 'ACTIVE', 'system'),
      ('AGT-003', 'RSI策略官', 'strategy-01', '技术分析', 'RSI<30 超卖买入，RSI>70 超买卖出', '["rsi"]', 'ACTIVE', 'system'),
      ('AGT-004', '布林带策略官', 'strategy-01', '技术分析', '触及下轨买入，上轨卖出，带宽收缩预示突破', '["bollinger"]', 'ACTIVE', 'system'),
      ('AGT-005', '海龟交易策略官', 'strategy-01', '《海龟交易法则》', '价格突破 N 日高低点结合 ATR 波动率判断', '["donchian","atr"]', 'ACTIVE', 'system'),
      ('AGT-006', '价格异动策略官', 'strategy-01', '价格行为分析', '涨跌幅异常+放量突破，盘面异动监控', '["price"]', 'ACTIVE', 'system'),
      ('ELC-001', '投资总监', 'election-committee', '', '最终决策者，收集策略官和审核官意见后拍板', '[]', 'ACTIVE', 'system'),
      ('RAG-001', '均线交叉审核官', 'review-01', '《股市趋势技术分析》', '基于MA5/MA20位置关系审核', '["ma"]', 'ACTIVE', 'system'),
      ('RAG-002', 'MACD审核官', 'review-01', '技术分析', '基于MACD柱状图和信号线审核', '["macd"]', 'ACTIVE', 'system'),
      ('RAG-003', 'RSI审核官', 'review-01', '技术分析', '基于RSI超买/超卖区域审核', '["rsi"]', 'ACTIVE', 'system'),
      ('RAG-004', '布林带审核官', 'review-01', '技术分析', '基于布林带轨道和带宽审核', '["bollinger"]', 'ACTIVE', 'system'),
      ('RAG-005', '海龟交易审核官', 'review-01', '《海龟交易法则》', '基于唐奇安通道突破审核', '["donchian"]', 'ACTIVE', 'system'),
      ('EXE-001', '交易操作员', 'execution-agent', '', '执行下单指令，风控判断，持仓监控', '[]', 'ACTIVE', 'system'),
      ('HR-001', '人事总监', 'hr-agent', '', '组织发展与人事管理', '[]', 'ACTIVE', 'system'),
      ('ADV-001', '传声筒', 'advertising-agent', '', '对外通知发送', '[]', 'ACTIVE', 'system');
  `);
  console.log('[seed] 16 agents seeded');

  // 4) Departments — 7 个部门（策略部门替代了选股+盯盘）
  execSql(`
    INSERT INTO departments (dept_id, dept_name, dept_desc, leader_agent_id, created_by) VALUES
      ('DPT-001', '数据部门', '统一行情接口', 'DAT-001', 'system'),
      ('DPT-002', '策略部门', '独立分析师团队，自主排班、自主分析、自主投票', 'AGT-001', 'system'),
      ('DPT-003', '选举委员会', '收集策略官和审核官意见后拍板BUY/SELL/HOLD', 'ELC-001', 'system'),
      ('DPT-004', '审核部门', '交易后的事后审核', 'RAG-001', 'system'),
      ('DPT-005', '执行部门', '下单、风控、持仓监控', 'EXE-001', 'system'),
      ('DPT-006', 'HR部门', '人事管理、绩效审计、组织架构咨询', 'HR-001', 'system'),
      ('DPT-007', '广告部门', '对外通知出口', 'ADV-001', 'system');
  `);
  console.log('[seed] 7 departments seeded');

  // 5) 验证 - profiles 必须已有对应文件
  const profileFiles = ['data-agent', 'strategy-01', 'election-committee', 'review-01',
    'execution-agent', 'hr-agent', 'advertising-agent'];
  let missing = 0;
  for (const pf of profileFiles) {
    const path = resolve(__dirname, `../../profiles/${pf}.yaml`);
    if (!existsSync(path)) {
      console.warn(`  ⚠️ 缺少 profile: ${pf}.yaml`);
      missing++;
    }
  }
  if (missing === 0) console.log('[seed] All 16 profile files present');
  else console.warn(`[seed] ${missing} profile(s) missing — 请创建后再注册`);

  // 6) 验证
  const db = getDb();
  const rows = db.prepare(`
    SELECT d.dept_name, d.leader_agent_id, COUNT(ad.agent_id) as cnt
    FROM departments d LEFT JOIN agents ad ON d.leader_agent_id = ad.agent_id
    GROUP BY d.dept_id ORDER BY d.dept_name
  `).all();
  console.log('\n部门验证：');
  for (const r of rows) {
    console.log(`  ${String(r.dept_name).padEnd(12)} 组长:${String(r.leader_agent_id).padEnd(10)} 组员:${r.cnt}人`);
  }

  closeDb();
  console.log('\n[seed] All done!');
} catch (err) {
  console.error(err);
  process.exit(1);
}
