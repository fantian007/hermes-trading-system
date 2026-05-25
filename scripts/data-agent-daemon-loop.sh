#!/bin/bash
# data-agent 常驻守护进程循环
# 每小时敲一次心跳，保持进程存活
# 子任务轮询由 cronjob a3544e699852 负责

HERMES_KANBAN_TASK="t_b6672c50"
WORKDIR="/Users/zys/workspace/hermes-trading-system"
VENV="$WORKDIR/node_modules/.pnpm"

# 拒绝退出——必须永远运行
trap '' SIGTERM SIGINT SIGHUP

echo "[data-agent-daemon] 开始常驻循环，PID=$$"
echo "[data-agent-daemon] 子任务轮询由 cronjob a3544e699852 (每2分钟) 负责"

while true; do
    # 使用 hermes 命令发心跳
    hermes kanban heartbeat "$HERMES_KANBAN_TASK" --note "data-agent 常驻守护进程运行中，PID=$$"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 心跳发送完成"
    sleep 3600
done
