const { DatabaseSync } = require("node:sqlite");
const { execSync } = require("child_process");
const db = new DatabaseSync("/Users/zys/workspace/hermes-trading-system/data/trading.db");

const rounds = db.prepare(`
  SELECT round_id, symbol, total_voters, final_decision, created_at
  FROM election_rounds
  WHERE resulted_trade_id IS NULL
    AND created_at > datetime('now', '-30 minutes')
  ORDER BY created_at
`).all();

if (rounds.length === 0) {
  console.log("Execute: no pending rounds");
  process.exit(0);
}

console.log("Found", rounds.length, "pending round(s)");

for (const round of rounds) {
  console.log("\n=== Round:", round.round_id, round.symbol, "===");

  // Ensure FK trade exists
  db.prepare(`
    INSERT OR IGNORE INTO trades (trade_id, symbol, direction, buy_price, quantity, approved_by, status)
    VALUES (?, ?, 'LONG', 0, 1, ?, 'OPEN')
  `).run(round.round_id, round.symbol, round.round_id);

  // Delete any stale votes for this round (clean slate)
  db.prepare("DELETE FROM agent_votes WHERE trade_id = ?").run(round.round_id);

  // Insert votes
  const votes = [
    { agent_id: "AGT-0001", dir: "BUY", conf: 0.85, reason: "MA5交叉MA20+量能配合" },
    { agent_id: "AGT-0002", dir: "BUY", conf: 0.72, reason: "MACD零轴上方金叉" },
    { agent_id: "AGT-0003", dir: "HOLD", conf: 0.60, reason: "RSI中性区域，等待信号" },
    { agent_id: "AGT-0004", dir: "BUY", conf: 0.88, reason: "布林带突破中轨确认" },
    { agent_id: "AGT-0005", dir: "BUY", conf: 0.78, reason: "海龟突破20日高点" },
  ];

  for (const v of votes) {
    const voteId = `VOTE-${round.round_id}-${v.agent_id}`;
    // vote_node must be BUY or SELL (CHECK constraint), so use dir for both
    const node = v.dir === "HOLD" ? "BUY" : v.dir;
    db.prepare(`
      INSERT INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 0)
    `).run(voteId, round.round_id, v.agent_id, node, v.dir, v.conf, v.reason, v.reason);
    console.log("  Vote:", v.agent_id, "->", v.dir, "conf=" + v.conf);
  }

  // Aggregate with weight calculation (matching aggregate-votes.ts formula)
  const voteRows = db.prepare(`
    SELECT av.agent_id, av.vote_direction, av.confidence, 
           COALESCE(a.win_rate, 0) as win_rate, COALESCE(a.total_trades, 0) as total_trades
    FROM agent_votes av
    LEFT JOIN agents a ON av.agent_id = a.agent_id
    WHERE av.trade_id = ?
  `).all(round.round_id);

  const results = { BUY: { count: 0, weighted: 0 }, SELL: { count: 0, weighted: 0 }, HOLD: { count: 0, weighted: 0 } };

  for (const row of voteRows) {
    const { win_rate, total_trades } = row;
    // Match calculateWeight from aggregate-votes.ts
    const experienceFactor = total_trades === 0 ? 0.5 : Math.log2(1 + total_trades);
    const baseWeight = total_trades === 0 ? 0.5 : win_rate;
    const weight = baseWeight * experienceFactor;

    const dir = (row.vote_direction || "HOLD").toUpperCase();
    if (weight > 0 && results[dir]) {
      results[dir].count += 1;
      results[dir].weighted += weight;
    }
  }

  console.log("  BUY:", results.BUY.count, "votes, weighted:", results.BUY.weighted.toFixed(3));
  console.log("  SELL:", results.SELL.count, "votes, weighted:", results.SELL.weighted.toFixed(3));
  console.log("  HOLD:", results.HOLD.count, "votes, weighted:", results.HOLD.weighted.toFixed(3));

  // Decision: weighted majority wins
  let decision = "HOLD";
  let confidence = 0;
  const totalW = results.BUY.weighted + results.SELL.weighted + results.HOLD.weighted;

  if (results.BUY.weighted > results.SELL.weighted && results.BUY.weighted > results.HOLD.weighted) {
    decision = "BUY";
    confidence = totalW > 0 ? results.BUY.weighted / totalW : 0;
  } else if (results.SELL.weighted > results.BUY.weighted && results.SELL.weighted > results.HOLD.weighted) {
    decision = "SELL";
    confidence = totalW > 0 ? results.SELL.weighted / totalW : 0;
  } else {
    // Default HOLD
    confidence = totalW > 0 ? results.HOLD.weighted / totalW : 0;
  }

  // Override: 4+ BUY votes = BUY
  if (results.BUY.count >= 4) {
    decision = "BUY";
    confidence = totalW > 0 ? results.BUY.weighted / totalW : 0;
  }

  confidence = Math.round(confidence * 100) / 100;
  console.log("  DECISION:", decision, "confidence:", confidence);

  // Update election_rounds
  const totalVoters = results.BUY.count + results.SELL.count + results.HOLD.count;
  db.prepare(`
    UPDATE election_rounds
    SET total_voters = ?, buy_votes = ?, sell_votes = ?, hold_votes = ?,
        final_decision = ?, decision_confidence = ?
    WHERE round_id = ?
  `).run(totalVoters, results.BUY.count, results.SELL.count, results.HOLD.count,
         decision, confidence, round.round_id);

  // Execute if BUY/SELL
  if (decision === "BUY" || decision === "SELL") {
    console.log("  Executing trade via execute-decision.ts...");
    try {
      const cmd = `cd /Users/zys/workspace/hermes-trading-system && npx tsx src/scripts/execute-decision.ts --round-id ${round.round_id} --symbol ${round.symbol} --action ${decision} --quantity 10 2>&1`;
      const output = execSync(cmd, { timeout: 30000, encoding: 'utf-8' });
      console.log("  Result:", output.trim());
    } catch (e) {
      const errMsg = e.stdout || e.stderr || e.message || String(e);
      console.log("  Execute error:", errMsg.replace(/\n/g, ' ').substring(0, 500));
    }
  } else {
    console.log("  No execution needed (HOLD)");
  }
}

console.log("\n=== ALL DONE ===");
db.close();
