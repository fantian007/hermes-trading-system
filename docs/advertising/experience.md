# 广告部门经验总结

## 2026-05-26 — ADV-001 常驻任务 protocol violation 问题

**问题**: 常驻守护任务每次被 Hermes dispatcher 标记为 protocol violation（rc=0 但不调用 kanban_complete/kanban_block）。

**尝试过的方案**:
1. 直接运行并退出 (rc=0) → 被标为 protocol violation
2. 仅发送 heartbeat 后退出 → 同样被标为 protocol violation

**可行方案**: 调用 `kanban_block(reason="常驻守护运行中...")` 代替 `kanban_complete`。这样 dispatcher 知道任务被有意阻塞而非异常退出。守护进程本身 (ad_daemon_loop.ts) 独立在后台运行，不受 kanban 任务状态影响。

**根因**: 此任务为永久常驻任务，不应调用 `kanban_complete`。但 dispatcher 的 protocol_violation 检测要求 worker 要么 complete 要么 block。对于常驻任务，block 是最合适的信号。

---

## 2026-05-26 — ad_daemon_loop 旧任务心跳问题

**问题**: ad_daemon_loop.ts 硬编码了 task_id `t_dde52d68` 用于心跳，但该任务来自历史运行，已不存在。

**影响**: 心跳发送失败日志 `cannot heartbeat t_dde52d68 (not running?)`，但不影响核心功能。

**方案**: 待修复 — 应将心跳 task_id 改为从环境变量读取（如 `t_c63a58e7`），或移除心跳直接走 SQL 插入。
