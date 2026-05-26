/**
 * Direct market data fetch using longbridge SDK (not CLI)
 * Node.js ESM version — no TypeScript assertions
 */
import 'dotenv/config';
import { Config } from 'longbridge/lib/config.js';
import { QuoteContext } from 'longbridge/lib/quote.js';

async function main() {
  const appKey = process.env.LONGBRIDGE_APP_KEY || '';
  const appSecret = process.env.LONGBRIDGE_APP_SECRET || '';
  const accessToken = process.env.LONGBRIDGE_ACCESS_TOKEN || '';

  const config = new Config({
    appKey: appKey,
    appSecret: appSecret,
    accessToken: accessToken,
    httpUrl: process.env.LONGBRIDGE_HTTP_URL,
    quoteWsUrl: process.env.LONGBRIDGE_QUOTE_WS_URL,
    tradeWsUrl: process.env.LONGBRIDGE_TRADE_WS_URL,
    enableOvernight: false,
  });

  const ctx = await QuoteContext.new(config);

  // Get real-time quote
  const quoteResp = await ctx.getQuote(['NVTS.US']);
  console.log('=== QUOTE ===');
  console.log(JSON.stringify(quoteResp, null, 2));

  // Get daily kline (last 60 days)
  const klineResp = await ctx.getKLines({
    symbol: 'NVTS.US',
    period: 'DAY',
    count: 60,
  });
  console.log('=== KLINE ===');
  console.log(JSON.stringify(klineResp, null, 2));

  await ctx.close();
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
