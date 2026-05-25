#!/bin/bash
# ELC-001 Daemon — Persistent heartbeat keeper for election committee
# Runs continuously, sending kanban heartbeats and checking for new work.
#
# Usage: bash src/scripts/elc-daemon.sh <task_id> <board_slug>

TASK_ID="${1:-t_c399e63e}"
BOARD="${2:-trading-system}"
PROJECT_DIR="/Users/zys/workspace/hermes-trading-system"
HERMES_DIR="/Users/zys/.hermes"
PIDFILE="/tmp/hermes_elc_daemon_${TASK_ID}.pid"
LOGFILE="/tmp/hermes_elc_daemon_${TASK_ID}.log"
VENV_HERMES="$HERMES_DIR/hermes-agent/venv/bin/hermes"

export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
cd "$PROJECT_DIR" || exit 1

# Write PID
echo $$ > "$PIDFILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ELC-001 daemon started (PID $$, board=$BOARD, task=$TASK_ID)" >> "$LOGFILE"

HEARTBEAT_COUNT=0
DAEMON_CYCLE=0
# Track last known round count to detect new work
LAST_ROUND_COUNT=$(sqlite3 "$PROJECT_DIR/data/trading.db" "SELECT COUNT(*) FROM election_rounds;" 2>/dev/null || echo "0")

while true; do
    HEARTBEAT_COUNT=$((HEARTBEAT_COUNT + 1))
    DAEMON_CYCLE=$((DAEMON_CYCLE + 1))

    # 1. Send kanban heartbeat every cycle (~60s)
    $VENV_HERMES kanban heartbeat "$TASK_ID" --note "ELC-001 daemon HB #${HEARTBEAT_COUNT}" 2>> "$LOGFILE" || true

    # 2. Every 5 cycles (~5 min): check for new DB activity
    if [ $((DAEMON_CYCLE % 5)) -eq 0 ]; then
        CURRENT_COUNT=$(sqlite3 "$PROJECT_DIR/data/trading.db" "SELECT COUNT(*) FROM election_rounds;" 2>/dev/null || echo "0")
        if [ "$CURRENT_COUNT" != "$LAST_ROUND_COUNT" ]; then
            DIFF=$((CURRENT_COUNT - LAST_ROUND_COUNT))
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] New rounds detected: +${DIFF} (total: $CURRENT_COUNT)" >> "$LOGFILE"
            # Check for unexecuted rounds
            UNEXECUTED=$(sqlite3 "$PROJECT_DIR/data/trading.db" \
                "SELECT round_id, symbol, final_decision FROM election_rounds WHERE executed_at IS NULL ORDER BY created_at DESC LIMIT 5;" 2>/dev/null)
            if [ -n "$UNEXECUTED" ]; then
                echo "  Pending rounds:" >> "$LOGFILE"
                echo "$UNEXECUTED" >> "$LOGFILE"
            fi
            LAST_ROUND_COUNT=$CURRENT_COUNT
        fi
    fi

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] HB #${HEARTBEAT_COUNT}" >> "$LOGFILE"
    sleep 60
done
