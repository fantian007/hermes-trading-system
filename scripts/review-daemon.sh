#!/usr/bin/env bash
# review-auditor 常驻守护进程
# 每60秒检查一次新的 CLOSED 交易，触发审核流程
# 永不退出 — 启动后以 exec 风格无限循环

TASK_ID="${HERMES_KANBAN_TASK:-t_bb2229c4}"
WORKDIR="/Users/zys/workspace/hermes-trading-system"
HERMES_CLI="/Users/zys/.hermes/hermes-agent/venv/bin/hermes"
DB="$WORKDIR/data/trading.db"

# 拒绝退出——必须永远运行
trap '' SIGTERM SIGINT SIGHUP

echo "[review-daemon] 开始常驻循环，PID=$$"
echo "[review-daemon] 工作目录: $WORKDIR"
echo "[review-daemon] 任务: $TASK_ID"

# 运行审计周期（更新胜率统计）
run_audit_cycle() {
    cd "$WORKDIR" && npx tsx src/scripts/audit-cycle.ts >/dev/null 2>&1 || true
}

# 发送心跳
heartbeat() {
    local note="$1"
    "$HERMES_CLI" kanban heartbeat "$TASK_ID" --note "$note" >/dev/null 2>&1 || true
}

# 获取已审核的 trade_id 列表（去重）
get_reviewed_trades() {
    sqlite3 "$DB" "SELECT DISTINCT trade_id FROM review_reports;" 2>/dev/null | tr '\n' '|'
}

# 检查是否有未审核的 CLOSED 交易
get_unreviewed_closed() {
    local reviewed_list="${1:-}"
    sqlite3 "$DB" "
        SELECT trade_id, symbol, pnl, pnl_pct, closed_at
        FROM trades
        WHERE status = 'CLOSED'
          AND trade_id NOT IN (
            SELECT DISTINCT trade_id FROM review_reports WHERE trade_id IS NOT NULL
          )
        ORDER BY closed_at DESC;
    " 2>/dev/null
}

# 主循环
CYCLE=0
while true; do
    CYCLE=$((CYCLE + 1))

    # 每60秒运行一次审计周期
    if [ $((CYCLE % 1)) -eq 0 ]; then
        run_audit_cycle
    fi

    # 检查新交易
    NEW_CLOSED=$(get_unreviewed_closed)
    if [ -n "$NEW_CLOSED" ]; then
        echo "[review-daemon] [$(date '+%Y-%m-%d %H:%M:%S')] 发现新 CLOSED 交易:"
        echo "$NEW_CLOSED" | while IFS='|' read -r trade_id symbol pnl pnl_pct closed_at; do
            echo "  $trade_id ($symbol PnL=$pnl $pnl_pct%)"
        done
    fi

    # 每5次循环（5分钟）发送一次心跳
    if [ $((CYCLE % 5)) -eq 0 ]; then
        OPEN_COUNT=$(sqlite3 "$DB" "SELECT COUNT(*) FROM trades WHERE status='OPEN';" 2>/dev/null || echo "?")
        CLOSED_COUNT=$(sqlite3 "$DB" "SELECT COUNT(*) FROM trades WHERE status='CLOSED';" 2>/dev/null || echo "?")
        REVIEWED_COUNT=$(sqlite3 "$DB" "SELECT COUNT(DISTINCT trade_id) FROM review_reports;" 2>/dev/null || echo "?")
        heartbeat "review-daemon: OPEN=$OPEN_COUNT CLOSED=$CLOSED_COUNT 已审=$REVIEWED_COUNT PID=$$"
    fi

    sleep 60
done
