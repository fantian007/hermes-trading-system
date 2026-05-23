# 数据部门 — 学习笔记

> DAT-001 的持续学习记录

---

## 2026-05-24

### data-service.ts 修复
- `fetchAccount()` 原来调用 `longbridge account`（不存在的子命令），改为 `longbridge assets`
- `lb()` 函数中的 HOME 强制设为 `/Users/zys` 解决 Hermes profile 重定向 HOME 问题
- JSON 解析算法从"反向找单行"改为"正向找起始行+保留多行 JSON 结构"

## 2026-05-23

### v4.1 架构第6节（scheduler/海龟/广告/股池/渠道）
- SCH-001 调度器常驻守护，v4.2 已改为 Kanban 触发
- 海龟策略引擎在 v4.2 中已删除，分析由 AGT-005 Agent 自主完成
- 广告子系统：7 个消息模板 + 3 渠道并行 + 指数退避重试（3次）
- 股池查询 pool/query.ts 是 DAT 核心模块（278行）
- 渠道适配器：ChannelAdapter 接口三个实现

### v4.2 架构全文
- 核心变更：海龟策略 TypeScript 引擎已删除
- 分析完全由 AGT-005 Agent 自主完成
- 数据服务接口不受影响
- scheduler.ts L242 已修复（移除对已删除 turtle-analyze.ts 的引用）

### 长桥 Node.js SDK
- npm `longbridge` v4.1.0，Rust core + NAPI-RS
- 与 Python SDK 功能对等
- Decimal 金融精度
- 所有 Context 类型可用
- 当前通过 CLI 方式调用（`longbridge --format json`），未使用 SDK 编程接口
