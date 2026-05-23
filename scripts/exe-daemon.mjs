#!/usr/bin/env node
// EXE-001 Daemon Monitor — checks for new election rounds every 60 seconds
// This runs in the background and writes status updates
import { execSync } from 'child_process';
import { writeFileSync, appendFileSync, existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(__dirname, '..');
const DB = path.join(PROJECT, 'data', 'trading.db');
const LOG = path.join(PROJECT, 'logs', 'exe-daemon.log');
const STATE = path.join(PROJECT, 'logs', 'exe-state.json');
const KNOWN_ROUNDS = path.join(PROJECT, 'logs', '.known_rounds.txt');

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try { appendFileSync(LOG, line + '\n'); } catch {}
}

function query(sql) {
  try {
    const out = execSync(`sqlite3 "${DB}" "${sql.replace(/"/g, '\\"')}"`, {
      cwd: PROJECT, encoding: 'utf8', timeout: 10000
    });
    return out.trim();
  } catch (e) {
    log(`DB query error: ${e.message}`);
    return '';
  }
}

function readKnownRounds() {
  try {
    if (!existsSync(KNOWN_ROUNDS)) return new Set();
    const data = readFileSync(KNOWN_ROUNDS, 'utf8').trim();
    return new Set(data.split('\n').filter(Boolean));
  } catch { return new Set(); }
}

function writeKnownRound(id) {
  try { appendFileSync(KNOWN_ROUNDS, id + '\n'); } catch {}
}

function checkElections() {
  const rounds = query("SELECT round_id, symbol, final_decision, decision_confidence, created_at FROM election_rounds WHERE executed_at IS NULL ORDER BY created_at DESC LIMIT 10;");
  if (!rounds) return [];
  
  const known = readKnownRounds();
  const result = [];
  for (const line of rounds.split('\n')) {
    const parts = line.split('|');
    if (parts.length >= 5) {
      const [roundId, symbol, decision, confidence, createdAt] = parts;
      if (!known.has(roundId)) {
        result.push({ roundId, symbol, decision, confidence, createdAt });
        writeKnownRound(roundId);
      }
    }
  }
  return result;
}

// New: Detect BUY/SELL rounds that haven't been executed yet
function checkPendingExecutions() {
  const rows = query("SELECT round_id, symbol, final_decision, decision_confidence FROM election_rounds WHERE final_decision IN ('BUY','SELL') AND (resulted_trade_id IS NULL OR resulted_trade_id = '') AND executed_at IS NULL ORDER BY created_at;");
  if (!rows) return [];
  return rows.split('\n').filter(Boolean).map(line => {
    const parts = line.split('|');
    return { roundId: parts[0], symbol: parts[1], decision: parts[2], confidence: parts[3] };
  });
}

function checkTrades() {
  const trades = query("SELECT trade_id, symbol, direction, status, buy_price, quantity FROM trades WHERE status='OPEN' OR status='PENDING' ORDER BY created_at DESC LIMIT 10;");
  if (!trades) return [];
  return trades.split('\n').filter(Boolean).map(line => {
    const parts = line.split('|');
    return { trade_id: parts[0], symbol: parts[1], direction: parts[2], status: parts[3], buy_price: parts[4], quantity: parts[5] };
  });
}

function saveState(state) {
  writeFileSync(STATE, JSON.stringify(state, null, 2));
}

log(`EXE-001 daemon started. PID=${process.pid} Project=${PROJECT}`);

let cycle = 1;
while (true) {
  try {
    const newRounds = checkElections();
    const pendingEx = checkPendingExecutions();
    const openTrades = checkTrades();
    
    const state = {
      cycle,
      timestamp: new Date().toISOString(),
      newElectionRounds: newRounds.length > 0 ? newRounds : 'none',
      pendingExecutions: pendingEx.length > 0 ? pendingEx : 'none',
      openTrades: openTrades.length > 0 ? openTrades : 'none',
    };
    saveState(state);

    if (pendingEx.length > 0) {
      log(`🚀 PENDING EXECUTIONS: ${JSON.stringify(pendingEx)}`);
    } else if (newRounds.length > 0) {
      log(`⚠️ NEW ELECTION ROUNDS FOUND: ${JSON.stringify(newRounds)}`);
    } else {
      log(`Cycle ${cycle}: no new rounds, no pending execs. Trades: ${openTrades.length} open.`);
    }
    
    // Sleep 60 seconds
    await new Promise(r => setTimeout(r, 60000));
    cycle++;
  } catch (e) {
    log(`ERROR in cycle ${cycle}: ${e.message}`);
    await new Promise(r => setTimeout(r, 10000));
  }
}
