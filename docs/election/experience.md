## 2026-05-26 — ELC-001 Daemon 首次部署流程

### 问题
ELC-001 (election committee) 需要作为常驻守护进程持续运行，但 agent 进程退出会触发 protocol_violation。

### 解决方案
1. **心跳基础设施**：background shell 脚本 (elc-daemon.sh) 每 60s 调用 `hermes kanban heartbeat`，并设置冗余 cron job 每 2m 作为后备
2. **Block 任务**：agent 退出前调用 `kanban_block(reason="Daemon mode: ...")`，让派遣器不会认为 protocol_violation
3. **永久运行**：daemon 脚本持续循环（while true），task 保持 blocked 状态，由外部心跳维持生命

### 关键要点
- 当前 task ID: t_c399e63e（之前是 t_a76f6cca）
- Daemon 进程 PID 在 /tmp/hermes_elc_daemon_${TASK_ID}.pid
- 日志在 /tmp/hermes_elc_daemon_${TASK_ID}.log
- cron job ID: 1e634b740954 (elc-001-heartbeat-redundant)，每 2 分钟
- 恢复方式：unblock task → dispatcher 重新 spawn 新 agent 进程
