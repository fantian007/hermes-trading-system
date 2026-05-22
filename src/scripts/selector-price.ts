/**
 * 选股 Agent — 价格异动
 *
 * 独立监控价格涨跌幅，发现异常波动 → 自主提交信号到股池。
 * 每个 Agent 独立运行，不依赖其他 Agent。
 *
 * 行情数据获取方式：
 *   不再直接调用 longbridge CLI，而是通过 data-agent（数据部门）获取。
 *   Agent 之间自然语言对话：向 data-agent 请求报价和 K 线数据。
 *
 * 用法：
 *   npx tsx src/scripts/selector-price.ts
 */

import { execSync } from 'node:child_process';

const SYMBOLS = ['NVDA.US', 'AAPL.US', 'TSLA.US', 'MSFT.US', 'GOOGL.US', 'AMZN.US', 'META.US'];

function submit(symbol: string, type: string, strength: number, source: string, reason: string) {
  execSync(`npx tsx src/scripts/submit-signal.ts --symbol ${symbol} --type ${type} --strength ${strength} --source ${source} --reason "${reason}" --agent-id AGT-SEL-01`, { timeout: 10000 });
}

async function main() {
  console.log('[selector-price] 启动扫描...');
  console.log('[selector-price] (数据通过 data-agent 获取 — 请向 data-agent 请求报价和 K 线)');

  // 数据获取：
  // 向 data-agent 请求：
  //   1. "帮我查一下各标的的实时报价" → data-service --type quote --symbol <SYM>
  //   2. "帮我查一下各标的的 K 线数据" → data-service --type kline --symbol <SYM> --days 25
  // 然后基于返回的价格和 K 线数据判断异动并提交信号。

  for (const sym of SYMBOLS) {
    // 向数据部门请求行情数据
    // 示例: Agent 对话 → data-agent 执行 data-service → 返回 JSON
    // 以下为示意性代码，实际运行时 Agent 通过自然语言向 data-agent 请求数据
    console.log(`[selector-price] 向 data-agent 查询 ${sym} 行情数据...`);

    // 实际 Agent 流程：
    // 1. 问 data-agent: "帮我查一下 ${sym} 的实时报价和最近 25 天 K 线"
    // 2. data-agent 运行:
    //    npx tsx src/scripts/data-service.ts --type quote --symbol ${sym}
    //    npx tsx src/scripts/data-service.ts --type kline --symbol ${sym} --days 25
    // 3. data-agent 返回 JSON 结果
    // 4. 本 Agent 根据价格变化判断并提交信号

    console.log(`[selector-price] 请先向 data-agent 获取 ${sym} 的报价数据，然后判断异动并提交信号`);
  }
  console.log('[selector-price] 扫描完成');
  console.log('[selector-price] 提醒：请向 data-agent 请求行情数据后，根据返回结果判断是否提交信号');
}

main().catch(console.error);
