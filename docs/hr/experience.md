## 2026-05-23 — v4.3 全员学习状态汇总与知识库记录

**背景：** CEO-001 完成 architecture.md v4.3 学习后，创建了通知 HR 的任务（t_aaecbfa0），要求将 CEO-001 学习确认和其他 Agent 学习状态一并记录到知识库。

**执行过程：**
1. 通过 sqlite3 查询全部 23 个 v4.3 相关 Kanban 任务的状态
2. 发现 16 个已完成、7 个卡在 crash-loop（sentiment + 6 个策略 Agent）
3. 崩溃原因：worker exited cleanly (rc=0) 而未调用 kanban_complete/kanban_block — 缺少对应 Hermes profile
4. 创建 docs/knowledge/hr/v4.3-learning-completion.md 完整记录
5. 创建 docs/knowledge/INDEX.md 索引文件
6. 创建 Kanban 任务给 advertising-agent 推送飞书

**经验：**
- Kanban 派发的任务如果对应 profile 不存在，会 crash-loop 进入死循环
- 不能等待这 7 个 stuck 任务完成 — 它们没有 profile 无法被调度
- 首先记录已完成的 14 位 Agent，7 个 stuck 任务做标记即可
