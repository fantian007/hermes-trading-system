import { getKline, getQuote } from './src/market/quote.js';

async function main() {
  const k = await getKline('NVTS.US','','','day');
  const q = await getQuote(['NVTS.US']);
  console.log(JSON.stringify({kline: k?.slice?.(0,60), quote: q?.[0]}, null, 2));
}
main().catch(e => console.error(e.message));
