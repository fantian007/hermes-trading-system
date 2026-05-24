const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.resolve(__dirname, '..', 'data/trading.db'));
const rounds = db.prepare('SELECT round_id, symbol, status, resulted_trade_id, created_at FROM election_rounds ORDER BY created_at DESC LIMIT 10').all();
console.log(JSON.stringify(rounds, null, 2));
const smci = db.prepare("SELECT * FROM election_rounds WHERE symbol LIKE '%SMCI%' ORDER BY created_at DESC LIMIT 5").all();
console.log('--- SMCI rounds ---');
console.log(JSON.stringify(smci, null, 2));
db.close();
