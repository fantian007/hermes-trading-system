import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('/Users/zys/workspace/hermes-trading-system/data/trading.db');

const voteId = 'VOTE-ELEC-20260526-2004-AGT-008';
const reasoning = 'RSI(14)=72.65 exceeds overbought threshold(70). Though trend is extremely strong (MA5>$23 > MA10>$22 > MA20>$19 full bull alignment, +83.7% in 19 days, +48.7% in last 5 days accelerating), pre-market at $31.67 (+8.27% from $29.25 close) confirms further extension. RSI deeply overbought with parabolic acceleration pattern. Per strategy: "overbought(>=70) does not mean sell, must evaluate trend" - trend IS strong but velocity too extreme for new entry. No existing position. Learned pitfall from SMCI +16.4% exhaustion pattern suggests high reversion risk after such rapid moves. Recommend HOLD for pullback to MA10 or MA20 support.';

// Check if vote already exists
const existing = db.prepare("SELECT vote_id FROM agent_votes WHERE vote_id = ?").get(voteId);

if (existing) {
  db.prepare(`UPDATE agent_votes SET vote_direction='HOLD', confidence=0.70, reasoning=?, raw_analysis=?, voted_at=datetime('now') WHERE vote_id=?`)
    .run(reasoning, JSON.stringify({
      symbol: 'NVTS.US',
      roundId: 'ELEC-20260526-2004',
      rsi14: 72.65,
      closesCount: 15,
      currentPrice: 29.25,
      preMarketPrice: 31.67,
      may4Price: 15.92,
      totalReturn: '+83.7%',
      last5Return: '+48.7%',
      strategy: 'RSI超买超卖策略(CAT-020)',
      analysis: 'RSI overbought (72.65) with parabolic acceleration in strong uptrend. HOLD for pullback.'
    }), voteId);
  console.log('Updated existing vote:', voteId);
} else {
  db.prepare(`INSERT INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis) VALUES(?, 'ELEC-20260526-2004', 'AGT-008', 'BUY', 'HOLD', 0.70, ?, ?)`)
    .run(voteId, reasoning, JSON.stringify({
      symbol: 'NVTS.US',
      roundId: 'ELEC-20260526-2004',
      rsi14: 72.65,
      closesCount: 15,
      currentPrice: 29.25,
      preMarketPrice: 31.67,
      may4Price: 15.92,
      totalReturn: '+83.7%',
      last5Return: '+48.7%',
      strategy: 'RSI超买超卖策略(CAT-020)',
      analysis: 'RSI overbought (72.65) with parabolic acceleration in strong uptrend. HOLD for pullback.'
    }));
  console.log('Inserted vote:', voteId);
}

// Verify
const verify = db.prepare("SELECT * FROM agent_votes WHERE vote_id = ?").get(voteId);
console.log('\nVerification:', JSON.stringify(verify, null, 2));

db.close();
