# HR 学习笔记

> 最后更新：2026-05-24 04:32 UTC+8

## 2026-05-24 — HR 守护进程启动

### 1. 系统启动初期状态

- 再次确认：系统处于冷启动阶段（12 ACTIVE Agent，0 笔交易，全零胜率）
- 人事管理暂时无可操作的淘汰/影子期/警告判定 — 所有 Agent 没有交易数据
- Profile 实践经验：patch 的 Errno 2 不一定真失败，修改可能已生效

### 2. 工作方式调整

- 守护进程不调 kanban_complete，永远 running，这意味着不能让一次工具调用无限期阻塞
- 每次轮巡保持简洁高效，避免过多工具调用消耗上下文窗口

### 3. 文档检查结果

- docs/hr/README.md — 完整 v1.0，包含所有流程 SOP
- docs/hr/experience.md — 3 条记录，格式良好
- docs/knowledge/INDEX.md — 4 条索引，覆盖 HR/System 领域
- docs/hr/learned.md — 新创建
