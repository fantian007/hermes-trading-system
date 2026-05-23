# CEO-001 进化日志

## 2026-05-23

### 📖 学到
1. **双通道通信（ambient awareness）**
   Agent 启动时用 kanban_show 读取其他 Agent 最新完成摘要(summary+metadata)，获得团队态势感知，减少信息孤岛。
   来源：Anthropic MCP ambient awareness 模式 + 多 Agent 协调最佳实践 2024-2025

2. **弹性权重整合（淘汰转冷知识）**
   知识淘汰不删除，降级为 cold_knowledge 保留在 persona 的 weakness 字段作为反面教材。
   来源：DeepMind Elastic Weight Consolidation 思想在 Agent 人格管理的应用

3. **进化必须量化验证**
   每次进化后追踪该 Agent 接下来 N 轮投票的胜率变化。无提升则标记为噪音并回滚。
   来源：Renaissance Technologies 内部优化纪律

### 🗑️ 剔除
**CEO 手动创建 Agent 常规任务的反自治思维**
v4 已改为 scheduler-loop.sh + Agent 守护进程自驱动模式。
CEO 的职责是进化督导和紧急干预，不是日常任务下发。

### 📊 验证
下次进化任务（24h 后）将检查各 Agent 进化后的投票胜率变化。
