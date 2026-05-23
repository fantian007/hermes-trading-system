const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("./data/trading.db");

const now = db.prepare("SELECT datetime('now') as now").get();
console.log("DB_NOW:", now.now);

const rows = db.prepare(`
  SELECT round_id, symbol, total_voters, final_decision, decision_confidence, created_at
  FROM election_rounds
  WHERE resulted_trade_id IS NULL 
    AND created_at > datetime('now', '-30 minutes')
  ORDER BY created_at
`).all();

if (rows.length === 0) {
  console.log("PENDING_COUNT: 0");
  process.exit(0);
}

console.log("PENDING_COUNT:", rows.length);
rows.forEach(r => {
  const parts = [r.round_id, r.symbol, r.total_voters, r.final_decision || "NONE", r.decision_confidence || "0", r.created_at];
  console.log("PENDING|" + parts.join("|"));
});
db.close();
