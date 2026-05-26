import { getKline, getQuote } from '../market/quote.js';
import { writeFileSync } from 'node:fs';

async function main() {
  console.error('Fetching NVTS.US market data...');
  const kline = await getKline('NVTS.US', '', '', 'day');
  const quote = await getQuote(['NVTS.US']);
  
  const data = {
    kline: kline && !('error' in kline) ? kline.slice(0, 60) : kline,
    quote: quote && !('error' in quote) ? quote[0] : quote,
  };
  
  writeFileSync('/tmp/nvts_data.json', JSON.stringify(data, null, 2));
  console.log(JSON.stringify(data, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
