# 审核部门 — 经验总结

> 由 RAG-001 维护 | 最后更新：2026-05-26

---

## 2026-05-26 — 部门文档创建：experience.md + learned.md

**背景**：审查部门此前仅有 README.md，缺少 experience.md 和 learned.md。根据文档体系规范（每个部门必须同时具备 README/experience/learned 三件套），本次完成补齐。

**经验**：
- 文档补全不是一次性工作，需要在每次重要操作后追加记录
- review/README.md §11 已预留创建标记（"待创建"），需同步更新为 "✅ 已创建"

---

## 核心经验模式

### 审核流程敏捷化
- review-and-audit.ts 获取交易上下文 + K 线数据（默认 100 天），支持 --kline-days 参数
- review-submit.ts 写入 review_reports 表，自动处理 UNIQUE(trade_id, agent_id) 约束
- 审核网络依赖：K线数据获取失败不阻断主流程（离线元数据部分独立在线）

### 审核框架适配
- 每个审核框架独立判断，PASS/WARN/FAIL 三态
- 框架不适配（如海龟框架审 RSI 策略交易）→ 注明 N/A 并跳过
- 不同框架对同一交易可能有不同结论 — 正常现象，各自保留独立判断

### 时效管理
- 组长分配 ≤ 5 分钟，组员审核 ≤ 30 分钟，汇总提交 ≤ 10 分钟
- 全部流程 ≤ 45 分钟
- 连续超时 3 次 → 组长警示；月超时 ≥ 5 次 → 上报 HR

### 与 HR 对接
- 审核报告 → review_reports 表 → HR 读取
- HR 综合审核结果 + 胜率统计（audit-cycle.ts）→ 人事决策
- 审核部门不做人事决策，只提供质量评估输入
