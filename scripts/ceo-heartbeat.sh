#!/bin/bash
# CEO-001 心跳脚本 — 每1分钟保活 + 快速系统检查
# 每执行一次心跳，并记录巡检摘要

TASK_ID="t_00031a3e"
NOTE="${2:-👑 CEO-001 心跳 $(date '+%H:%M')}"

# 发送心跳
hermes kanban heartbeat "$TASK_ID" --note "$NOTE" 2>/dev/null

# 每5次心跳（每5分钟）做一次快速巡检
COUNT_FILE="/tmp/ceo-heartbeat-count"
COUNT=0
if [ -f "$COUNT_FILE" ]; then
    COUNT=$(cat "$COUNT_FILE")
fi
COUNT=$((COUNT + 1))
echo $COUNT > "$COUNT_FILE"

# 第5次心跳（约5分钟）执行完整巡检
if [ "$COUNT" -ge 5 ]; then
    echo 0 > "$COUNT_FILE"
    cd /Users/zys/workspace/hermes-trading-system || exit 0
    
    # 快速检查所有守护进程
    STATUS=$(hermes kanban list 2>/dev/null | grep -c "running")
    BLOCKED=$(hermes kanban list 2>/dev/null | grep -c "blocked")
    
    hermes kanban heartbeat "$TASK_ID" --note "👑 CEO巡检: ${STATUS}个running, ${BLOCKED}个blocked $(date '+%H:%M')" 2>/dev/null
fi
