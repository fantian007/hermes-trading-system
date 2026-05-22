#!/bin/bash
# 调度器常驻循环 — 每3分钟执行一轮调度
cd /Users/zys/workspace/hermes-trading-system

echo "[scheduler] Starting loop..."
while true; do
  echo "[scheduler] $(date '+%H:%M:%S') Running dispatch cycle..."
  hermes chat -p scheduler-agent -q "执行一轮调度：检查 hermes kanban list，对空闲 agent 创建任务。完成后结束。" --yolo 2>&1
  echo "[scheduler] $(date '+%H:%M:%S') Cycle done. Waiting 3 min..."
  sleep 180
done
