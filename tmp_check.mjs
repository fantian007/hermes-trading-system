import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync(
  process.env.DB_PATH || "./data/trading.db"
);
const dead = db
  .prepare(
    "SELECT round_id, symbol, final_decision, resulted_trade_id, decision_confidence FROM election_rounds WHERE final_decision IN ('BUY','SELL') AND resulted_trade_id IS NULL"
  )
  .all();
console.log("DEAD ROUNDS:", JSON.stringify(dead));

const held = db
  .prepare(
    "SELECT round_id, symbol, final_decision, resulted_trade_id FROM election_rounds WHERE resulted_trade_id IS NOT NULL ORDER BY rowid DESC LIMIT 5"
  )
  .all();
console.log("RECENT EXECUTED:", JSON.stringify(held));
db.close();
