#!/usr/bin/env node
/** 飞书卡片纯透传 — Agent 拼好 JSON，此脚本只负责发送 */
import { sendCard } from '../notify/card.js';

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) { raw += chunk; }
  const wrapper = JSON.parse(raw);
  // If the incoming JSON has msg_type + card wrapper, strip it.
  // Feishu interactive API expects content to be JUST the card body {config, header, elements}.
  const cardBody = wrapper.card ?? wrapper;
  const id = await sendCard(cardBody);
  console.log(JSON.stringify({ type: 'card_sent', message_id: id || null, status: id ? 'ok' : 'failed' }));
}
main().catch(e => { console.error(JSON.stringify({ error: e.message })); process.exit(1); });
