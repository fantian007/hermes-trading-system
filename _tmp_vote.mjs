import { getKline, getQuote } from './src/market/quote.ts';
import { getDb } from './src/core/db.ts';

// Agent data
const agent = getDb().prepare('SELECT * FROM agents WHERE agent_id = ?').get('AGT-004');
console.log('=== AGENT ===');
console.log(JSON.stringify(agent, null, 2));

const traits = getDb().prepare('SELECT * FROM agent_traits WHERE agent_id = ?').all('AGT-004');
console.log('=== TRAITS ===');
console.log(JSON.stringify(traits, null, 2));

// Market data
const kline = await getKline('NVTS.US', '', '', 'day');
console.log('=== KLINE (last 50) ===');
console.log(JSON.stringify(kline?.slice?.(-50) ?? kline, null, 2));

const quote = await getQuote(['NVTS.US']);
console.log('=== QUOTE ===');
console.log(JSON.stringify(quote, null, 2));
