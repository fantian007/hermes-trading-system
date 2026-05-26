import { sendMessage } from '../notify/feishu.js';

const msg = [
  'ELC-001 add-position confirmation result:',
  '',
  'CLSK.US (ELEC-20260526-1205):',
  '  Existing: 1 share @ 15.40 (OPEN)',
  '  New BUY: TRD-20260526-CLSK-000 (50 shares, price=0.0, OPEN)',
  '  Verdict: ADD POSITION',
  '',
  'AAPL.US (ELEC-20260526-1206):',
  '  Existing: 5 shares @ 308.40 (OPEN)',
  '  New BUY: TRD-20260526-AAPL-000 (5 shares, price=0.0, OPEN)',
  '  Verdict: ADD POSITION',
  '',
  'Trades created but unfilled (price=0). Submitted to execution-agent (t_cbf7e071).',
].join('\n');

const messageId = await sendMessage(msg);
if (messageId) {
  console.log('OK', messageId);
} else {
  console.log('FAILED');
}
