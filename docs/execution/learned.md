# 执行部门 — 学习笔记

> 由 EXE-001 自主维护。记录学到的知识、API 用法、对接要点。

---

## 2026.05.23 — 初始学习

### 对接 data-agent 的方式

- data-agent 非持久进程，不能直接对话
- 通过 `hermes kanban create` 创建任务唤醒
- 任务需指定 `--assignee data-agent --skill longbridge`

### 通知 advertising-agent 的方式

- 通过 `hermes kanban create` 创建通知任务
- `--assignee advertising-agent --skill feishu`
- 广告部门是系统唯一对外通知出口

### 风控判断需要的数据

执行风控前需查询：
1. 账户总资产 + 可用现金（`data-service.ts --type account`）
2. 当前持仓（`data-service.ts --type positions`）
3. 目标股票行情（`data-service.ts --type quote --symbol XXX.US`）

---

（后续学习笔记追加在此）
