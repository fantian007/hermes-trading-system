#!/bin/bash
# EXE-001 Watch script — monitors exe-state.json for pending executions
# Runs alongside exe-daemon.mjs as a lightweight watcher
cd /Users/zys/workspace/hermes-trading-system || exit 1

STATE_FILE="logs/exe-state.json"
LOG_FILE="logs/exe-watch.log"

echo "EXE-WATCH started. PID=$$" > "$LOG_FILE"

for i in $(seq 1 100); do
  ts=$(date +%H:%M:%S)
  if [ -f "$STATE_FILE" ]; then
    PENDING=$(python3 -c "
import sys,json
with open('$STATE_FILE') as f:
    d = json.load(f)
p = d.get('pendingExecutions', 'none')
if p != 'none' and len(p) > 0:
    print('DETECTED|' + json.dumps(p))
else:
    print('ok|none')
" 2>/dev/null)
    
    STATUS=$(echo "$PENDING" | cut -d'|' -f1)
    DATA=$(echo "$PENDING" | cut -d'|' -f2-)
    
    if [ "$STATUS" = "DETECTED" ]; then
      echo "[$ts] Cycle $i | ⚠️  PENDING EXECUTIONS: $DATA" | tee -a "$LOG_FILE"
    fi
  fi
  echo "[$ts] Cycle $i | $(cat "$STATE_FILE" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'cyc={d.get(\"cycle\")} pex={d.get(\"pendingExecutions\")} trades={d.get(\"openTrades\")}')" 2>/dev/null)" >> "$LOG_FILE" 2>/dev/null
  sleep 60
done

echo "EXE-WATCH: completed 100 cycles. $(date)" >> "$LOG_FILE"
