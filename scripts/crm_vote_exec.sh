#!/bin/bash
# CRM.US vote write + notification - ELEC-20260526-2010
set -e
cd /Users/zys/workspace/hermes-trading-system

echo "=== Step 1: Write votes to DB ==="
sqlite3 data/trading.db < scripts/crm_vote_2010.sql
echo "Done."

echo "=== Step 2: Verify ==="
sqlite3 data/trading.db "SELECT round_id, symbol, total_voters, buy_votes, sell_votes, hold_votes, final_decision, decision_confidence FROM election_rounds WHERE round_id='ELEC-20260526-2010';"

echo "=== Step 3: Notify advertising ==="
npx tsx src/scripts/send-notify.ts --message "选举委员会：CRM.US 死单重投完成（ELEC-20260526-2010），5票一致HOLD✅。历史死单ELEC-20260524-1210已被覆盖。当前持仓维持1股@180.07不变。"
echo "Done."

echo "=== ALL DONE ==="
