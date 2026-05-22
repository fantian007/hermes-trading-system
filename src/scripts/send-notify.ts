/**
 * 对外通知发送 — PURE TOOL
 *
 * 职责（仅此一项）：
 *   接收消息文本，调用飞书 API 发送。
 *   只有广告部门 (advertising-agent) 才能调用此脚本。
 *
 * 用法：
 *   npx tsx src/scripts/send-notify.ts --message "NVDA 交易完成，盈利 $350"
 *   npx tsx src/scripts/send-notify.ts --message "🚨 熔断触发：日回撤 8.5%"
 */

import { sendMessage } from '../notify/feishu.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (key: string) => {
    const idx = args.indexOf(`--${key}`);
    return idx >= 0 ? args[idx + 1] : '';
  };
  return { message: get('message') };
}

async function main() {
  const { message } = parseArgs();

  if (!message) {
    console.error('Usage: send-notify.ts --message <TEXT>');
    process.exit(1);
  }

  const messageId = await sendMessage(message);

  if (messageId) {
    console.log(JSON.stringify({
      type: 'notify_sent',
      message_id: messageId,
      status: 'ok',
    }));
  } else {
    console.log(JSON.stringify({
      type: 'notify_sent',
      status: 'failed',
      error: '飞书发送失败（可能未配置 FEISHU_CHAT_ID）',
    }));
  }
}

main().catch((err) => {
  console.error(JSON.stringify({
    type: 'notify_sent',
    status: 'error',
    error: err.message,
  }));
  process.exit(1);
});
