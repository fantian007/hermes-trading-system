import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('./data/trading.db');
db.exec('PRAGMA journal_mode=WAL');

// 1. Dead rounds
const dead = db.prepare(`SELECT round_id, symbol, direction, created_at FROM election_rounds WHERE status='PASSED' AND resulted_trade_id IS NULL`).all();
console.log('DEAD_ROUNDS:', JSON.stringify(dead));

// 2. Open trades
const open = db.prepare(`SELECT trade_id, symbol, direction, quantity, price, status FROM trades WHERE status='OPEN'`).all();
console.log('OPEN_TRADES:', JSON.stringify(open));

// 3. Recent election rounds
const recent = db.prepare(`SELECT round_id, symbol, direction, status, resulted_trade_id, created_at FROM election_rounds ORDER BY created_at DESC LIMIT 6`).all();
console.log('RECENT_ROUNDS:', JSON.stringify(recent));

// 4. Today's trades
const today = new Date().toISOString().slice(0, 10);
const tday = db.prepare(`SELECT trade_id, symbol, direction, quantity, status, price, created_at FROM trades WHERE date(created_at)=? ORDER BY created_at DESC`).all(today);
console.log('TODAY_TRADES:', JSON.stringify(tday));

// 5. Account snapshot
const act = db.prepare(`SELECT * FROM account_snapshots ORDER BY recorded_at DESC LIMIT 1`).all();
console.log('ACCOUNT_SNAPSHOT:', JSON.stringify(act));

// 6. Exe-daemon process check
const procs = db.prepare(`SELECT COUNT(*) as cnt FROM processes WHERE name='exe-daemon' AND status='running'`).all();
console.log('DAEMON_STATUS:', JSON.stringify(procs));

db.close();
