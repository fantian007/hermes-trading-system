import sqlite3, sys, json, math

# Direct SQLite insert — no dependency on terminal CWD
db_path = "/Users/zys/workspace/hermes-trading-system/data/trading.db"
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
c = conn.cursor()

round_id = "ELEC-20260524-1210"

votes = [
    ("ELEC-20260524-1210", "AGT-007", "BUY", 0.60, 179.00, 180.50, 0, "MA5↑MA20新鲜金叉确认"),
    ("ELEC-20260524-1210", "AGT-002", "BUY", 0.65, 179.00, 180.50, 0, "MACD DIF/DEA fresh golden cross below zero axis"),
    ("ELEC-20260524-1210", "AGT-004", "BUY", 0.55, 177.50, 180.00, 0, "布林带中轨附近，从下轨反弹至中轨"),
    ("ELEC-20260524-1210", "AGT-005", "HOLD", 0.65, None, None, 0, "海龟系统：未突破唐奇安通道上沿"),
    ("ELEC-20260524-1210", "AGT-008", "BUY", 0.50, 177.50, 180.00, 0, "RSI(14)≈55-60中性偏强，无超买风险"),
]

# Need reasoning field too - check table schema first
c.execute("PRAGMA table_info(agent_votes)")
cols = c.fetchall()
print("agent_votes columns:", [dict(r)["name"] for r in cols])

# Insert
inserted = 0
failed = 0
for v in votes:
    try:
        c.execute(
            "INSERT INTO agent_votes (trade_id, agent_id, vote_direction, confidence, price_low, price_high, is_shadow, reasoning) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            v
        )
        print(f"INSERTED: {v[1]} -> {v[2]} ({v[3]})")
        inserted += 1
    except Exception as e:
        print(f"FAILED {v[1]}: {e}")
        failed += 1

conn.commit()
print(f"\nInserted: {inserted}, Failed: {failed}")

# Verify
c.execute("SELECT * FROM agent_votes WHERE trade_id = ?", (round_id,))
rows = c.fetchall()
print(f"\n=== All votes ({len(rows)}) ===")
for r in rows:
    print(dict(r))

conn.close()
