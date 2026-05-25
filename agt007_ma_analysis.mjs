// AGT-007 MA Crossover Strategy Analysis for CRM.US
// Round: ELEC-20260525-1634
import { DatabaseSync } from 'node:sqlite';
import { execSync } from 'node:child_process';

const DB_PATH = '/Users/zys/workspace/hermes-trading-system/data/trading.db';
const SYMBOL = 'CRM.US';
const ROUND_ID = 'ELEC-20260525-1634';
const TRADE_ID = 'TMP-ELEC-20260525-1634';
const VOTE_ID = 'VOTE-ELEC-20260525-1634-AGT-007';
const AGENT_ID = 'AGT-007';
const VOTE_NODE = 'BUY';

console.log('=== AGT-007 MA Crossover Strategy Analysis ===');
console.log('Round:', ROUND_ID, 'Symbol:', SYMBOL);

// Use provided context data as baseline
let price = 180.07;
let ma5 = 179.08;
let ma10 = 175.11;
let ma20 = 178.80;

// Try kline data via longbridge CLI for fresh data
try {
  const result = execSync('which lb 2>/dev/null || which longbridge 2>/dev/null || echo ""', { encoding: 'utf-8' });
  const lbPath = result.trim();
  if (lbPath && lbPath.length > 0) {
    console.log('Found longbridge CLI at:', lbPath);
    const klines = execSync(lbPath + ' quote klines ' + SYMBOL + ' --tradefrom=1d --count=30 2>/dev/null', { encoding: 'utf-8', timeout: 15000 });
    if (klines && klines.trim().length > 10) {
      const lines = klines.trim().split('\n').filter(l => l.trim());
      if (lines.length > 1) {
        const closes = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(/[\t,]/);
          if (cols.length >= 4) {
            const c = parseFloat(cols[3] || cols[2]);
            if (!isNaN(c)) closes.push(c);
          }
        }
        if (closes.length >= 20) {
          price = closes[0];
          ma5 = closes.slice(0,5).reduce((a,b)=>a+b,0)/5;
          ma10 = closes.slice(0,10).reduce((a,b)=>a+b,0)/10;
          ma20 = closes.slice(0,20).reduce((a,b)=>a+b,0)/20;
          console.log('Computed from fresh kline data');
        }
      }
    }
  }
} catch(e) {
  console.log('Kline fetch unavailable, using context data');
}

console.log('');
console.log('Current Price:', price.toFixed(2));
console.log('MA5:', ma5.toFixed(2));
console.log('MA10:', ma10.toFixed(2));
console.log('MA20:', ma20.toFixed(2));

const ma5gt10 = ma5 > ma10;
const ma10gt20 = ma10 > ma20;
const ma5gt20 = ma5 > ma20;
const priceGtMa5 = price > ma5;
const priceGtMa20 = price > ma20;

console.log('');
console.log('MA5>MA10:', ma5gt10, '| MA10>MA20:', ma10gt20, '| MA5>MA20:', ma5gt20);
console.log('Price>MA5:', priceGtMa5, '| Price>MA20:', priceGtMa20);

let signal, confidence, reasoning;

if (ma5gt10 && ma10gt20 && ma5gt20) {
  // FULL BULL ALIGNMENT: MA5 > MA10 > MA20 (Golden Cross)
  const spread = ((ma5 - ma10) / ma10) * 100;
  if (priceGtMa5 && priceGtMa20) {
    signal = 'BUY';
    if (spread < 3.0) {
      confidence = 0.75;
      reasoning = 'MA crossover: MA5>$' + ma5.toFixed(2) + '>MA10>$' + ma10.toFixed(2) + '>MA20>$' + ma20.toFixed(2) + ' full bull alignment. Price $' + price.toFixed(2) + ' above all MAs. Fresh golden cross (spread=' + spread.toFixed(2) + '%). Strong BUY.';
    } else {
      confidence = 0.65;
      reasoning = 'MA crossover: MA5>MA10>MA20 bull alignment established. Price above all MAs. BUY.';
    }
  } else {
    signal = 'HOLD';
    confidence = 0.50;
    reasoning = 'MA crossover: Bull alignment but price $' + price.toFixed(2) + ' below MA5($' + ma5.toFixed(2) + '). Pullback in uptrend. HOLD.';
  }
} else if (!ma5gt10 && !ma10gt20 && !ma5gt20) {
  signal = 'SELL';
  confidence = 0.60;
  reasoning = 'MA crossover: MA5<$' + ma5.toFixed(2) + '<MA10<$' + ma10.toFixed(2) + '<MA20<$' + ma20.toFixed(2) + ' death cross alignment. SELL.';
} else if (ma5gt10 && ma10gt20) {
  signal = 'HOLD';
  confidence = 0.50;
  reasoning = 'MA crossover: MA5>$' + ma5.toFixed(2) + '>MA10>$' + ma10.toFixed(2) + '>MA20>$' + ma20.toFixed(2) + '? Actually full bull, should be caught above. Re-checking: MA5=$' + ma5.toFixed(2) + ' MA10=$' + ma10.toFixed(2) + ' MA20=$' + ma20.toFixed(2) + '. HOLD.';
} else {
  signal = 'HOLD';
  confidence = 0.40;
  reasoning = 'MA crossover: Mixed signals. MA5=$' + ma5.toFixed(2) + ' MA10=$' + ma10.toFixed(2) + ' MA20=$' + ma20.toFixed(2) + '. No clear direction. HOLD.';
}

console.log('');
console.log('=== ANALYSIS RESULT ===');
console.log('Signal:', signal);
console.log('Confidence:', confidence.toFixed(2));
console.log('Reasoning:', reasoning);

// DB Operations
console.log('');
console.log('=== DB OPERATIONS ===');
const db = new DatabaseSync(DB_PATH);

// Check agent_votes columns for safety
const cols = db.prepare("PRAGMA table_info(agent_votes)").all();
const colNames = cols.map(c => c.name);
console.log('agent_votes columns:', colNames.join(', '));

// Check existing
const existing = db.prepare('SELECT vote_id FROM agent_votes WHERE vote_id = ?').get(VOTE_ID);
if (existing) {
  console.log('Updating existing vote:', VOTE_ID);
  db.prepare('UPDATE agent_votes SET vote_direction=?, confidence=?, reasoning=?, raw_analysis=?, voted_at=datetime(\'now\') WHERE vote_id=?')
    .run(signal, confidence, reasoning, reasoning, VOTE_ID);
} else {
  console.log('Inserting new vote:', VOTE_ID);
  db.prepare('INSERT INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(VOTE_ID, TRADE_ID, AGENT_ID, VOTE_NODE, signal, confidence, reasoning, reasoning);
}

// Verify
const verify = db.prepare('SELECT * FROM agent_votes WHERE vote_id = ?').get(VOTE_ID);
console.log('');
console.log('=== VOTE VERIFIED ===');
console.log(JSON.stringify(verify, null, 2));

db.close();
console.log('');
console.log('=== AGT-007 Analysis Complete ===');
