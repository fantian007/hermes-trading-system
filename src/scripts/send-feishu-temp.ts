import { sendMessage } from '../notify/feishu.js';

const message = "\u9009\u4e3e\u59d4\u5458\u4f1a: CRM.US ELEC-20260525-1634 \u6295\u7968\u5b8c\u6210\u30025\u7968\u5168HOLD, \u4e00\u81f4\u901a\u8fc7\u4e0d\u6267\u884c\u3002";

sendMessage(message).then((mid) => {
  if (mid) {
    console.log(JSON.stringify({ type: 'notify_sent', message_id: mid, status: 'ok' }));
  } else {
    console.log(JSON.stringify({ type: 'notify_sent', status: 'failed', error: 'send failed' }));
  }
}).catch((err) => {
  console.log(JSON.stringify({ type: 'notify_sent', status: 'error', error: err.message }));
  process.exit(1);
});
