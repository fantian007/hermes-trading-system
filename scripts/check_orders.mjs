import Database from 'better-sqlite3';
const db = new Database('/Users/zys/workspace/hermes-trading-system/data/trading.db');

const dead = db.prepare(`SELECT round_id, symbol, status, resulted_trade_id, vote_type FROM election_rounds WHERE status='PASSED' AND resulted_trade_id IS NULL`).all();
console.log('DEAD_ORDERS:', JSON.stringify(dead));

const open = db.prepare(`SELECT id, symbol, direction, quantity, price, status FROM trades WHERE status='OPEN'`).all();
console.log('OPEN_TRADES:', JSON.stringify(open));

const today = new Date().toISOString().slice(0,10);
const todayTrades = db.prepare(`SELECT COUNT(*) as cnt FROM trades WHERE substr(created_at,1,10) = ?`).get(today);
console.log('TODAY_TRADES:', JSON.stringify(todayTrades));

const account = db.prepare(`SELECT * FROM account_snapshot ORDER BY id DESC LIMIT 1`).all();
console.log('ACCOUNT:', JSON.stringify(account));

db.close();
