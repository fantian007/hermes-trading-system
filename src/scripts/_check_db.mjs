import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workdir = path.resolve(__dirname, '..');
const dbPath = path.join(workdir, 'data', 'trading.db');

const db = new Database(dbPath);

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', JSON.stringify(tables));

const deptSQL = db.prepare("SELECT sql FROM sqlite_master WHERE name='departments'").get();
console.log('Departments schema:', deptSQL?.sql);

const depts = db.prepare("SELECT * FROM departments").all();
console.log('Existing depts:', JSON.stringify(depts));

const agentSQL = db.prepare("SELECT sql FROM sqlite_master WHERE name='agents'").get();
console.log('Agents schema:', agentSQL?.sql);

const agents = db.prepare("SELECT agent_id, agent_name, department_id, status FROM agents").all();
console.log('Existing agents:', JSON.stringify(agents));

db.close();
