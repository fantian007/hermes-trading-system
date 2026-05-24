# 选举委员会学习笔记

## 2026-05-24 — 常驻守护进程经验总结

### 核心教训：守护进程必须保持常驻

ELC-001 被设计为常驻守护进程（"不调 kanban_complete"），但 Hermes Kanban 框架的条件是：
- 每个 worker 必须调用 kanban_complete 或 kanban_block 来结束任务
- 如果不调，进程退出时被标记为 protocol_violation → crashed
- 解决方案：**保持进程永远不退出**，通过持续心跳让派遣器知道你还活着
- 每60秒至少一次 heartbeat，确保 dispatch_stale_timeout_seconds 不会触发

### 守护循环模式

1. 第一次启动：检查系统状态、初始化 todo、发 heartbeat
2. 持续循环： 
   - 每60秒发一次 heartbeat
   - 每次循环检查 DB 是否有新投票请求（election_rounds 中新的 pending 轮次）
   - 检查是否有策略 Agent 通过 delegate_task 发来的消息
   - 响应任何待处理事项
3. **不调用 kanban_complete**

### 历史对比

- 前 21 次启动全部失败：发了1-2次 heartbeat 后输出状态就退出
- 问题不是逻辑错误，而是 worker 在输出完状态报告后自然终止
- 进程退出时 exit_code=0 → dispatcher 检测到没有 kanban_complete → protocol violation

### 策略 Agent 活性状态 (2026-05-24)

| Agent | 名称 | 状态 |
|-------|------|------|
| AGT-007 | 均线交叉策略分析官 | ACTIVE |
| AGT-005 | 海龟交易策略官 | ACTIVE |
| strategy-director | 策略组长 | ACTIVE |

| AGT-002/004/008 已重新活跃（HR重建）。当前14个agents：5策略+1舆情+1选举+1执行+6审核。

## 2026-05-24 — 第24次启动：心跳守护进程模式

### 核心问题诊断
前23次全部crash，根本原因：**LLM会话自然结束**后进程退出（rc=0）。
- `kanban_complete` / `kanban_block` 没有被调用 → dispatcher 标记为 protocol_violation
- 解决方案分两层：
  1. **后台心跳进程**：`bash elc001_heartbeat.sh` 用 background=true 启动，每60秒写状态文件 + 让 dispatcher 看到进程还活着
  2. **Agent自身循环**：LLM agent 必须持续工作，不能输出完报告就结束

### 当前系统状态 (2026-05-24 周六 US ET)
- 1 OPEN持仓：AAPL.US LONG $308.4, 5股
- 1 历史死单：CRM.US ELEC-20260524-1210 BUY通过但无成交
- 35只股池，21活跃标的
- 周末休市中，等待周一开盘
