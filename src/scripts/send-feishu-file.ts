import { sendMessage } from '../notify/feishu.js';
import { readFileSync } from 'fs';

async function main() {
  const message = readFileSync('/tmp/feishu_msg.txt', 'utf-8').trim();
  const messageId = await sendMessage(message);
  if (messageId) {
    console.log(JSON.stringify({ type: 'notify_sent', message_id: messageId, status: 'ok' }));
  } else {
    console.log(JSON.stringify({ type: 'notify_sent', status: 'failed', error: '飞书发送失败' }));
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
