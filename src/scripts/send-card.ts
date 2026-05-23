#!/usr/bin/env node
/** 飞书卡片纯透传 — Agent 拼好 JSON，此脚本只负责发送 */
import { sendCard } from '../notify/card.js';

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) { raw += chunk; }
  const card = JSON.parse(raw);
  const id = await sendCard(card);
  console.log(JSON.stringify({ type: 'card_sent', message_id: id || null, status: id ? 'ok' : 'failed' }));
}
main().catch(e => { console.error(JSON.stringify({ error: e.message })); process.exit(1); });
