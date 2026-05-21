/**
 * 胜负上报脚本
 *
 * 用法：
 *   npx tsx src/scripts/report-win.ts \
 *     --agent-id AGT-0001 \
 *     --trade-id TRD-20260521-001 \
 *     --result WIN \
 *     [--reflection '{"trait_updates":[...],"note":"..."}']
 *
 * 策略 Agent 在交易关闭后调用：
 *   1. 对比自己的 T1/T2 投票
 *   2. 自判胜负
 *   3. 可选：附带自我反思更新 agent_traits
 */

import { reportWin } from '../voting/reporter.js';
import type { WinReportRequest } from '../core/types.js';

function parseArgs(): WinReportRequest {
  const args = process.argv.slice(2);
  const get = (key: string) => {
    const idx = args.indexOf(`--${key}`);
    return idx >= 0 ? args[idx + 1] : '';
  };

  const reflectionRaw = get('reflection');
  let self_reflection = undefined;
  if (reflectionRaw) {
    try {
      self_reflection = JSON.parse(reflectionRaw);
    } catch {
      self_reflection = { note: reflectionRaw };
    }
  }

  return {
    agent_id: get('agent-id'),
    trade_id: get('trade-id'),
    result: (get('result') || 'MISS') as 'WIN' | 'LOSE' | 'MISS',
    buy_vote_match: get('buy-match') === 'true',
    sell_vote_match: get('sell-match') === 'true',
    self_reflection,
  };
}

const report = parseArgs();

if (!report.agent_id || !report.trade_id) {
  console.error('Usage: report-win.ts --agent-id <ID> --trade-id <ID> --result WIN|LOSE|MISS');
  process.exit(1);
}

reportWin(report);
console.log(JSON.stringify({ status: 'reported', report }));
