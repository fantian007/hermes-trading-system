import { feishu } from '../core/config.js';
import { getToken } from './feishu.js';

export async function sendCard(card: any): Promise<string | undefined> {
  if (!feishu.chatId) { console.warn('[feishu] CHAT_ID missing'); return; }
  const token = await getToken();
  const resp = await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ receive_id: feishu.chatId, msg_type: 'interactive', content: JSON.stringify(card) }),
  });
  const body = await resp.json() as { code: number; msg: string; data?: { message_id: string } };
  if (body.code !== 0) { console.error(`[feishu] card failed: [${body.code}] ${body.msg}`); return; }
  return body.data?.message_id;
}
