#!/usr/bin/env node
/**
 * 飞书卡片消息发送 — 广告部门专用
 *
 * 用法：
 *   npx tsx src/scripts/send-card.ts \
 *     --title "交易执行" --source "📊 策略部门 AGT-002" --color green \
 *     --body "**NVDA.US** 买入 10股\n\n成交价 $216.44 | 金额 $2,164"
 */

import { sendCard, type CardConfig } from '../notify/card.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (key: string) => {
    const idx = args.indexOf(`--${key}`);
    return idx >= 0 ? args[idx + 1] : '';
  };
  return {
    title: get('title'),
    source: get('source'),
    color: get('color') || 'blue',
    body: get('body'),
  };
}

async function main() {
  const { title, source, color, body } = parseArgs();

  if (!body) {
    console.error('Usage: send-card.ts --title <TITLE> --source <DEPT> --color <COLOR> --body <MARKDOWN>');
    process.exit(1);
  }

  const headerTitle = title || '通知';
  const headerSubtitle = source || '';

  const cfg: CardConfig = {
    header: {
      title: headerTitle,
      subtitle: headerSubtitle,
      template: (color || 'blue') as any,
    },
    sections: [{ text: body }],
  };

  const messageId = await sendCard(cfg);

  if (messageId) {
    console.log(JSON.stringify({ type: 'card_sent', message_id: messageId, status: 'ok' }));
  } else {
    console.log(JSON.stringify({ type: 'card_sent', status: 'failed', error: '发送失败' }));
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ type: 'card_sent', status: 'error', error: err.message }));
  process.exit(1);
});
