import { getDb } from '../src/core/db.ts';

const db = getDb();

// Update learned_pitfall
const existing = db.prepare("SELECT * FROM agent_traits WHERE agent_id='EXE-001' AND trait_key='learned_pitfall'").all();
if (existing.length > 0) {
  db.prepare("UPDATE agent_traits SET trait_value=?, confidence=?, last_updated=datetime('now'), sample_count=sample_count+1 WHERE agent_id='EXE-001' AND trait_key='learned_pitfall'").run(
    '死单判断: final_decision IN (BUY,SELL) AND resulted_trade_id IS NULL。幽灵交易: round final=HOLD但trades有同名OPEN记录。',
    0.7
  );
} else {
  db.prepare("INSERT INTO agent_traits (agent_id, trait_key, trait_value, trait_type, confidence) VALUES ('EXE-001','learned_pitfall','死单判断: final_decision IN (BUY,SELL) AND resulted_trade_id IS NULL','PATTERN',0.7)").run();
}

// Update self_adjustments
const adjRow = db.prepare("SELECT trait_value FROM agent_traits WHERE agent_id='EXE-001' AND trait_key='self_adjustments'").get();
let adj = [];
if (adjRow) {
  try { adj = JSON.parse(adjRow.trait_value); } catch(e) { adj = []; }
}
adj.push('第一次巡检发现CRM.US死单+3笔幽灵交易，记录到经验文档');
adj.push('幽灵交易(HOLD round却有OPEN trade)不主动清理，通知相关部门由leader决策');
db.prepare("UPDATE agent_traits SET trait_value=?, last_updated=datetime('now'), sample_count=sample_count+1 WHERE agent_id='EXE-001' AND trait_key='self_adjustments'").run(JSON.stringify(adj));

// Show result
const final = db.prepare("SELECT * FROM agent_traits WHERE agent_id='EXE-001'").all();
console.log(JSON.stringify(final, null, 2));
