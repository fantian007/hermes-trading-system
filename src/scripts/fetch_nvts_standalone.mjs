/**
 * Fetch NVTS.US market data — simplified entrypoint.
 */
import { getKline, getQuote } from '../market/quote.js';
import { writeFileSync } from 'node:fs';

async function main() {
  const kline = await getKline('NVTS.US', '', '', 'day');
  const quote = await getQuote(['NVTS.US']);
  
  writeFileSync('/tmp/nvts_data.json', JSON.stringify({
    kline: kline && !('error' in kline) ? kline.slice(0, 60) : kline,
    quote: quote && !('error' in quote) ? quote[0] : quote
  }, null, 2));
  console.log('Data written to /tmp/nvts_data.json');
}

main().catch(e => { console.error(e); process.exit(1); });
