/**
 * 审核部门 — 提交审核报告
 *
 * 职责（仅此一项）：
 *   将审核官的审核结论写入 review_reports 表。
 *   不做任何业务判断——Agent 自己决定 verdict。
 *
 * 用法：
 *   npx tsx src/scripts/review-submit.ts \
 *     --trade-id TRD-20260521-001 \
 *     --agent-id RAG-002 \
 *     --verdict PASS \
 *     --framework "MACD审核框架" \
 *     --reasoning "买入时DIF在零轴上方向上，DEA同步上行，MACD柱状图放大，支持买入方向。"
 */

import { getDb } from '../core/db.js';

interface Args {
  tradeId: string;
  agentId: string;
  verdict: string;
  framework: string;
  reasoning: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const get = (key: string) => {
    const idx = args.indexOf(`--${key}`);
    return idx >= 0 ? args[idx + 1] : '';
  };
  return {
    tradeId:   get('trade-id'),
    agentId:   get('agent-id'),
    verdict:   (get('verdict') || '').toUpperCase(),
    framework: get('framework'),
    reasoning: get('reasoning'),
  };
}

function main() {
  const { tradeId, agentId, verdict, framework, reasoning } = parseArgs();

  if (!tradeId || !agentId || !['PASS', 'WARN', 'FAIL'].includes(verdict)) {
    console.error('Usage: review-submit.ts --trade-id <ID> --agent-id <RAG-xxx> --verdict PASS|WARN|FAIL --framework <FRAMEWORK> --reasoning <REASON>');
    process.exit(1);
  }

  const now = new Date().toISOString();
  const reportId = `REV-${now.slice(0, 10).replace(/-/g, '')}-${agentId}-${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`;

  getDb().prepare(`
    INSERT OR REPLACE INTO review_reports
      (report_id, trade_id, agent_id, verdict, reasoning, review_framework, reviewed_at)
    VALUES
      (?, ?, ?, ?, ?, ?, ?)
  `).run(reportId, tradeId, agentId, verdict, reasoning, framework, now);

  console.log(JSON.stringify({
    status: 'submitted',
    report_id: reportId,
    trade_id: tradeId,
    agent_id: agentId,
    verdict,
    framework,
  }));
}

main();
