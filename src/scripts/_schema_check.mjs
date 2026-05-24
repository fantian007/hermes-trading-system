import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('/Users/zys/workspace/hermes-trading-system/data/trading.db');

// 查看 election_rounds 实际列
const pragma = db.prepare("PRAGMA table_info(election_rounds)").all();
console.log('=== election_rounds 列定义 ===');
console.log(JSON.stringify(pragma, null, 2));

// 尝读取所有行（改小一点）
const rows = db.prepare("SELECT * FROM election_rounds LIMIT 3").all();
console.log('\n=== 示例数据 ===');
console.log(JSON.stringify(rows, null, 2));

// trades 列
const tPragma = db.prepare("PRAGMA table_info(trades)").all();
console.log('\n=== trades 列定义 ===');
console.log(JSON.stringify(tPragma, null, 2));

const tRows = db.prepare("SELECT * FROM trades LIMIT 3").all();
console.log('\n=== trades 示例 ===');
console.log(JSON.stringify(tRows, null, 2));

db.close();
