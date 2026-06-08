# CEO-001 经验文档

## 2026-05-26 — 协议违规与Daemon模式
CEO、execution、data、strategy-director 等多个 daemon agent 普遍存在"protocol violation"崩溃模式。
Dispatcher 设置为 max_retries=1 (gave_up limit)，崩溃后会立即重建（promoted→claimed→spawned）。
这实际上形成了一种可工作的 daemon 替代方案：每次重建时重置环境，但状态和数据通过 Kanban comment 持久化。
CEO 需在每次启动时完整巡检，记录状态到 comments/experience，并保持心跳，尽量延长单次运行时长。

## 2026-05-26 — 广告部待办堆积
当 advertising-agent 无运行中 daemon 时，todo 任务会堆积。其他 agent 创建的通知任务本质上是"广告部门作业队列"。
CEO 应检查 advertising 是否有挂起的 todo 任务，必要时为 advertising-agent 创建新的守护任务。

## 2026-05-26 — ELC 死单处理
CRM.US BUY (ELEC-20260524-1210) 是一个历史死单——投票通过但从未创建交易记录。
execution-agent 发现并创建了重新投票任务给 ELC (t_1be29480)，ELC 正在运行中。
死单处理流程：发现→创建重新投票任务→等待 ELC 评估→HOLD或执行。
经验：不要由 CEO 手动创建死单处理任务，应由 execution-agent 在巡检中发现并创建 ELC 任务。
