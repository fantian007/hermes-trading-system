import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync(process.env.DB_PATH || "./data/trading.db");
const now = new Date().toISOString().replace("T", " ").substring(0, 19);
const value = JSON.stringify([
  "2026-05-26: NVDA SELL 15 done. lesson: trust data-agent longbridge data not ELC cost",
]);
db.prepare(
  "INSERT OR REPLACE INTO agent_traits (agent_id, trait_key, trait_value, trait_type, confidence, last_updated, sample_count) VALUES (?,?,?,?,?,?,1)"
).run("EXE-001", "self_adjustments", value, "HISTORY", 0.7, now);
console.log("self_adjustments updated");
db.close();
