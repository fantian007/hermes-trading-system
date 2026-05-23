import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('./data/trading.db');
const rows = db.prepare(`SELECT round_id, symbol FROM election_rounds WHERE resulted_trade_id IS NULL AND created_at > datetime('now', '-30 minutes') ORDER BY created_at`).all();
console.log('PENDING: ' + rows.map(r => r.round_id + ' ' + r.symbol).join('\n'));
db.close();
