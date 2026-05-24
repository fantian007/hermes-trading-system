import { getDb } from '../src/core/db.js';
const db = getDb();
// 所有非终结状态的交易
const all = db.prepare("SELECT trade_id, symbol, quantity, buy_price, status, direction, created_at FROM trades ORDER BY status, symbol").all();
console.log(JSON.stringify(all, null, 2));
