#!/usr/bin/env node
/**
 * AGT-004 Bollinger Bands (20,2) Analysis for CRM.US
 * Writes vote to DB: /Users/zys/workspace/hermes-trading-system/data/trading.db
 */

import { execSync } from 'node:child_process';
import Database from 'better-sqlite3';

const SYMBOL = 'CRM.US';
const AGENT_ID = 'AGT-004';
const ROUND_ID = 'ELEC-20260525-1634';
const DB_PATH = '/Users/zys/workspace/hermes-trading-system/data/trading.db';
const WORKDIR = '/Users/zys/workspace/hermes-trading-system';

function lb(args) {
  try {
    const out = execSync(`longbridge ${args} --format json`, {
      timeout: 30000,
      maxBuffer: 1024 * 1024,
      cwd: WORKDIR,
      env: { ...process.env, HOME: '/Users/zys' },
    }).toString().trim();
    if (!out) return [];
    const lines = out.split('\n');
    let jsonStart = -1;
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (t.startsWith('{') || t.startsWith('[')) { jsonStart = i; break; }
    }
    if (jsonStart === -1) return [];
    return JSON.parse(lines.slice(jsonStart).join('\n'));
  } catch (e) {
    return { error: e.stderr?.toString()?.slice(0, 300) ?? e.message };
  }
}

function computeBB(closes) {
  const period = 20;
  const n = closes.length;
  const sma20 = closes.reduce((s, c) => s + c, 0) / n;
  const variance = closes.reduce((s, c) => s + (c - sma20) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const upperBand = sma20 + 2 * stdDev;
  const lowerBand = sma20 - 2 * stdDev;
  const currentClose = closes[n - 1]; // last element = most recent
  const bbPercent = (currentClose - lowerBand) / (upperBand - lowerBand);
  const bandwidth = (upperBand - lowerBand) / sma20;
  return {
    currentClose, sma20: +sma20.toFixed(2), upperBand: +upperBand.toFixed(2),
    lowerBand: +lowerBand.toFixed(2), stdDev: +stdDev.toFixed(2),
    bbPercent: +bbPercent.toFixed(4), bandwidth: +bandwidth.toFixed(4),
    position: currentClose > upperBand ? 'above_upper' :
              currentClose < lowerBand ? 'below_lower' :
              currentClose > sma20 ? 'above_mid' : 'below_mid',
  };
}

function determineVote(bb) {
  const pct = bb.bbPercent;
  let vote = 'HOLD', confidence = 0.50, reasoning = '';
  if (bb.position === 'below_lower') {
    vote = 'BUY'; confidence = 0.78;
    reasoning = `价格$${bb.currentClose}跌破下轨$${bb.lowerBand}，超卖反弹信号。BB%=${bb.bbPercent}，带宽=${bb.bandwidth}`;
  } else if (bb.position === 'above_upper') {
    vote = 'SELL'; confidence = 0.72;
    reasoning = `价格$${bb.currentClose}突破上轨$${bb.upperBand}，超买回调信号。BB%=${bb.bbPercent}，带宽=${bb.bandwidth}`;
  } else if (pct < 0.15) {
    vote = 'BUY'; confidence = 0.60;
    reasoning = `价格$${bb.currentClose}接近下轨(${bb.position})，BB%=${pct}，弱反弹预期`;
  } else if (pct > 0.85) {
    vote = 'SELL'; confidence = 0.55;
    reasoning = `价格$${bb.currentClose}接近上轨(${bb.position})，BB%=${pct}，弱回调预期`;
  } else {
    confidence = 0.50;
    reasoning = `价格$${bb.currentClose}在布林带内部(${bb.position})。SMA20=$${bb.sma20}，上轨=$${bb.upperBand}，下轨=$${bb.lowerBand}，BB%=${pct}。无突破信号，建议持有。`;
  }
  return { vote, confidence: +confidence.toFixed(2), reasoning };
}

async function main() {
  console.log('=== AGT-004 Bollinger Bands (20,2) Analysis ===');
  console.log(`Symbol: ${SYMBOL} | Round: ${ROUND_ID}\n`);

  // 1. Fetch klines
  console.log('Fetching kline data...');
  const raw = lb(`kline history ${SYMBOL} --period day`);
  if (raw.error) {
    console.error(`Longbridge error: ${raw.error}`);
    // Fallback: try tsx script
    try {
      const fallback = execSync(`npx tsx src/scripts/data-service.ts --type kline --symbol ${SYMBOL} --days 30`, { cwd: WORKDIR, timeout: 30000 }).toString();
      console.log('Fallback output received');
    } catch (e2) {
      console.error(`Fallback also failed: ${e2.message}`);
      return { error: raw.error };
    }
  }
  const klines = Array.isArray(raw) ? raw : (raw.candlesticks || raw.items || []);
  if (!klines.length) { console.error('No kline data'); return { error: 'No kline data' }; }

  // Parse closes - most recent first from API
  const closes = klines.map(k => parseFloat(k.close || k.closePrice || '0')).filter(c => c > 0);
  console.log(`Got ${closes.length} valid closes`);

  // Reverse to chronological order (oldest first)
  const chrono = [...closes].reverse();
  
  // Get last 20 closes for BB calculation
  const bbCloses = chrono.slice(-20);
  console.log(`Using ${bbCloses.length} bars for BB(20,2):`);
  for (let i = 0; i < bbCloses.length; i++) {
    console.log(`  [${i+1}] $${bbCloses[i]}`);
  }

  // 2. Compute
  const bb = computeBB(bbCloses);
  console.log(`\nCurrent: $${bb.currentClose}`);
  console.log(`SMA20: $${bb.sma20}`);
  console.log(`Upper: $${bb.upperBand} | Lower: $${bb.lowerBand}`);
  console.log(`StdDev: $${bb.stdDev}`);
  console.log(`BB%: ${bb.bbPercent} | Bandwidth: ${bb.bandwidth}`);
  console.log(`Position: ${bb.position}`);

  // 3. Decide
  const dec = determineVote(bb);
  console.log(`\nVOTE: ${dec.vote} (confidence: ${dec.confidence})`);
  console.log(`Reasoning: ${dec.reasoning}`);

  // 4. Write to DB
  const db = new Database(DB_PATH);
  const voteId = `VOTE-${ROUND_ID}-${AGENT_ID}`;
  const tradeId = `TMP-${ROUND_ID}`;
  const rawAnalysis = JSON.stringify({
    symbol: SYMBOL, roundId: ROUND_ID, currentPrice: bb.currentClose,
    sma20: bb.sma20, upperBand: bb.upperBand, lowerBand: bb.lowerBand,
    stdDev: bb.stdDev, bbPercent: bb.bbPercent, bandwidth: bb.bandwidth,
    position: bb.position, strategy: 'Bollinger Bands (20,2)',
  });

  // Check existing
  const existing = db.prepare('SELECT vote_id FROM agent_votes WHERE vote_id = ?').get(voteId);
  if (existing) {
    db.prepare(`UPDATE agent_votes SET vote_direction=?, confidence=?, reasoning=?, raw_analysis=?, voted_at=datetime('now') WHERE vote_id=?`)
      .run(dec.vote, dec.confidence, dec.reasoning, rawAnalysis, voteId);
    console.log(`Updated existing vote: ${voteId}`);
  } else {
    db.prepare(`INSERT INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(voteId, tradeId, AGENT_ID, 'BUY', dec.vote, dec.confidence, dec.reasoning, rawAnalysis);
    console.log(`Inserted vote: ${voteId}`);
  }
  db.prepare(`UPDATE agents SET last_vote_at = datetime('now') WHERE agent_id = ?`).run(AGENT_ID);
  db.close();

  console.log(`\n✅ Vote submitted: ${dec.vote} @ ${dec.confidence}`);
  return { voteId, vote: dec.vote, confidence: dec.confidence, bb, decision: dec };
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
