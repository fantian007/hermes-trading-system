#!/usr/bin/env python3
import sqlite3
db = sqlite3.connect('/Users/zys/workspace/hermes-trading-system/data/trading.db')
cols = [d[0] for d in db.execute("PRAGMA table_info(stock_pool)").fetchall()]
print("columns:", cols)
r = db.execute("SELECT * FROM stock_pool WHERE status='ACTIVE' LIMIT 1").fetchone()
print("row:", r)
db.close()
