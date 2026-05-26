import { createContext, Config } from 'longbridge';

const symbols = ['AAPL.US', 'CRM.US', 'CLSK.US'];
const ctx = createContext(new Config({
  appKey: process.env.LB_APP_KEY,
  appSecret: process.env.LB_APP_SECRET,
  accessToken: process.env.LB_ACCESS_TOKEN,
}));

const resp = await ctx.quote.getRealTimeQuotes(symbols);
console.log(JSON.stringify(resp, null, 2));
ctx.close();
