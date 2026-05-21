/**
 * 数据库初始化脚本
 *
 * 用法：npx tsx sql/init.ts
 * 读取 sql/schema.sql 并执行建表语句。
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSql, closeDb } from '../src/core/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(__dirname, 'schema.sql');

console.log(`[db:init] Reading schema from ${schemaPath}`);
const sql = readFileSync(schemaPath, 'utf-8');

execSql(sql);
console.log('[db:init] Schema applied successfully');

closeDb();
