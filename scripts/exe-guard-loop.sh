#!/bin/bash
# EXE-001 守护进程看门狗 — 由 Kanban dispatcher 运行
# 确保 exe-daemon.mjs 一直活着。每60秒检查一次。
# 永不退出，直到进程被外部杀死。

PIDFILE="/tmp/exe-daemon.pid"
PROJECT="/Users/zys/workspace/hermes-trading-system"
DAEMON="$PROJECT/scripts/exe-daemon.mjs"
LOG="$PROJECT/logs/exe-watch.log"
TASK="${HERMES_KANBAN_TASK:-t_8c4b6e1e}"

echo "[$(date '+%H:%M:%S')] GUARD START task=$TASK PID=$$" >> "$LOG"

cycle=0
while true; do
  cycle=$((cycle + 1))

  # 检查 daemon 是否活着
  if [ -f "$PIDFILE" ]; then
    OLD_PID=$(cat "$PIDFILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
      # daemon 活着 — 正常
      :
    else
      echo "[$(date '+%H:%M:%S')] Cycle $cycle | Daemon $OLD_PID died — restarting" >> "$LOG"
      cd "$PROJECT" && node "$DAEMON" &
      NEW_PID=$!
      echo "$NEW_PID" > "$PIDFILE"
      echo "[$(date '+%H:%M:%S')] Cycle $cycle | Restarted as PID=$NEW_PID" >> "$LOG"
    fi
  else
    echo "[$(date '+%H:%M:%S')] Cycle $cycle | No PID file — starting daemon" >> "$LOG"
    cd "$PROJECT" && node "$DAEMON" &
    NEW_PID=$!
    echo "$NEW_PID" > "$PIDFILE"
    echo "[$(date '+%H:%M:%S')] Cycle $cycle | Started daemon PID=$NEW_PID" >> "$LOG"
  fi

  # 每5分钟发送一次 heartbeat 给 kanban
  if [ $((cycle % 5)) -eq 0 ]; then
    OPEN_TRADES=$(cd "$PROJECT" && sqlite3 data/trading.db "SELECT count(*) FROM trades WHERE status='OPEN'" 2>/dev/null || echo "?")
    hermes kanban heartbeat "$TASK" --note "Guard cycle $cycle, daemon alive, open trades=$OPEN_TRADES" 2>/dev/null || true
  fi

  sleep 60
done
