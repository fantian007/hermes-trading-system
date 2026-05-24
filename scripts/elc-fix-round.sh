#!/bin/bash
# Fix CWD and run trading system operations
cd /Users/zys/workspace/hermes-trading-system || exit 1

echo "=== Checking agent_votes ==="
sqlite3 data/trading.db "SELECT * FROM agent_votes ORDER BY voted_at DESC LIMIT 10;"

echo ""
echo "=== Updating election_rounds ELEC-20260524-0451 ==="
# Update round counts: both AGT-004 and AGT-007 voted BUY
sqlite3 data/trading.db "UPDATE election_rounds SET total_voters=2, buy_votes=2, sell_votes=0, hold_votes=0 WHERE round_id='ELEC-20260524-0451';"

echo ""
echo "=== Updated round ==="
sqlite3 data/trading.db "SELECT * FROM election_rounds WHERE round_id='ELEC-20260524-0451';"

echo ""
echo "=== Running aggregate-votes ==="
npx tsx src/scripts/aggregate-votes.ts --round-id ELEC-20260524-0451 2>&1

echo ""
echo "=== DONE ==="
