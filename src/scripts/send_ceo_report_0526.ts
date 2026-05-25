import { sendCard } from '../notify/card.js';

const card = {
  msg_type: 'interactive',
  card: {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: 'CEO巡检报告 2026-05-26 00:50' },
      template: 'blue',
    },
    elements: [
      {
        tag: 'div',
        text: { tag: 'lark_md', content: '**健康状态：系统正常运转**' },
      },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content:
            'CEO [OK] - 常驻守护\n' +
            'Strategy Director [OK] - 所有策略Agent活跃\n' +
            'ELC [OK] - CRM投票HOLD完成\n' +
            'Execution [OK] - 2笔有效持仓(AAPL/CRM)\n' +
            'Advertising [OK] - 多通道通知正常\n' +
            'HR [OK] - 知识库维护中\n' +
            'Data [OK] - 学习任务完成\n' +
            'Sentiment [OK] - 学习中\n' +
            'Strategy-07 [OK] - 已重建(DeepSeek)',
        },
      },
      { tag: 'hr' },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content:
            '**本周期处置：**\n' +
            '1. strategy-07 5x崩溃修复：关闭Anthropic通道，改用DeepSeek\n' +
            '2. CRM.US投票：5策略Agent一致HOLD，无需操作\n' +
            '3. ORCL买入失败：等待用户决策\n' +
            '4. 审核部门阻塞中：等待幽灵交易清理方案\n' +
            '5. 清理4个无profile的滞留ready任务',
        },
      },
      { tag: 'hr' },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content:
            '**持仓概况：**\n' +
            '净资产：$87,223.66\n' +
            '有效持仓：AAPL 5@$308.40, CRM 1@$180.07\n' +
            '关注：ORCL买入待恢复、CLSK持仓确认、NVDA脏数据清理',
        },
      },
    ],
  },
};

async function main() {
  const id = await sendCard(card);
  console.log(JSON.stringify({ type: 'card_sent', message_id: id || null, status: id ? 'ok' : 'failed' }));
}
main().catch((e) => {
  console.error(JSON.stringify({ error: e.message }));
  process.exit(1);
});
