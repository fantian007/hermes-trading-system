import { getKline, getQuote } from './src/market/quote.js';

async function main() {
  const symbol = 'NVTS.US';
  const kline = await getKline(symbol, '', '', 'day');
  const quote = await getQuote([symbol]);
  const output = {
    symbol,
    kline: Array.isArray(kline) ? kline.slice(0, 60) : kline,
    quote: Array.isArray(quote) ? quote[0] : quote,
  };
  console.log(JSON.stringify(output, null, 2));
}

main().catch((e: any) => {
  console.error(JSON.stringify({ error: e.message }));
  process.exit(1);
});
