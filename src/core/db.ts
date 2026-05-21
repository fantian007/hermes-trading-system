/**
 * SQLite 数据库连接层
 *
 * 使用 Node.js 内置的 node:sqlite 模块（Node 22.5+，实验性）。
 * 同步 API，所有 Agent 共享同一份 data/trading.db。
 */

import { DatabaseSync } from 'node:sqlite';
import { DB_PATH } from './config.js';

/** 全局数据库单例 */
let _db: DatabaseSync | null = null;

/**
 * 获取数据库连接（懒初始化单例）
 *
 * 首次调用时自动创建连接并启用 WAL 模式。
 */
export function getDb(): DatabaseSync {
  if (!_db) {
    _db = new DatabaseSync(DB_PATH);
    _db.exec('PRAGMA journal_mode = WAL');
    _db.exec('PRAGMA busy_timeout = 5000');
    _db.exec('PRAGMA foreign_keys = ON');
  }
  return _db;
}

/** 关闭数据库连接 */
export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

/** 执行 SQL 字符串 */
export function execSql(sql: string): void {
  getDb().exec(sql);
}

/**
 * 创建预编译语句
 *
 * node:sqlite 的 prepare() 直接返回 statement 对象。
 */
export function prepare(sql: string) {
  return getDb().prepare(sql);
}

/**
 * 事务包装器
 *
 * node:sqlite 不支持 transaction 函数包装。
 * 使用手动 BEGIN/COMMIT 方式。
 */
export function runInTransaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
