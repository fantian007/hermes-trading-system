import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('./data/trading.db');

const all = db.prepare("SELECT round_id, symbol, created_at FROM election_rounds WHERE resulted_trade_id IS NULL ORDER BY created_at DESC LIMIT 20").all();
for (const r of all) console.log(r.round_id + ' ' + r.symbol);

db.close();
