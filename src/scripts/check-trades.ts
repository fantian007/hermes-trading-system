import { getDb } from '../core/db.js';

const db = getDb();

// Check today's trades
const today = db.prepare("SELECT COUNT(*) as cnt FROM trades WHERE strftime('%Y-%m-%d', created_at) = date('now') AND direction = 'LONG'").get();
console.log('Today LONG trades:', today);

// Check the specific election round
const round = db.prepare('SELECT * FROM election_rounds WHERE round_id = ?').get('ELEC-20260523-2035');
console.log('Election round:', JSON.stringify(round, null, 2));

// Check all open LONG trades
const openTrades = db.prepare("SELECT * FROM trades WHERE direction='LONG' AND (sell_price IS NULL OR sell_price = 0)").all();
console.log('Open LONG trades:', JSON.stringify(openTrades, null, 2));
