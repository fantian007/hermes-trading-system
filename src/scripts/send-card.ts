#!/usr/bin/env node
/**
 * 飞书卡片消息发送 — 纯工具，零决策
 * 广告部 agent 自己决定标题/颜色/排版，此脚本只负责发送。
 *
 * 用法：
 *   echo "markdown内容" | npx tsx src/scripts/send-card.ts --title "标题" --source "部门" --color blue
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
  };
}

async function main() {
  const { title, source, color } = parseArgs();

  // Read body from stdin — agent writes markdown via pipe/heredoc
  let body = '';
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }
    body = Buffer.concat(chunks).toString().trim();
  }

  if (!body) {
    console.error('Usage: echo "body" | send-card.ts --title <TITLE> --source <DEPT> --color <COLOR>');
    process.exit(1);
  }

  const cfg: CardConfig = {
    header: {
      title: title || '通知',
      subtitle: source || '',
      template: color,
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
