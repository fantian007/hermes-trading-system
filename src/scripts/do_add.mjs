// Add UBER to stock pool
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('/Users/zys/workspace/hermes-trading-system/data/trading.db');
const now = new Date().toISOString();

const stmt = db.prepare(`
  INSERT INTO stock_pool (symbol, signal_type, strength, source, reason, status, added_by, added_at)
  VALUES (?, ?, ?, ?, ?, 'ACTIVE', 'SENT-001', ?)
`);

stmt.run('UBER.US', 'BULLISH', 3, '市场扫描', '出行+外卖双轮驱动，盈利持续改善，自驾驶布局长期利好', now);
console.log('Added UBER.US to pool');

db.close();
